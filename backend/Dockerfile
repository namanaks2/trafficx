FROM python:3.11-slim

WORKDIR /app

# System deps for cassandra-driver
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libssl-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir cassandra-driver==3.29.2
COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
