import os
import json
import time
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import FakeEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from http import HTTPStatus

# ---------- Config ----------
DATA_DIR = os.getenv("DATA_DIR", "/app/data")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
VECTOR_DIR = os.getenv("VECTOR_DIR", "/app/data/chroma")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-v4")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1024"))
TOPK_DEFAULT = int(os.getenv("TOPK_DEFAULT", "20"))
SCORE_THRESHOLD = float(os.getenv("SCORE_THRESHOLD", "0.0"))
LLM_MODEL = os.getenv("LLM_MODEL", "qwen-turbo")
LLM_SYSTEM_PROMPT = os.getenv(
    "LLM_SYSTEM_PROMPT",
    (
        "你是一个资深的软件包检索优化助手。已给出用户问题与初步检索结果，请你：\n"
        "1) 按相关性与实用性对候选结果进行重排序；\n"
        "2) 尽量去重与合并明显重复项；\n"
        "3) 保留有代表性的少量高质量结果（可小幅裁剪）；\n"
        "4) 输出规范 JSON：{\"refined\":[{id,name,version,packageType,createdAt,path,metadata,score}],\"notes\":\"简短说明\"}。\n"
        "请只输出 JSON，不要加入额外文本。"
    ),
)

METADATA_FILE = os.path.join(DATA_DIR, "package-metadata.json")

# ---------- Embeddings ----------
def build_embeddings():
    # DashScopeEmbeddings uses OPENAI-like interface via DashScope under the hood
    # Requires DASHSCOPE_API_KEY env var
    key = os.getenv("DASHSCOPE_API_KEY")
    if not key:
        return FakeEmbeddings(size=EMBEDDING_DIM)
    try:
        # Lazy import to avoid validation on import
        from langchain_community.embeddings import DashScopeEmbeddings  # type: ignore
        # DashScopeEmbeddings does not accept a "dimensions" field; the output
        # dimension is determined by the selected model.
        return DashScopeEmbeddings(model=EMBEDDING_MODEL)
    except Exception:
        # Any failure falls back to local fake embeddings
        return FakeEmbeddings(size=EMBEDDING_DIM)


# ---------- Vector store ----------
class VectorIndex:
    def __init__(self, persist_directory: str):
        self.persist_directory = persist_directory
        self.embeddings = build_embeddings()
        self.vs: Optional[Chroma] = None

    def load(self):
        try:
            self.vs = Chroma(collection_name="packages", embedding_function=self.embeddings, persist_directory=self.persist_directory)
        except Exception:
            self.vs = Chroma(collection_name="packages", embedding_function=self.embeddings, persist_directory=self.persist_directory)

    def reset(self):
        # recreate index
        if os.path.exists(self.persist_directory):
            try:
                for root, dirs, files in os.walk(self.persist_directory, topdown=False):
                    for name in files:
                        os.remove(os.path.join(root, name))
                    for name in dirs:
                        os.rmdir(os.path.join(root, name))
            except Exception:
                pass
        os.makedirs(self.persist_directory, exist_ok=True)
        self.load()

    def upsert_packages(self, items: List[dict]):
        if self.vs is None:
            self.load()

        # Build texts and metadatas
        texts: List[str] = []
        metadatas: List[dict] = []
        ids: List[str] = []
        for pkg in items:
            text_parts = [
                str(pkg.get("name", "")),
                str(pkg.get("version", "")),
                str(pkg.get("packageType", "")),
                ",".join(pkg.get("metadata", {}).get("tags", []) if isinstance(pkg.get("metadata", {}).get("tags", []), list) else []),
                str(pkg.get("metadata", {}).get("description", "")),
                ",".join(pkg.get("metadata", {}).get("components", []) if isinstance(pkg.get("metadata", {}).get("components", []), list) else []),
            ]
            text = "\n".join([t for t in text_parts if t])
            texts.append(text)
            meta = {
                "id": pkg.get("id"),
                "name": pkg.get("name"),
                "version": pkg.get("version"),
                "packageType": pkg.get("packageType"),
                "createdAt": pkg.get("createdAt"),
                "path": pkg.get("path"),
                "metadata": pkg.get("metadata", {}),
            }
            metadatas.append(meta)
            ids.append(pkg.get("id"))

        if len(texts) == 0:
            return 0

        # Use add or update by ids
        # Chroma add with same id will upsert
        self.vs.add_texts(texts=texts, metadatas=metadatas, ids=ids)
        self.vs.persist()
        return len(texts)

    def search(self, query: str, top_k: int):
        if self.vs is None:
            self.load()
        docs = self.vs.similarity_search_with_score(query, k=top_k)
        results = []
        for doc, score in docs:
            if SCORE_THRESHOLD and score < SCORE_THRESHOLD:
                continue
            md = doc.metadata
            results.append({
                "id": md.get("id"),
                "name": md.get("name"),
                "version": md.get("version"),
                "packageType": md.get("packageType"),
                "createdAt": md.get("createdAt"),
                "path": md.get("path"),
                "metadata": md.get("metadata", {}),
                "score": float(score),
                "chunk": doc.page_content[:200]
            })
        return results


index = VectorIndex(VECTOR_DIR)
index.load()

app = FastAPI()


