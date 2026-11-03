# Experimental chord upgrade

## Implementation

- POST /api/chords accepts multipart field `file`: WAV, MP3, FLAC or M4A, up to 100 MiB and 120 seconds. One analysis at a time; busy requests return 429.
- FFmpeg normalizes actual uploaded audio. FFT chroma templates estimate major/minor triads and N on a half-second grid. Adjacent identical labels merge. No model training or downloads.
- Home Show chords sends the selected stored audio only after Analyze audio. Timeline buttons seek the player; the active segment follows playback time. This browser interaction still needs live verification.
- Results are held in memory and reset on track changes, not persisted.

## Executed checks

- Frontend production build including strict TypeScript: passed.
- Node test suite: 11 passed, 0 failed.
- Backend unittest suite: 8 passed, 0 failed; C to Am synthetic progression, silence, corrupt input, size/duration boundaries, normalization source preservation, concurrency, missing FFmpeg, cleanup.
- Real HTTP through frontend proxy: 2-second C-major WAV returned C from 0 to 2 seconds.
- Corrupt WAV: HTTP 422. Unsupported TXT: HTTP 415.
- GET /api/health through proxy: status ok, ffmpeg true, ffprobe true, demucs false in the interpreter exercised.

The short generated fixtures prove execution and contract behavior, not full-band recognition quality. Confidence is template similarity, not calibrated accuracy.

## Running locally

From repository root, use a Python environment with backend/requirements.txt installed and FFmpeg/ffprobe on PATH:

```text
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8765
```

In another terminal:

```text
cd frontend
npm run dev -- --port 5174
```

Open http://127.0.0.1:5174/ . Import a short recording, select it, open Show chords and press Analyze audio.

Example HTTP request:

```text
curl -F "file=@clip.wav" http://127.0.0.1:8765/api/chords
```

For edge cases use a corrupt file named bad.wav (422), unsupported bad.txt (415), or a valid clip longer than 120 seconds (422).

## Outstanding acceptance gates

- Browser playback, modal focus, seek synchronization, mobile layout and refresh regressions have not been exercised in this upgrade session; browser connection was unavailable.
- Representative full-band songs have not been evaluated. Long songs over 120 seconds are rejected, not partially analyzed.
- Editable validated guitar diagrams and public URL ingestion remain outstanding from the original milestone.
- Demucs inference was not exercised in this interpreter.
- Independent frontend review found no confirmed blocking contract bug. Tab focus recovery when focus leaves enabled modal controls was added; actual browser focus behavior remains unverified. The standard npm test command now runs all 11 tests. Async track-switch race tests remain outstanding. No Tester or security sign-off, commit, push or deployment is claimed.

## Changed implementation files

backend/app.py
backend/chord_detection.py
backend/requirements.txt
frontend/src/App.tsx
frontend/src/chords.ts
frontend/src/chords.test.ts
frontend/src/useChords.ts
frontend/src/mozart-refinement.css

Existing unrelated repository changes were preserved.
