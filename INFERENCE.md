# Source separation runtime

## Verified baseline

Python 3.11.15; Demucs 4.0.1; torch 2.5.1+cpu; torchaudio 2.5.1+cpu. FFmpeg must be on PATH. This CPU baseline produced four stereo 44.1 kHz WAV stems from a synthetic two-second input. It does not establish musical separation quality or GPU support.

To reproduce the baseline in a separate environment (PowerShell):

```powershell
uv venv .venv --python 3.11
uv pip install --python .venv/Scripts/python.exe torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu
uv pip install --python .venv/Scripts/python.exe demucs==4.0.1
uv pip install --python .venv/Scripts/python.exe -r backend/requirements.txt
```

A matched pair avoids newer torchaudio releases requiring a different audio codec stack. Do not install the CPU pair if configuring a CUDA environment; obtain matching CUDA wheels from the official PyTorch installation matrix instead. CUDA installation and benchmarking remain unverified here.

## First download and offline use

Demucs loads model weights on first use. The download requires internet; later use can work offline when the selected model is cached. htdemucs and htdemucs_6s have different weights. Availability of one does not prove the other is cached. TORCH_HOME controls the cache location and must be inherited by the API process if using a previously prepared cache.

## Troubleshooting

- Missing engine: install Demucs into the exact Python environment used by the API, not another system interpreter.
- Missing FFmpeg: install it and start a fresh terminal after updating PATH.
- CUDA unavailable: inspect torch.cuda.is_available(); an NVIDIA GPU alone does not make a CPU-only torch wheel CUDA-capable.
- Long CPU latency: use short clips initially. The tested two-second fixture took about 121 seconds including initial model loading and download; this is not a steady-state performance benchmark.
- htdemucs_6s: API option only until its separate inference path has been exercised. Do not infer six-stem quality from a four-stem test.

## Upstream references

Demucs source and model instructions: https://github.com/facebookresearch/demucs
PyTorch installation matrix: https://pytorch.org/get-started/locally/

Model licensing and rights to uploaded music must be reviewed before redistribution or commercial deployment. This repository does not grant rights to third-party recordings.