# ---------- LLM refinement ----------
def _call_llm_with_messages(messages: List[dict]) -> Optional[str]:
    """Call DashScope Generation with messages format. Returns text or None on failure."""
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        return None
    try:
        # Lazy import to avoid hard dependency if key is absent
        from dashscope import Generation  # type: ignore

        resp = Generation.call(
            model=LLM_MODEL,
            input={"messages": messages},
        )
        # dashscope returns HTTPStatus in status_code
        if getattr(resp, "status_code", None) == HTTPStatus.OK:
            # Prefer output_text if available, otherwise stringify output
            text = getattr(resp, "output_text", None)
            if text:
                return text
            # Some SDK versions return structured output
            output = getattr(resp, "output", None)
            if isinstance(output, dict):
                # Try to get choices[0].message.content
                choices = output.get("choices") or []
                if choices and isinstance(choices, list):
                    msg = choices[0].get("message") or {}
                    return msg.get("content")
            return None
        return None
    except Exception:
        return None


def refine_hits_with_llm(question: str, hits: List[dict]) -> dict:
    """Return { refined: List[dict], notes: str, error: Optional[str] }.
    Falls back to passthrough when LLM unavailable or parsing fails.
    """
    if not hits:
        return {"refined": [], "notes": "empty hits", "error": None}

    # Compose messages with a system role prompt
    messages = [
        {"role": "system", "content": LLM_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": json.dumps(
                {
                    "question": question,
                    "candidates": hits,
                },
                ensure_ascii=False,
            ),
        },
    ]

    text = _call_llm_with_messages(messages)
    if not text:
        return {"refined": hits, "notes": "passthrough", "error": "llm_unavailable"}

    # Try to parse JSON strictly; if it fails, attempt to extract a JSON object
    parsed = None
    try:
        parsed = json.loads(text)
    except Exception:
        # best-effort extraction
        try:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                parsed = json.loads(text[start : end + 1])
        except Exception:
            parsed = None

    if not isinstance(parsed, dict):
        return {"refined": hits, "notes": "passthrough", "error": "parse_failed"}

    refined_items = parsed.get("refined")
    notes = parsed.get("notes") if isinstance(parsed.get("notes"), str) else None

    # If the model returned a list of objects, accept; if it returned list of ids, map back
    if isinstance(refined_items, list) and refined_items and isinstance(refined_items[0], dict):
        # Ensure basic shape and keep original fields where missing
        by_id = {h.get("id"): h for h in hits}
        normalized: List[dict] = []
        for item in refined_items:
            item_id = item.get("id")
            base = by_id.get(item_id, {})
            merged = {**base, **item}
            normalized.append(merged)
        return {"refined": normalized, "notes": notes, "error": None}

    if isinstance(refined_items, list) and refined_items and not isinstance(refined_items[0], dict):
        by_id = {h.get("id"): h for h in hits}
        ordered = [by_id[i] for i in refined_items if i in by_id]
        # Fallback: append any missing items to preserve coverage
        seen = set(refined_items)
        ordered.extend([h for h in hits if h.get("id") not in seen])
        return {"refined": ordered, "notes": notes, "error": None}

    # Otherwise fallback
    return {"refined": hits, "notes": "passthrough", "error": "unexpected_format"}


class SearchRequest(BaseModel):
    question: str
    filters: Optional[dict] = None
    topK: Optional[int] = None


@app.post("/rag/search")
async def rag_search(req: SearchRequest):
    top_k = req.topK or TOPK_DEFAULT
    hits = index.search(req.question, top_k)
    # Simple filters on server side (optional)
    filters = req.filters or {}
    def match_filters(item: dict) -> bool:
        # simple exact filters for a few fields
        if "type" in filters and filters["type"]:
            if item.get("packageType") != filters["type"]:
                return False
        if "isPatch" in filters and filters["isPatch"] is not None:
            is_patch = item.get("metadata", {}).get("isPatch")
            if str(is_patch).lower() not in ("true" if filters["isPatch"] else "false"):
                return False
        if "tags" in filters and filters["tags"]:
            item_tags = item.get("metadata", {}).get("tags", [])
            if isinstance(item_tags, str):
                try:
                    item_tags = json.loads(item_tags)
                except Exception:
                    item_tags = []
            if not all(t in item_tags for t in filters["tags"]):
                return False
        if "components" in filters and filters["components"]:
            comps = item.get("metadata", {}).get("components", [])
            if isinstance(comps, str):
                try:
                    comps = json.loads(comps)
                except Exception:
                    comps = []
            if not all(c in comps for c in filters["components"]):
                return False
        return True

    filtered_hits = [h for h in hits if match_filters(h)]
    refinement = refine_hits_with_llm(req.question, filtered_hits)
    return {
        "hits": filtered_hits,
        "refined": refinement.get("refined", filtered_hits),
        "notes": refinement.get("notes"),
        "llmError": refinement.get("error"),
    }


@app.get("/rag/chat/stream")
async def rag_chat_stream(question: str = "", ids: str = ""):
    # very simple mock stream based on search results
    id_list = [i for i in ids.split(",") if i]
    def event_generator():
        text = f"基于你的问题，找到了 {len(id_list)} 条相关包。"
        for i in range(0, len(text), 8):
            yield f"data: {text[i:i+8]}\n\n"
            time.sleep(0.05)
        yield "data: [DONE]\n\n"

    return EventSourceResponse(event_generator())


class SyncRequest(BaseModel):
    # full sync call from node when metadata changes
    # optional partial ids can be supported later
    force_rebuild: Optional[bool] = False


@app.post("/rag/sync")
async def rag_sync(req: SyncRequest):
    # read metadata file and upsert all
    if not os.path.exists(METADATA_FILE):
        raise HTTPException(status_code=404, detail="metadata file not found")

    with open(METADATA_FILE, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"invalid metadata json: {e}")

    if req.force_rebuild:
        index.reset()
    count = index.upsert_packages(data if isinstance(data, list) else [])
    return {"success": True, "upserted": count}


@app.get("/health")
async def health():
    return {"status": "ok"}
