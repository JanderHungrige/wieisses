"""Tests for the pure parts of kokoro_voice (doc 01, "Voice (Thorsten)"). Run: python -m unittest test_kokoro_voice"""
import array
import unittest

import numpy as np

from kokoro_voice import CHUNK, speed_for, split_phonemes, to_pcm16, to_tokens


class Speed(unittest.TestCase):
    def test_the_kiosk_default_rate_speaks_at_kokoros_own_pace(self):
        self.assertEqual(speed_for(1.11), 1.0)

    def test_a_faster_rate_speaks_faster_and_a_slower_one_slower(self):
        self.assertGreater(speed_for(0.77), 1.4)  # speech rate 1.3
        self.assertLess(speed_for(1.67), 0.7)  # speech rate 0.6


class Tokens(unittest.TestCase):
    def test_maps_known_phonemes_and_drops_unknown_ones(self):
        self.assertEqual(to_tokens("haʊ?", {"h": 1, "a": 2, "ʊ": 3, "?": 4}), [1, 2, 3, 4])
        self.assertEqual(to_tokens("hʏ", {"h": 1}), [1])


class Split(unittest.TestCase):
    def test_short_phonemes_stay_one_chunk(self):
        self.assertEqual(split_phonemes(" vas ɪst das? "), ["vas ɪst das?"])

    def test_long_phonemes_are_cut_after_a_sentence_mark_and_never_exceed_the_limit(self):
        text = ("ʃøːnəs vɛtɐ. " * 60).strip()
        chunks = split_phonemes(text)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(c) <= CHUNK for c in chunks))
        self.assertTrue(all(c.endswith(".") for c in chunks))
        self.assertEqual(" ".join(chunks), text)

    def test_prefers_a_sentence_end_over_a_later_comma(self):
        text = "a" * 120 + ". " + "b" * 50 + ", " + "c" * 100
        self.assertEqual(split_phonemes(text)[0], "a" * 120 + ".")

    def test_cuts_at_a_space_or_hard_when_there_is_no_mark(self):
        self.assertTrue(all(len(c) <= 20 for c in split_phonemes("aaaa " * 20, limit=20)))
        self.assertEqual(split_phonemes("a" * 45, limit=20), ["a" * 20, "a" * 20, "a" * 5])


class Pcm(unittest.TestCase):
    def test_peak_normalises_to_full_scale(self):
        samples = array.array("h")
        samples.frombytes(to_pcm16(np.array([0.0, 0.1, -0.25, 0.05], dtype=np.float32)))
        self.assertEqual(list(samples), [0, 13106, -32767, 6553])

    def test_leaves_silence_silent(self):
        self.assertEqual(to_pcm16(np.zeros(4, dtype=np.float32)), bytes(8))


if __name__ == "__main__":
    unittest.main()
