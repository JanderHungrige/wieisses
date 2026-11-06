# Third-party components in the voice image

| Component | Version | Licence | Source |
|---|---|---|---|
| piper-tts (Piper, OHF-Voice/piper1-gpl) | 1.8.0 | GPL-3.0-or-later | https://github.com/OHF-Voice/piper1-gpl |
| espeak-ng (phonemes, bundled in the piper-tts wheel) | — | GPL-3.0-or-later | https://github.com/espeak-ng/espeak-ng |
| onnxruntime | 1.31.1 | MIT | https://github.com/microsoft/onnxruntime |
| Thorsten voice model `de_DE-thorsten-high` | piper-voices @ e7229f7 | model: MIT (piper-voices); dataset: CC0 | https://huggingface.co/rhasspy/piper-voices · https://github.com/thorstenMueller/Thorsten-Voice |
| LAME | Debian bookworm package | LGPL-2.0 | https://lame.sourceforge.io |

The voice service is a separate program (its own container, talked to over HTTP); the wieisses
application does not link against Piper or espeak-ng.

**Note on the model:** the Thorsten "high" model was fine-tuned from the US-English "lessac"
voice, whose source recordings come from the Blizzard Challenge 2013 under a non-commercial
licence. The Thorsten-Voice dataset itself is CC0. Use for a school's own survey is fine; check
before any commercial use.

Exact Python package versions installed in the image are listed in `/voice/installed.txt`.
