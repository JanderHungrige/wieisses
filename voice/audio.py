"""Trimming the silence the voice model leaves around speech (doc 01, "Clip audio is trimmed").

The model starts and ends every clip with 0.2-0.3 s of silence. Spoken one after another (a composed
sentence, a question and its answer), those add up to audible gaps, so they are cut short.
"""

import array
import io
import sys
import wave

FULL_SCALE = 32767


def trim_silence(pcm, rate, head_ms=20, tail_ms=50, threshold=0.02, fade_ms=5):
    """16-bit mono PCM with the silence before and after the speech cut to head_ms / tail_ms.

    A sample is speech when its magnitude exceeds `threshold` of full scale. Both ends get a
    short linear fade so a cut never clicks. An all-silent clip is returned unchanged.
    """
    samples = array.array("h")
    samples.frombytes(pcm)
    if sys.byteorder == "big":  # WAV data is little-endian
        samples.byteswap()
    limit = threshold * FULL_SCALE
    first = next((i for i, s in enumerate(samples) if abs(s) > limit), None)
    if first is None:
        return pcm
    last = next(i for i in range(len(samples) - 1, -1, -1) if abs(samples[i]) > limit)
    start = max(0, first - rate * head_ms // 1000)
    end = min(len(samples), last + 1 + rate * tail_ms // 1000)
    out = samples[start:end]
    fade = min(len(out) // 2, rate * fade_ms // 1000)
    for i in range(fade):
        gain = i / fade
        out[i] = round(out[i] * gain)
        out[-1 - i] = round(out[-1 - i] * gain)
    if sys.byteorder == "big":
        out.byteswap()
    return out.tobytes()


def trim_wav(data):
    """A 16-bit mono WAV file with its silence trimmed; any other format is returned unchanged."""
    with wave.open(io.BytesIO(data), "rb") as src:
        params = src.getparams()
        frames = src.readframes(params.nframes)
    if params.sampwidth != 2 or params.nchannels != 1:
        return data
    out = io.BytesIO()
    with wave.open(out, "wb") as dst:
        dst.setparams(params)
        dst.writeframes(trim_silence(frames, params.framerate))
    return out.getvalue()
