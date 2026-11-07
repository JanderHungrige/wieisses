# Thorsten-Voice service for wieisses: Thorsten-Voice/Kokoro (Kokoro-82M fine-tuned on the
# Thorsten dataset) run by onnxruntime, MP3 via lame. Internal only — the app reaches it as
# http://voice:5000 on the compose network.
#   docker build -t wieisses-voice voice/
ARG PYTHON_VERSION=3.12.16-slim-bookworm

# ── Export: the pinned PyTorch checkpoint -> ONNX. PyTorch never reaches the runtime image. ──
FROM python:${PYTHON_VERSION} AS export

ENV PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /export
COPY requirements-export.txt ./
RUN pip install --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple \
    -r requirements-export.txt \
  && pip install --no-deps "kokoro @ https://github.com/semidark/kokoro/archive/b96fef95e6a746495f92443fac7c688f90fc57fc.zip"

# Model pinned to a Thorsten-Voice/Kokoro revision and checked against its sha256. In this
# revision model.pth and voices/thorsten.pt are the epoch-10 checkpoint (the README says epoch 5).
ARG MODEL_BASE=https://huggingface.co/Thorsten-Voice/Kokoro/resolve/734e593d320a3d876bede7020f773dfd481a0cc7
ADD --checksum=sha256:36dde15c4a800cfd1ab540ccb4476dbab604fe03ff7c937d976ebbf3b49e59ce \
  ${MODEL_BASE}/model.pth /export/source/model.pth
ADD --checksum=sha256:5abb01e2403b072bf03d04fde160443e209d7a0dad49a423be15196b9b43c17f \
  ${MODEL_BASE}/config.json /export/source/config.json
ADD --checksum=sha256:9d98b775ebce1cfc369e8f9a3ee8ee260cd612dffb477cba85749112362306d7 \
  ${MODEL_BASE}/voices/thorsten.pt /export/source/thorsten.pt

COPY export.py ./
RUN mkdir /export/out && python export.py /export/source /export/out && chmod 755 /export/out && chmod 644 /export/out/*

# ── Runtime ──
FROM python:${PYTHON_VERSION}

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
# Large buffers are mmapped and returned to the system when freed, so a long text's working memory
# does not stay with the process (see kokoro_voice.py; peak 535 MiB instead of 760 MiB).
ENV MALLOC_MMAP_THRESHOLD_=131072 MALLOC_TRIM_THRESHOLD_=131072 MALLOC_ARENA_MAX=2
RUN apt-get update \
  && apt-get install -y --no-install-recommends lame \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /voice
COPY requirements.txt ./
RUN pip install -r requirements.txt && pip freeze > /voice/installed.txt

COPY --from=export /export/out/ /voice/model/
COPY server.py audio.py kokoro_voice.py test_audio.py test_kokoro_voice.py THIRD_PARTY.md ./

# The image only exists if its audio code passes its tests and it can actually speak.
RUN python -m unittest -v test_audio test_kokoro_voice
RUN python -c "import server; mp3 = server.synthesize('Hallo, wie isses?', 1.11); assert len(mp3) > 2000, len(mp3); print('smoke test ok', len(mp3), 'bytes')"

# Not "voice": Debian already has a system group of that name.
RUN useradd --system --uid 10001 --no-create-home --user-group tts
USER tts
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5000/healthz', timeout=2).status == 200 else 1)"
CMD ["python", "server.py"]
