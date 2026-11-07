# Third-party components in the voice image

| Component | Version | Licence | Source |
|---|---|---|---|
| Thorsten-Voice/Kokoro (Kokoro-82M fine-tuned on the Thorsten dataset) | revision 734e593 (`model.pth`, `voices/thorsten.pt`) | Apache-2.0; dataset CC0 | https://huggingface.co/Thorsten-Voice/Kokoro · https://github.com/thorstenMueller/Thorsten-Voice |
| Kokoro-82M (base model and architecture) | — | Apache-2.0 | https://huggingface.co/hexgrad/Kokoro-82M |
| kokoro (model code, used only to export ONNX at build time) | semidark/kokoro @ b96fef9 | Apache-2.0 | https://github.com/semidark/kokoro |
| misaki (German G2P) | semidark/misaki @ 6d252a2 | Apache-2.0 | https://github.com/semidark/misaki |
| phonemizer-fork | 3.3.2 | GPL-3.0 | https://github.com/thewh1teagle/phonemizer-fork |
| espeak-ng (phonemes, bundled in espeakng-loader) | 1.52.0 via espeakng-loader 0.2.4 | GPL-3.0-or-later | https://github.com/espeak-ng/espeak-ng |
| onnxruntime | 1.31.1 | MIT | https://github.com/microsoft/onnxruntime |
| PyTorch (export stage only, not in the image) | 2.15.0 | BSD-3-Clause | https://github.com/pytorch/pytorch |
| LAME | Debian bookworm package | LGPL-2.0 | https://lame.sourceforge.io |

The voice service is a separate program (its own container, talked to over HTTP); the wieisses
application does not link against espeak-ng or phonemizer.

Until 2026-11-07 the image used Piper (piper-tts, GPL-3.0) with the `de_DE-thorsten-high` model,
which was fine-tuned from a voice with non-commercially licensed source recordings. The Kokoro
model has no such restriction.

Exact Python package versions installed in the image are listed in `/voice/installed.txt`.
