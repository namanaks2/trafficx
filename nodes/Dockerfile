FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY edge_node.py ledger.py federated.py ./
CMD ["python", "edge_node.py"]
