"""Thorsten-Voice service for wieisses (doc 01, "Voice (Thorsten)").

    GET  /healthz                              -> {"status": "ok", "voice": "thorsten-voice-kokoro"}
    POST /synthesize {"text", "lengthScale"}   -> audio/mpeg

Reachable only on the compose network. One synthesis at a time; the model (Thorsten-Voice/Kokoro
as ONNX, see kokoro_voice.py) is loaded on the first request and released after
VOICE_IDLE_SECONDS without one, so the memory it needs is only held while texts are voiced.
"""

import gc
import io
import json
import os
import subprocess
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import onnxruntime

from audio import trim_wav
from kokoro_voice import RATE, KokoroVoice, speed_for

MODEL_DIR = os.environ.get("VOICE_MODEL_DIR", "/voice/model")
VOICE_NAME = "thorsten-voice-kokoro"
IDLE_SECONDS = int(os.environ.get("VOICE_IDLE_SECONDS", "120"))
# As many inference threads as the container may use CPUs. onnxruntime's default — one per core
# it can see — makes threads queue for the 1-CPU quota and runs several times slower.
THREADS = int(os.environ.get("VOICE_THREADS", "1"))

onnxruntime.disable_telemetry_events()  # it would try to write a device id to a read-only disk
PORT = int(os.environ.get("PORT", "5000"))
MAX_TEXT = 400
MAX_BODY = 4096

_lock = threading.Lock()
_state = {"voice": None, "last": 0.0}


def log(msg, **fields):
    print(json.dumps({"time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "msg": msg, **fields}), flush=True)


def _load():
    return KokoroVoice(
        f"{MODEL_DIR}/kokoro-thorsten.onnx", f"{MODEL_DIR}/thorsten-styles.npy", f"{MODEL_DIR}/vocab.json", THREADS
    )


def _voice():
    if _state["voice"] is None:
        started = time.monotonic()
        _state["voice"] = _load()
        log("model loaded", seconds=round(time.monotonic() - started, 2), threads=THREADS)
    _state["last"] = time.monotonic()
    return _state["voice"]


def _release_when_idle():
    while True:
        time.sleep(15)
        with _lock:
            if _state["voice"] is not None and time.monotonic() - _state["last"] > IDLE_SECONDS:
                _state["voice"] = None
                gc.collect()
                log("model released")


def synthesize(text, length_scale):
    """Text -> MP3 bytes (mono, 48 kbit/s CBR), the silence around the speech trimmed."""
    with _lock:
        pcm = _voice().synthesize(text, speed_for(length_scale))
        _state["last"] = time.monotonic()
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm)
    # Constant bitrate: written to a pipe, a VBR file would lack the header that tells players
    # its length. 48 kbit/s mono is plenty for speech at 24 kHz.
    encoded = subprocess.run(
        ["lame", "--quiet", "-m", "m", "--cbr", "-b", "48", "-", "-"],
        input=trim_wav(buffer.getvalue()),
        stdout=subprocess.PIPE,
        check=True,
        timeout=60,
    )
    return encoded.stdout


def parse(body):
    """Validated (text, length_scale) or raises ValueError with a reason."""
    data = json.loads(body)
    if not isinstance(data, dict):
        raise ValueError("JSON object expected")
    text = data.get("text")
    scale = data.get("lengthScale", 1.0)
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= MAX_TEXT:
        raise ValueError(f"text must be 1-{MAX_TEXT} characters")
    if isinstance(scale, bool) or not isinstance(scale, (int, float)) or not 0.7 <= scale <= 1.7:
        raise ValueError("lengthScale must be 0.7-1.7")
    return text.strip(), float(scale)


class Handler(BaseHTTPRequestHandler):
    server_version = "wieisses-voice"

    def _send(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status, payload):
        self._send(status, json.dumps(payload).encode(), "application/json")

    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"status": "ok", "voice": VOICE_NAME})
        else:
            self._json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/synthesize":
            return self._json(404, {"error": "not_found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._json(413 if length > MAX_BODY else 400, {"error": "bad_body"})
        try:
            text, scale = parse(self.rfile.read(length))
        except (ValueError, json.JSONDecodeError) as err:
            return self._json(400, {"error": "validation", "message": str(err)})
        started = time.monotonic()
        try:
            mp3 = synthesize(text, scale)
        except Exception as err:  # noqa: BLE001 — report and keep serving
            log("synthesis failed", error=str(err))
            return self._json(500, {"error": "synthesis_failed"})
        log("synthesized", chars=len(text), bytes=len(mp3), seconds=round(time.monotonic() - started, 2))
        self._send(200, mp3, "audio/mpeg")

    def log_message(self, *_args):  # access lines would only repeat the "synthesized" log
        return


def main():
    threading.Thread(target=_release_when_idle, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    log("listening", port=PORT, model=VOICE_NAME)
    server.serve_forever()


if __name__ == "__main__":
    main()
