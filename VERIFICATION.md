# Mozzart Studio — verification checkpoint

Status: local separation slice verified with a short synthetic fixture; full M1 NOT complete. No commit, push or deployment performed.

## Executed checks

- Frontend `npm test`: 2 passed, 0 failed. Tests cover mute/solo predicates and shared-clock offset/clamping, not audible output quality.
- Frontend `npm run build`: `tsc --noEmit` passed; Vite 7.3.7 built 32 modules in 789 ms. JS 233.12 kB (73.51 kB gzip), CSS 4.14 kB (1.50 kB gzip).
- Backend pytest from an isolated workspace: 7 passed in 1.42 s; one Starlette/httpx TestClient deprecation warning. These tests are outside the repository and are not a portable committed suite yet.
- Live API health: status ok, demucs true, ffmpeg true, ffprobe true, device cpu.
- Real inference job 045cbf49083e40bc8baef3e9b601b3dc succeeded. ZIP contained bass.wav, drums.wav, other.wav and vocals.wav. Each file had 88,200 frames, 44,100 Hz, two channels (two seconds). This proves execution/format only, not musical separation quality.
- Browser interaction log: four tracks loaded; play, mute, solo and stop controls exercised; five download links present. The displayed play clock remained 0:00 in the captured log: sustained audible playback and advancing time are NOT proven by this log.
- Browser DOM checks at widths 375/768/1440: document scrollWidth 360/753/1425 respectively, no horizontal overflow observed. Runtime exceptions [], HTTP responses >=400 []. Cold production performance was not measured. One local dev navigation reported DOMContentLoaded 190.8 ms, load 191.6 ms.
- Screenshot recapture hung and was stopped by command timeout; a DOM-only rerun passed. Complete visual approval remains outstanding.
- `npm audit --omit=dev --json`: zero known production dependency advisories. Dev dependencies and Python dependencies were not covered; this is not a security approval.
- Git whitespace check and PowerShell launcher parser previously returned exit 0. Full launcher lifecycle has not been exercised; current API and frontend were started separately.

## Static audit findings and limitations

1. Local-only security boundary: no authentication, request origin/host enforcement or per-user isolation is implemented in backend/app.py:119-156. Keep API bound to 127.0.0.1; do not expose publicly. Multipart parsing occurs before the handler's 100 MiB counter (backend/app.py:120,139-144), so this is not a complete request-body/temporary-disk quota. Independent security review remains pending.
2. Retention is destructive after 24 hours, runs at startup and before uploads, and excludes only queued/running jobs (backend/app.py:62-71,128,205). Saved-project pinning is absent. Do not treat outputs as permanent storage.
3. Metadata uses JSON files and an in-memory index (backend/app.py:45-59,194-205), not the planned SQLite store. Writes are not atomic. Interrupted jobs become failed on startup; work is not resumed. Use one API process only.
4. Inference is a subprocess coordinated by one ThreadPoolExecutor worker (backend/app.py:27,92-94,148); not a durable external job queue. No cancellation endpoint; full-song throughput/resource limits remain unverified.
5. Health checks detect installed tools/modules, not successful model loading (backend/app.py:114-116). Six-stem model is offered but not runtime-verified.
6. CPU baseline only. CUDA acceleration, GPU memory, representative full-band quality and 20-minute workloads have not been tested.
7. URL ingestion, timestamped chords, editable guitar diagrams and MIDI remain unavailable. They were not reclassified as completed criteria.
8. Browser reload/resume, SSE interruption recovery, keyboard/screen-reader operation and sustained synchronized audible playback need further QA.

## Reproduce

From frontend/: `npm ci`, `npm test`, `npm run build`.

Install backend dependencies and the matched inference stack following STUDIO.md and INFERENCE.md. Start API from repository root: `.venv/Scripts/python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8765`.

Start frontend separately: `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort` from frontend/.

Happy path: POST multipart file=<valid short stereo WAV>, model=htdemucs to /api/jobs; observe GET /api/jobs/{id} or /events until succeeded; download and decode every returned WAV and inspect ZIP integrity.

Edge cases: empty WAV upload; non-audio suffix; corrupt .wav; unsupported model; unknown job/file; upload larger than 100 MiB; audio longer than 1,200 seconds; queue saturation; API restart during a job. Resource-heavy boundary cases should run in an isolated workspace, not production storage.

## Handoff inventory

