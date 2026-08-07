FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py ./server.py
COPY migrations ./migrations
COPY scripts ./scripts

RUN useradd --create-home --uid 10001 perfurm && chown -R perfurm:perfurm /app
USER perfurm

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=3)"

CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --limit-concurrency ${UVICORN_LIMIT_CONCURRENCY:-512} --backlog ${UVICORN_BACKLOG:-2048} --proxy-headers --forwarded-allow-ips='*'"]
