# Mozzart Studio local development

The original ChordApp remains at the repository root. The new studio uses frontend/ and backend/. See PRD.md for the recovered brief and SPEC.md for the bounded first delivery. This is not yet the complete seven-module product.

## Requirements

Python 3.11, Node.js 22.12+ or 24, uv, FFmpeg on PATH. NVIDIA CUDA is optional. Model weights require an initial download. Source separation does not detect chords or produce MIDI.

## Setup (PowerShell, repository root)

```powershell
uv venv .venv --python 3.11
uv pip install --python .venv/Scripts/python.exe -r backend/requirements.txt
cd frontend
npm ci
cd ..
```

See INFERENCE.md for the inference environment and model configuration. Install a matched torch/torchaudio pair rather than combining incompatible versions. A missing inference engine must surface as an error, not simulated output.

## Start

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./start-studio.ps1
```

The launcher starts the loopback API on port 8765, checks /api/health, then runs Vite on port 5174. Ctrl+C stops the API process created by this launcher. If using a different Python environment, pass -Python with its absolute executable path. Do not expose the service publicly without authentication, quotas and storage isolation.

Manual equivalent in separate terminals:

```powershell
.venv/Scripts/python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8765
```

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Open http://127.0.0.1:5174. Use only audio you have the right to process. Start with a short WAV before attempting a full song. Uploaded audio is processed by this backend; using a remote backend sends the audio to that server.

## Frontend checks

```powershell
cd frontend
npm test
npm run build
```

Verified inference baseline: Python 3.11, torch 2.5.1+cpu and torchaudio 2.5.1+cpu, Demucs htdemucs, 2-second stereo synthetic input. Four 44.1 kHz WAV stems were produced. This baseline is CPU-only: the installed inference runtime does not use the available NVIDIA GPU. CUDA throughput and full-song GPU memory remain untested.

Real separation quality and full-song GPU memory use require representative audio evaluation; a short synthetic fixture establishes execution only. Browser interaction, API tests and model inference are separate verification gates.

No automatic commit, push or deployment is performed by these commands.
