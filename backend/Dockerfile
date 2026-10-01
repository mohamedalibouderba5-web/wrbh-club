FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts ./scripts
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA
ENV PYTHONPATH=/app
ENV ENVIRONMENT=production
ENV PYTHONIOENCODING=utf-8
EXPOSE 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
