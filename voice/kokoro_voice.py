"""Thorsten-Voice/Kokoro run by onnxruntime (doc 01, "Voice (Thorsten)").

Text -> German phonemes (misaki's German G2P on espeak-ng) -> the model's token ids -> the ONNX
export of the model with Thorsten's style vector -> 24 kHz audio -> peak-normalised 16-bit PCM.
"""

import json

import numpy as np
import onnxruntime

RATE = 24000
# The model takes up to 510 phonemes at once, but its memory grows with the length of the audio:
# chunks of at most 200 (about 12 s of speech) keep the service inside its 768 MB limit.
CHUNK = 200
KIOSK_DEFAULT_SCALE = 1 / 0.9  # lengthScale at the kiosk's default speech rate 0.9


def speed_for(length_scale):
    """Kokoro's speed for the app's lengthScale (1 / speechRate).

    The kiosk's default rate 0.9 speaks at Kokoro's own pace (speed 1.0) — the pace the user
    chose in the listening test of 2026-11-07; faster or slower rates scale from there.
    """
    return round(KIOSK_DEFAULT_SCALE / length_scale, 2)


def to_tokens(phonemes, vocab):
    """The model's token ids for the phonemes; characters it does not know are dropped."""
    return [vocab[p] for p in phonemes if p in vocab]


def split_phonemes(phonemes, limit=CHUNK):
    """Chunks of at most `limit` phonemes, cut after a sentence mark, else a clause mark, else a
    space — whichever comes first in that order in the second half of the window — else hard."""
    chunks, rest = [], phonemes.strip()
    while len(rest) > limit:
        window = rest[:limit]
        cut = limit
        for marks in (".!?…", ";:,—", " "):
            at = max(window.rfind(mark) for mark in marks) + 1
            if at >= limit // 2:
                cut = at
                break
        chunks.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    if rest:
        chunks.append(rest)
    return chunks


def to_pcm16(audio):
    """Float audio peak-normalised to full scale, as 16-bit little-endian PCM.

    Piper normalised the same way; Kokoro's raw output is about 8 dB quieter.
    """
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 1e-6:
        audio = audio / peak
    return (np.clip(audio, -1.0, 1.0) * 32767).astype("<i2").tobytes()


class KokoroVoice:
    def __init__(self, model, styles, vocab, threads=1):
        # espeak-ng first: it is the cheap part to fail (phonemizer copies its library to TMPDIR and
        # loads it from there, so that directory must allow exec — see deploy/compose.app.yml).
        from misaki.de import DEG2P

        self.g2p = DEG2P()
        with open(vocab, encoding="utf-8") as source:
            self.vocab = json.load(source)
        self.styles = np.load(styles)  # (510, 1, 256): Thorsten's style vector per phoneme count
        options = onnxruntime.SessionOptions()
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        # No arena: onnxruntime would keep the largest text's working memory for good (measured:
        # 760 MiB after three texts). Freed buffers go straight back to the system instead (with
        # the MALLOC_* settings in the Dockerfile), so the service idles at ~380 MiB.
        options.enable_cpu_mem_arena = False
        self.session = onnxruntime.InferenceSession(model, sess_options=options, providers=["CPUExecutionProvider"])

    def phonemes(self, text):
        phonemes, _ = self.g2p(text)
        # The German G2P can emit short ü "ʏ", which is not in Kokoro's vocabulary (model README).
        return phonemes.replace("ʏ", "y")

    def synthesize(self, text, speed):
        """Text -> 16-bit mono PCM at RATE."""
        parts = []
        for chunk in split_phonemes(self.phonemes(text)):
            tokens = to_tokens(chunk, self.vocab)
            if not tokens:
                continue
            waveform = self.session.run(None, {
                "input_ids": np.array([[0, *tokens, 0]], dtype=np.int64),
                "style": self.styles[len(chunk) - 1].astype(np.float32),
                "speed": np.array([speed], dtype=np.float32),
            })[0]
            parts.append(waveform.reshape(-1))
        if not parts:
            raise ValueError("nothing to speak in this text")
        return to_pcm16(np.concatenate(parts))
