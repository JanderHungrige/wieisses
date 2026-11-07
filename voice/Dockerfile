# Thorsten-Voice service for wieisses: Piper (piper-tts) with the Thorsten "high" model, MP3 via lame.
# Internal only — the app reaches it as http://voice:5000 on the compose network.
#   docker build -t wieisses-voice voice/
ARG PYTHON_VERSION=3.12.16-slim-bookworm
FROM python:${PYTHON_VERSION}

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends lame \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /voice
COPY requirements.txt ./
RUN pip install -r requirements.txt && pip freeze > /voice/installed.txt

# Model pinned to a piper-voices revision and checked against its sha256.
ARG MODEL_BASE=https://huggingface.co/rhasspy/piper-voices/resolve/e7229f7d33a10e145e109b886d661984201ac3c4/de/de_DE/thorsten/high
ADD --chmod=644 --checksum=sha256:9df1c43c61149ef9b39e618e2b861fbe41e1fcea9390b2dac62e8761573ea4f1 \
  ${MODEL_BASE}/de_DE-thorsten-high.onnx /voice/de_DE-thorsten-high.onnx
ADD --chmod=644 --checksum=sha256:6de734444e4c3f9e33b7ebe2746dbc19b71e85f613e79c65acf623200b99a76a \
  ${MODEL_BASE}/de_DE-thorsten-high.onnx.json /voice/de_DE-thorsten-high.onnx.json

COPY server.py audio.py test_audio.py THIRD_PARTY.md ./

# The image only exists if its silence trimming passes its tests and it can actually speak.
RUN python -m unittest -v test_audio
RUN python -c "import server; mp3 = server.synthesize('Hallo, wie isses?', 1.0); assert len(mp3) > 2000, len(mp3); print('smoke test ok', len(mp3), 'bytes')"

# Not "voice": Debian already has a system group of that name.
RUN useradd --system --uid 10001 --no-create-home --user-group tts
USER tts
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5000/healthz', timeout=2).status == 200 else 1)"
CMD ["python", "server.py"]