Implementation: backend/app.py, backend/requirements.txt; frontend/src/App.tsx, main.tsx, styles.css, api.ts, Multitrack.tsx, mixer.ts, mixer.test.ts; frontend/index.html and build manifests. Supporting documents: PRD.md, SPEC.md, STUDIO.md, INFERENCE.md, start-studio.ps1, .gitignore.

## Independent review received after checkpoint

Result: FAIL (static read-only review, not an exploit reproduction or runtime regression run). Functional test passes above remain valid, but do not establish readiness.

Outstanding findings:
- Medium: ffprobe metadata is the only duration gate; normalized FFmpeg output has no explicit duration/size cap or post-decode validation (backend/app.py:78-85).
- Medium: FFmpeg/ffprobe input protocols and demuxers are not explicitly restricted; disguised playlist/external-reference inputs require mitigation and safe reproduction (backend/app.py:78-85).
- Medium: upload limit is applied after multipart spooling (backend/app.py:119-143).
- Medium: folder.mkdir occurs outside cleanup after queue reservation, risking a permanently queued record if directory creation fails (backend/app.py:133-137).
- Medium: launcher stops only the API PID; descendant inference-process cleanup is not guaranteed (start-studio.ps1:31-32).
- Medium: interval polling can overlap and apply stale responses (frontend/src/App.tsx:17).
- Low: readiness UI omits ffprobe although API requires it (frontend/src/App.tsx:12).

Additional recommendations: tolerate prune/delete failures and active downloads; abort WAV fetches on unmount/failure; bound subprocess logs; retain single-process API deployment. Download allowlist and resolved-parent containment were assessed positively (backend/app.py:183-191).

## Remediation checkpoint (2026-11-02)

The findings above describe the original reviewed version, not the current source. Remediation is in progress; independent runtime sign-off remains absent.

- Backend raw-body boundary now checks declared and received bytes before multipart parsing, with four upload slots and a 120-second receive timeout (backend/app.py:34-83). The total request allowance is 101 MiB; the file allowance remains 100 MiB.
- Normalization now restricts input protocols/demuxers, caps output duration/bytes, and validates decoded WAV duration and format (backend/app.py:136-158).
- Folder creation is now inside queue-reservation cleanup (backend/app.py:214-236).
- Frontend polling is serial and aborts obsolete requests; readiness includes ffprobe (frontend/src/App.tsx:12-33). Five temporary regression tests were independently rerun after receiving the worker result: all passed (495 ms total runner time). They cover missing ffprobe, serial polling, cleanup/late responses, terminal status, WAV unmount cancellation, and sibling cancellation on failure. The controlled hook/timer harness is not a browser test.
- Launcher now targets owned process trees with taskkill /T (start-studio.ps1:32-45). Isolated process fixtures verified that both launched trees terminate, an unrelated sentinel survives, and cleanup tolerates already-exited or absent processes. The PowerShell parser reported zero errors. Evidence was read back from the worker's after.log:19-25. This verifies the cleanup block, not a complete Studio launch/Ctrl+C/inference session.

Executed after the backend patches:
- Backend regression: 13 passed, one Starlette/httpx deprecation warning, 1.41 seconds. Six hardening tests plus seven existing API tests; harnesses currently remain outside the repository.
- Frontend: two mixer tests passed; TypeScript and production build passed. Vite built 32 modules; JavaScript 233.59 kB, 73.68 kB gzip. These mixer tests do not cover polling; the separate five-test controlled regression harness described above does.
- Real API-driven CPU inference succeeded with cached htdemucs weights in 15.062 seconds. All four downloaded WAVs decoded as stereo 44,100 Hz, 88,200 frames, two seconds and 352,844 bytes each. ZIP integrity and exact four-member inventory passed. The synthetic fixture proves execution and artifact integrity, not musical quality or full-song capacity.

Independent backend re-review returned PASS with limitations for the three targeted areas: pre-parser upload bounds (backend/app.py:41-83), bounded/restricted normalization (backend/app.py:136-159), and queue cleanup (backend/app.py:208-235). The reviewer reported rerunning both harnesses (13 passed), plus additional executor-failure/cancellation/semaphore and real WAV checks. These additional inline checks are reviewer-reported, not independently rerun by the parent. No confirmed bypass was found within that scope; this is not a general security approval. Parallel real-HTTP load and a broad malicious-media corpus were not tested. Separate parent-run synthetic Demucs inference is documented above.

Browser revalidation and full launcher lifecycle testing remain open. No commit, push or deployment was performed. Full M1 acceptance remains incomplete.
