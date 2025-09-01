# Galaxy AI RAG Service (Python)

## Quickstart

```bash
# 1) create venv
python3 -m venv .venv
source .venv/bin/activate

# 2) install deps
pip install -r requirements.txt

# 3) run
uvicorn main:app --host 0.0.0.0 --port 9090 --reload
```

Then set the Node server env:

```bash
export AI_SERVICE_URL=http://localhost:9090
```

The Node server proxies:
- POST /api/ai/search -> POST /rag/search
- GET  /api/ai/chat/stream -> GET /rag/chat/stream

Replace the demo logic in `main.py` with real embedding + vector search.

