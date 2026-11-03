# Mozzart Studio: implementation contract

## 1. Repository migration
Update the existing ChordApp repository in place. Preserve root static rehearsal application while the new dashboard lives in frontend/ and the local API lives in backend/. No automatic commit, push, or deployment.

## 2. Milestone 1 vertical slice
React + strict TypeScript + Vite frontend. Python FastAPI local backend. Upload WAV, MP3, FLAC, M4A (100 MiB maximum), select htdemucs or htdemucs_6s, submit separation job, monitor status, download individual WAV files and ZIP. Actual Demucs inference only; missing dependencies show actionable errors, never synthetic stems. Multitrack transport uses a shared Web Audio clock with per-stem mute, solo and volume. Offline operation requires dependencies and model weights downloaded beforehand. Public URL ingestion requires internet and remains unavailable until hardened implementation and tests.

## 3. API
GET /api/health returns actual runtime capabilities.
POST /api/jobs accepts multipart file and model; returns job with id, status, stage, progress (number or null), error (string or null), files (array of name/url).
GET /api/jobs/{id} returns latest job snapshot.
GET /api/jobs/{id}/events streams SSE snapshots.
GET /api/jobs/{id}/files/{filename} serves only known files confined to the job directory.
Statuses: queued, running, succeeded, failed. Null progress means indeterminate; never fabricate a percentage. Client polling may act as reconnect fallback.

## 4. Lifecycle and privacy
Local backend binds loopback by default. Uploads are sent to the configured backend, not to model providers. Hosted deployment is not local-only privacy and requires authentication, quotas and isolated storage before public release. Scratch audio stays outside Git. Retention is 24 hours for inactive temporary jobs; active jobs are excluded. No API credentials in source. Existing songs.json remains untouched.

## 5. Outstanding acceptance criteria (not satisfied by this slice)
The agreed Milestone 1 remains incomplete until URL ingestion and timestamped chord detection with editable guitar SVG diagrams are implemented and verified. This separation slice is a partial delivery, not completion of the agreed milestone. Bass/vocal MIDI, key/BPM/loudness estimates, semantic structure segmentation and modules 3-7 are also not implied by separation completion. They require real engines, evaluation and export validation. Mark unavailable visibly. 480 PPQ SMF-1 requires tempo/loop tick tests. Mastering requires measured post-export true peak and loudness.

## 6. Verification
Run backend pytest with temporary workspaces outside repository, frontend strict typecheck and production build, and real runtime smoke requests. Report unavailable model inference separately from passing API tests. Preserve existing working files.
