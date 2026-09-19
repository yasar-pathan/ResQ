# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder

WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser

COPY --from=builder /install /usr/local
COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
COPY tests ./tests
COPY pytest.ini .
COPY pyproject.toml .
COPY docker ./docker

RUN chmod +x /app/docker/worker-entrypoint.sh \
    && chown -R appuser:appuser /app

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

USER appuser

EXPOSE 8000 8081

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
