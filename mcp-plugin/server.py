"""Local MCP diagnostics. No credentials or outbound execution adapters."""
import os
import threading
from functools import lru_cache
from fastmcp import FastMCP
from auditor import Auditor, preflight
from schemas import SCHEMAS
from results import AuditResult

mcp = FastMCP('VT-Drift Auditor', instructions=(
    'Inspect supported contracts first. Audit only; never execute target actions. '
    'A schema-valid payload or low distance does not establish user consent or correctness. '
    'Do not submit secrets. Do not retry to optimize a drift score.'))

@lru_cache(maxsize=1)
def get_auditor():
    from sentence_transformers import SentenceTransformer
    path = os.environ['VT_MODEL_PATH']
    model = SentenceTransformer(path, local_files_only=True, trust_remote_code=False)
    lock = threading.Lock()
    def encode(texts):
        with lock:
            tokens = model.tokenizer(texts, truncation=False)['input_ids']
            if any(len(t) > model.max_seq_length for t in tokens):
                raise ValueError('Input exceeds encoder token limit')
            return model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    # A portable identifier, not the host filesystem path.
    return Auditor(encode, model_id=os.getenv('VT_MODEL_ID', 'LOCAL_SNAPSHOT_UNVERIFIED'))

ANNOTATIONS = {'readOnlyHint': True, 'destructiveHint': False, 'openWorldHint': False}

@mcp.tool(annotations=ANNOTATIONS)
def list_audit_contracts() -> dict:
    """List the exact service/action schemas accepted by this diagnostic, without contacting services."""
    return {'contracts': [dict(service=s, action=a, schema=c.model_json_schema())
                          for (s, a), c in SCHEMAS.items()],
            'execution': 'DISABLED', 'contract_version': '0.1.0'}

@mcp.tool(annotations=ANNOTATIONS)
def audit_tool_call(user_intent: str, service: str, action: str, payload: dict) -> AuditResult:
    """Validate a planned call and optionally measure local intent/payload distance.

    Does not execute, certify, authorize, or block other tools. Model-supplied intent
    is unverified. Do not submit credentials. Never retry to lower the score.
    """
    # Schema checks and byte limits must run BEFORE model loading or inference.
    result, canonical = preflight(user_intent, service, action, payload)
    if canonical is None:
        return result
    try:
        auditor = get_auditor()
    except Exception:
        return dict(result, schema_status='VALID', reason='LOCAL_MODEL_UNAVAILABLE')
    return dict(auditor.audit(user_intent, service, action, payload), schema_status='VALID')

if __name__ == '__main__':
    mcp.run(transport='stdio', show_banner=False)
