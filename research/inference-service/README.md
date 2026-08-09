# Phase 5H-1 — Production Inference Packaging

Research-only production-style packaging for the frozen two-stage microscopy inference service.

## Frozen environment

- Python 3.12
- FastAPI 0.141.1
- Uvicorn 0.52.1
- python-multipart 0.0.32
- Ultralytics 8.4.115
- PyTorch 2.13.0
- torchvision 0.28.0
- Pillow 11.3.0
- NumPy 2.5.1
- OpenCV 5.0.0.93
- Pydantic 2.13.4

The application remains a research prototype and is not clinically validated.

## File placement

Copy these files into:

`research/inference-service/`

Do not replace `app.py`.

Files:

- `requirements.txt`
- `Dockerfile`
- `Dockerfile.dockerignore`
- `.dockerignore`
- `production.env.example`
- `smoke_test.py`
- `benchmark_inference.py`

## Native smoke test

Start the existing service from the repository root:

```cmd
research\focus-validation\.venv\Scripts\python.exe -m uvicorn app:app --app-dir research\inference-service --host 127.0.0.1 --port 8000
```

In another terminal:

```cmd
research\focus-validation\.venv\Scripts\python.exe research\inference-service\smoke_test.py
```

Expected result:

- healthy service
- 1600x1200 image
- 2 candidates
- ring present
- trophozoite present

## Native benchmark

```cmd
research\focus-validation\.venv\Scripts\python.exe research\inference-service\benchmark_inference.py --runs 10 --warmup 1
```

The script reports client-observed min/mean/median/p95/max latency and candidate counts.

## Docker build

Run from the repository root:

```cmd
docker build -f research\inference-service\Dockerfile -t microscope-inference:v2 .
```

The Dockerfile-specific ignore file keeps the large training datasets and unrelated web application files out of the build context.

## Docker run

```cmd
docker run --rm --name microscope-inference -p 8000:8000 --env-file research\inference-service\production.env.example microscope-inference:v2
```

Health test:

```cmd
curl http://127.0.0.1:8000/health
```

Model information:

```cmd
curl http://127.0.0.1:8000/model-info
```

## Docker regression test

Because the test script runs on the host and sends the local BBBC041 image to the container, run:

```cmd
research\focus-validation\.venv\Scripts\python.exe research\inference-service\smoke_test.py --base-url http://127.0.0.1:8000
```

## Next.js integration

For local development, keep:

```text
ML_INFERENCE_URL=http://127.0.0.1:8000
```

Restart Next.js after changing environment variables.

Then verify:

```cmd
curl http://localhost:3000/api/ml/health
```

## Production notes

- One Uvicorn worker is intentional because each worker would load a separate copy of both models.
- The current application already serializes model execution with a model lock; concurrency should therefore remain bounded.
- The container runs as a non-root user.
- The Docker health check uses `/health`.
- Frozen model artifacts and evaluation JSON files are copied into the image; training datasets are not.
- The service is research-only and not clinically validated.
- Review Ultralytics licensing before commercial distribution or client deployment.
