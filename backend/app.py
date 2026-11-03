from __future__ import annotations

import asyncio
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import uuid
import zipfile
import tempfile
import wave
import math
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

ROOT = Path(os.environ.get('MOZZART_WORKSPACE', str(Path.home() / 'AppData/Local/MozzartStudio/jobs'))).resolve()
ROOT.mkdir(parents=True, exist_ok=True)
LIMIT = 100 * 1024 * 1024
REQUEST_LIMIT = LIMIT + 1024 * 1024
MAX_DURATION = 1200
NORMALIZED_LIMIT = (MAX_DURATION + 1) * 44100 * 4 + 65536
INPUT_FORMATS = 'wav,mp3,flac,mov'


class UploadBoundary:
    """Bound raw bodies before multipart spooling, including chunked requests."""
    slots = threading.BoundedSemaphore(4)

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] != 'POST':
            return await self.app(scope, receive, send)
        from starlette.responses import JSONResponse
        headers = dict(scope['headers'])
        try:
            declared = int(headers.get(b'content-length', b'0'))
        except ValueError:
            return await JSONResponse({'detail': 'Invalid Content-Length'}, 400)(scope, receive, send)
        if declared < 0 or declared > REQUEST_LIMIT:
            return await JSONResponse({'detail': 'Request body too large'}, 413)(scope, receive, send)
        if not self.slots.acquire(blocking=False):
            return await JSONResponse({'detail': 'Upload capacity reached'}, 429)(scope, receive, send)
        try:
            with tempfile.TemporaryFile(dir=ROOT) as body:
                total = 0
                try:
                    async with asyncio.timeout(120):
                        while True:
                            message = await receive()
                            if message['type'] == 'http.disconnect':
                                return
                            chunk = message.get('body', b'')
                            total += len(chunk)
                            if total > REQUEST_LIMIT:
                                return await JSONResponse({'detail': 'Request body too large'}, 413)(scope, receive, send)
                            body.write(chunk)
                            if not message.get('more_body', False):
                                break
                except TimeoutError:
                    return await JSONResponse({'detail': 'Upload timed out'}, 408)(scope, receive, send)
                body.seek(0)
                remaining = total
                async def replay():
                    nonlocal remaining
                    if remaining:
                        chunk = body.read(min(65536, remaining))
                        remaining -= len(chunk)
                        return {'type': 'http.request', 'body': chunk, 'more_body': remaining > 0}
                    return {'type': 'http.request', 'body': b'', 'more_body': False}
                await self.app(scope, replay, send)
        finally:
            self.slots.release()


MODELS = {'htdemucs', 'htdemucs_6s'}
app = FastAPI(title='Mozzart Studio local API')
app.add_middleware(UploadBoundary)
executor = ThreadPoolExecutor(max_workers=1)
lock = threading.RLock()


class OutputFile(BaseModel):
    name: str
    url: str


class Job(BaseModel):
    id: str
    status: Literal['queued', 'running', 'succeeded', 'failed'] = 'queued'
    stage: str = 'Queued'
    progress: float | None = None
    error: str | None = None
    files: list[OutputFile] = []


jobs: dict[str, Job] = {}


def snapshot(job_id: str) -> Job:
    with lock:
        if job_id not in jobs:
            raise HTTPException(404, 'Job not found or expired.')
        return jobs[job_id].model_copy(deep=True)


def update(job_id: str, **values: object) -> None:
    with lock:
        jobs[job_id] = jobs[job_id].model_copy(update=values)
        path = ROOT / job_id / 'job.json'
        path.write_text(jobs[job_id].model_dump_json(), encoding='utf-8')


def prune() -> None:
    cutoff = time.time() - 86400
    with lock:
        for folder in ROOT.iterdir():
            if not folder.is_dir() or len(folder.name) != 32:
                continue
            active = folder.name in jobs and jobs[folder.name].status in ('queued', 'running')
            if not active and folder.stat().st_mtime < cutoff:
                shutil.rmtree(folder)
                jobs.pop(folder.name, None)


