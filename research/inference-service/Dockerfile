FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    MPLCONFIGDIR=/tmp/matplotlib \
    YOLO_CONFIG_DIR=/tmp/Ultralytics \
    INFERENCE_ENV=production \
    INFERENCE_HOST=0.0.0.0 \
    INFERENCE_PORT=8000 \
    INFERENCE_LOG_LEVEL=info \
    INFERENCE_LIMIT_CONCURRENCY=8 \
    INFERENCE_MAX_UPLOAD_MB=20 \
    INFERENCE_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

WORKDIR /app

# opencv-python needs these runtime libraries on Debian slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libgl1 \
       libglib2.0-0 \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY research/inference-service/requirements.txt /tmp/requirements.txt

# Prefer CPU wheels for the production research service so the image does not
# depend on CUDA. If this exact future wheel pair is not available on the CPU
# index in your Docker environment, remove this RUN line and let the next RUN
# install the pinned PyPI packages, then we will optimize image size separately.
RUN python -m pip install --upgrade pip \
    && python -m pip install \
       --index-url https://download.pytorch.org/whl/cpu \
       torch==2.13.0 torchvision==0.28.0 \
    && python -m pip install -r /tmp/requirements.txt

# Preserve the same repository-relative layout used by the working service.
COPY research/inference-service/app.py /app/research/inference-service/app.py
COPY research/inference-service/config.py /app/research/inference-service/config.py
COPY research/inference-service/observability.py /app/research/inference-service/observability.py
COPY research/inference-service/security.py /app/research/inference-service/security.py
COPY research/malaria-validation/outputs/frozen-models/ \
     /app/research/malaria-validation/outputs/frozen-models/

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app /home/appuser

USER appuser

EXPOSE 8000

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:' + __import__('os').environ.get('INFERENCE_PORT','8000') + '/ready', timeout=3).read()" || exit 1

CMD ["sh", "-c", "python -m uvicorn app:app --app-dir research/inference-service --host ${INFERENCE_HOST:-0.0.0.0} --port ${INFERENCE_PORT:-8000} --log-level ${INFERENCE_LOG_LEVEL:-info} --workers 1 --limit-concurrency ${INFERENCE_LIMIT_CONCURRENCY:-8} --timeout-keep-alive 5"]
