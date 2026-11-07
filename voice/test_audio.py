"""Tests for audio.trim_silence (doc 01, "Clip audio is trimmed"). Run: python -m unittest test_audio"""
import array
import io
import math
import unittest
import wave

from audio import trim_silence, trim_wav

RATE = 22050


def pcm(*parts):
    """16-bit mono PCM from (seconds, amplitude) parts; amplitude 0 is silence, else a 440 Hz tone."""
    samples = array.array("h")
    for seconds, amplitude in parts:
        n = round(seconds * RATE)
        samples.extend(round(amplitude * math.sin(2 * math.pi * 440 * i / RATE)) for i in range(n))
    return samples.tobytes()


def seconds(data):
    return len(data) / 2 / RATE


class TrimSilence(unittest.TestCase):
    def test_keeps_20_ms_before_and_50_ms_after_the_speech(self):
        out = trim_silence(pcm((0.5, 0), (0.3, 8000), (0.5, 0)), RATE)
        self.assertAlmostEqual(seconds(out), 0.02 + 0.3 + 0.05, delta=0.002)

    def test_noise_below_two_percent_of_full_scale_counts_as_silence(self):
        out = trim_silence(pcm((0.4, 300), (0.3, 8000), (0.4, 300)), RATE)
        self.assertAlmostEqual(seconds(out), 0.37, delta=0.002)

    def test_fades_in_and_out_so_a_cut_never_clicks(self):
        out = array.array("h")
        out.frombytes(trim_silence(pcm((0.3, 8000)), RATE))
        self.assertEqual(out[0], 0)
        self.assertEqual(out[-1], 0)
        self.assertGreater(max(abs(s) for s in out[len(out) // 2 - 100 : len(out) // 2 + 100]), 7000)

    def test_leaves_an_all_silent_clip_as_it_is(self):
        silent = pcm((0.5, 0))
        self.assertEqual(trim_silence(silent, RATE), silent)

    def test_returns_whole_16_bit_samples(self):
        out = trim_silence(pcm((0.2, 0), (0.1, 8000), (0.2, 0)), RATE)
        self.assertEqual(len(out) % 2, 0)


class TrimWav(unittest.TestCase):
    def test_trims_a_wav_file_and_keeps_its_format(self):
        source = io.BytesIO()
        with wave.open(source, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes(pcm((0.5, 0), (0.3, 8000), (0.5, 0)))
        with wave.open(io.BytesIO(trim_wav(source.getvalue())), "rb") as out:
            self.assertEqual((out.getnchannels(), out.getsampwidth(), out.getframerate()), (1, 2, RATE))
            self.assertAlmostEqual(out.getnframes() / RATE, 0.37, delta=0.002)


if __name__ == "__main__":
    unittest.main()