def normalize_audio(source: Path, max_duration: float = MAX_DURATION) -> Path:
    restrictions = ['-protocol_whitelist', 'file', '-format_whitelist', INPUT_FORMATS]
    probe = subprocess.run(['ffprobe', '-v', 'error', *restrictions, '-show_entries', 'format=duration', '-of', 'json', str(source)], capture_output=True, text=True, timeout=30)
    if probe.returncode:
        raise ValueError('Audio could not be decoded. Upload a valid audio file.')
    try:
        duration = float(json.loads(probe.stdout)['format']['duration'])
    except (ValueError, KeyError, TypeError):
        raise ValueError('Audio duration metadata is invalid.') from None
    if not math.isfinite(duration) or not 0 < duration <= max_duration:
        raise ValueError(f'Audio duration must be between zero and {max_duration} seconds.')
    normalized_limit = (max_duration + 1) * 44100 * 4 + 65536
    normalized = source.parent / ('normalized.wav' if source.name.lower() == 'input.wav' else 'input.wav')
    if normalized.resolve() == source.resolve():
        raise ValueError('Normalization output must differ from source.')
    decode = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', *restrictions, '-i', str(source), '-map', '0:a:0', '-vn', '-sn', '-dn', '-t', str(max_duration + 1), '-fs', str(int(normalized_limit)), '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', str(normalized)], capture_output=True, text=True, timeout=120)
    if decode.returncode:
        raise ValueError('Audio conversion failed. Check the uploaded media.')
    if normalized.stat().st_size >= normalized_limit:
        raise ValueError('Decoded audio exceeds the size limit.')
    with wave.open(str(normalized), 'rb') as audio:
        duration = audio.getnframes() / audio.getframerate()
        if not 0 < duration <= max_duration:
            raise ValueError('Decoded audio duration exceeds the limit.')
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) != (2, 2, 44100):
            raise ValueError('Decoded audio format is invalid.')
    return normalized


