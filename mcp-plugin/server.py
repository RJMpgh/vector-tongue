"""Local stdio MCP diagnostic server. No credentials or outbound action adapter."""
import os
from functools import lru_cache
from fastmcp import FastMCP
from auditor import Auditor

mcp = FastMCP('VT-Drift Auditor')

@lru_cache(maxsize=1)
def get_auditor():
    # Provision an immutable model snapshot separately; runtime never downloads it.
    from sentence_transformers import SentenceTransformer
    path = os.environ['VT_MODEL_PATH']
    model = SentenceTransformer(path, local_files_only=True, trust_remote_code=False)
    def encode(texts):
        # Reject input that would otherwise be silently truncated by the encoder.
        tokens = model.tokenizer(texts, truncation=False)['input_ids']
        if any(len(t) > model.max_seq_length for t in tokens):
            raise ValueError('Input exceeds encoder token limit')
        return model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return Auditor(encode, model_id=path)

@mcp.tool(annotations={'readOnlyHint': True, 'destructiveHint': False, 'openWorldHint': False})
def audit_tool_call(user_intent: str, service: str, action: str, payload: dict) -> dict:
    """Measure experimental intent/payload distance. Does not execute, certify, or authorize a call.

    Do not submit credentials. Intent is model supplied and unverified. A low score
    does not establish parameter correctness or permission. Never retry indefinitely.
    """
    try:
        auditor = get_auditor()
    except Exception:
        return {'status': 'NOT_MEASURED', 'g': None, 'execution': 'DISABLED',
                'reason': 'LOCAL_MODEL_UNAVAILABLE'}
    return auditor.audit(user_intent, service, action, payload)

if __name__ == '__main__':
    mcp.run(transport='stdio')