def run_job(job_id: str, model: str, source: Path) -> None:
    folder = source.parent
    try:
        update(job_id, status='running', stage='Validating audio')
        normalized = normalize_audio(source)
        update(job_id, stage='Separating stems (model download may be required)')
        environment = os.environ.copy()
        environment.setdefault('OMP_NUM_THREADS', '4')
        environment.setdefault('MKL_NUM_THREADS', '4')
        command = [sys.executable, '-m', 'demucs', '-n', model, '--shifts', '0', '--segment', '7', '-d', os.environ.get('MOZZART_DEVICE', 'cpu'), '-o', str(folder / 'separated'), str(normalized)]
        with (folder / 'engine.log').open('w', encoding='utf-8') as log:
            result = subprocess.run(command, stdout=log, stderr=log, timeout=7200, env=environment)
        if result.returncode:
            raise ValueError('Demucs failed. Check the local engine.log, model availability and runtime dependencies.')
        stems = sorted((folder / 'separated' / model / 'input').glob('*.wav'))
        expected = {'vocals', 'drums', 'bass', 'other'} | ({'guitar', 'piano'} if model == 'htdemucs_6s' else set())
        if {p.stem for p in stems} != expected:
            raise ValueError('Engine did not produce the expected stem set.')
        output = folder / 'outputs'
        output.mkdir()
        for stem in stems:
            shutil.move(str(stem), str(output / stem.name))
        with zipfile.ZipFile(output / 'stems.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
            for path in output.glob('*.wav'):
                archive.write(path, path.name)
        files = [OutputFile(name=p.name, url=f'/api/jobs/{job_id}/files/{p.name}') for p in sorted(output.iterdir())]
        update(job_id, status='succeeded', stage='Complete', progress=100.0, files=files)
    except Exception as error:
        update(job_id, status='failed', stage='Failed', error=str(error)[:500])


@app.get('/api/health')
def health() -> dict[str, object]:
    return {'status': 'ok', 'demucs': importlib.util.find_spec('demucs') is not None, 'ffmpeg': shutil.which('ffmpeg') is not None, 'ffprobe': shutil.which('ffprobe') is not None, 'device': os.environ.get('MOZZART_DEVICE', 'cpu')}


try:
    from .chord_detection import ChordAnalysis, analyze_chords
except ImportError:
    from chord_detection import ChordAnalysis, analyze_chords


CHORD_MAX_DURATION = 120
chord_slots = threading.BoundedSemaphore(1)


@app.post('/api/chords', response_model=ChordAnalysis)
def detect_chords(file: UploadFile = File(...)) -> ChordAnalysis:
    if not chord_slots.acquire(blocking=False):
        file.file.close()
        raise HTTPException(429, 'Chord analysis capacity reached. Retry later.')
    try:
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
            raise HTTPException(503, 'Install FFmpeg and ffprobe in the API runtime.')
        suffix = Path(file.filename or '').suffix.lower()
        if suffix not in {'.wav', '.mp3', '.flac', '.m4a'}:
            raise HTTPException(415, 'Use WAV, MP3, FLAC or M4A.')
        with tempfile.TemporaryDirectory(prefix='chord-analysis-') as folder:
            source = Path(folder) / ('upload' + suffix)
            total = 0
            with source.open('wb') as output:
                while chunk := file.file.read(1024 * 1024):
                    total += len(chunk)
                    if total > LIMIT:
                        raise HTTPException(413, 'Maximum file size is 100 MiB.')
                    output.write(chunk)
            if not total:
                raise HTTPException(422, 'Empty audio file.')
            return analyze_chords(normalize_audio(source, CHORD_MAX_DURATION))
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    finally:
        file.file.close()
        chord_slots.release()


@app.post('/api/jobs', response_model=Job, status_code=202)
async def create_job(file: UploadFile = File(...), model: str = Form('htdemucs')) -> Job:
    if model not in MODELS:
        raise HTTPException(422, 'Unsupported model.')
    suffix = Path(file.filename or '').suffix.lower()
    if suffix not in {'.wav', '.mp3', '.flac', '.m4a'}:
        raise HTTPException(415, 'Use WAV, MP3, FLAC or M4A.')
    if not health()['demucs'] or not health()['ffmpeg'] or not health()['ffprobe']:
        raise HTTPException(503, 'Install Demucs and FFmpeg in the API runtime. See INFERENCE.md.')
    prune()
    with lock:
        if sum(j.status in ('queued', 'running') for j in jobs.values()) >= 4:
            raise HTTPException(429, 'Local queue is full. Wait for a job to finish.')
        job_id = uuid.uuid4().hex
        jobs[job_id] = Job(id=job_id)
    folder = ROOT / job_id
    try:
        folder.mkdir()
        source = folder / ('upload' + suffix)
        total = 0
        with source.open('wb') as stream:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > LIMIT:
                    raise HTTPException(413, 'Maximum file size is 100 MiB.')
                stream.write(chunk)
        if total == 0:
            raise HTTPException(422, 'Empty audio file.')
        update(job_id, stage='Queued')
        executor.submit(run_job, job_id, model, source)
        return snapshot(job_id)
    except BaseException:
        with lock:
            jobs.pop(job_id, None)
        shutil.rmtree(folder, ignore_errors=True)
        raise
    finally:
        await file.close()


@app.get('/api/jobs/{job_id}', response_model=Job)
def get_job(job_id: str) -> Job:
    return snapshot(job_id)


@app.get('/api/jobs/{job_id}/events')
async def events(job_id: str) -> StreamingResponse:
    snapshot(job_id)
    async def stream():
        previous = ''
        while True:
            job = snapshot(job_id)
            data = job.model_dump_json()
            if data != previous:
                yield f'data: {data}\n\n'
                previous = data
            else:
                yield ': heartbeat\n\n'
            if job.status in ('failed', 'succeeded'):
                break
            await asyncio.sleep(1)
    return StreamingResponse(stream(), media_type='text/event-stream', headers={'Cache-Control': 'no-cache'})


@app.get('/api/jobs/{job_id}/files/{filename}')
def download(job_id: str, filename: str) -> FileResponse:
    job = snapshot(job_id)
    if job.status != 'succeeded' or filename not in {f.name for f in job.files}:
        raise HTTPException(404, 'Output not found.')
    path = (ROOT / job_id / 'outputs' / filename).resolve()
    if path.parent != (ROOT / job_id / 'outputs').resolve() or not path.is_file():
        raise HTTPException(404, 'Output not found.')
    return FileResponse(path, filename=filename)


# Restore only completed records. Interrupted work is not silently resumed.
for record in ROOT.glob('*/job.json'):
    try:
        restored = Job.model_validate_json(record.read_text(encoding='utf-8'))
        if restored.id != record.parent.name or len(restored.id) != 32:
            continue
        if restored.status in ('queued', 'running'):
            restored = restored.model_copy(update={'status': 'failed', 'stage': 'Interrupted', 'error': 'API restarted during this job. Upload again.'})
        jobs[restored.id] = restored
    except (ValueError, OSError):
        continue
prune()
