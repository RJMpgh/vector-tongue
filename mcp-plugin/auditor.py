"""Experimental output-only diagnostic. Never authorizes or executes actions."""
import json
import math
from typing import Callable
from schemas import validate_payload

MAX_BYTES = 16384


def squared_unit_distance(left, right):
    if len(left) != len(right) or not len(left):
        raise ValueError('Embedding dimensions must match')
    vectors = [[float(x) for x in v] for v in (left, right)]
    if any(not math.isfinite(x) for v in vectors for x in v):
        raise ValueError('Non-finite embedding')
    norms = [math.hypot(*v) for v in vectors]
    if any(n == 0 or not math.isfinite(n) for n in norms):
        raise ValueError('Invalid embedding norm')
    return min(4.0, max(0.0, sum((a/norms[0]-b/norms[1])**2
                                            for a, b in zip(*vectors))))


def preflight(user_intent, service, action, payload):
    """Bound and validate before any expensive model setup. Return no input echoes."""
    result = dict(status='NOT_MEASURED', g=None, model='NOT_LOADED',
                  metric='squared_unit_euclidean_v1', threshold=None,
                  intent_provenance='MODEL_SUPPLIED_UNVERIFIED',
                  execution='DISABLED', savings='NOT_MEASURED', schema_status='NOT_VALIDATED')
    if not all(isinstance(x, str) and x.strip() for x in (user_intent, service, action)) or not isinstance(payload, dict):
        return dict(result, status='INVALID_INPUT'), None
    try:
        text = json.dumps(dict(service=service, action=action, payload=payload),
                          sort_keys=True, ensure_ascii=False, allow_nan=False)
        if len((user_intent + text).encode('utf-8')) > MAX_BYTES:
            return dict(result, status='INPUT_TOO_LARGE'), None
    except (TypeError, ValueError, RecursionError, UnicodeError):
        return dict(result, reason='SERIALIZATION_FAILED'), None
    if not validate_payload(service, action, payload):
        return dict(result, status='FAIL_SCHEMA', schema_status='INVALID_OR_UNSUPPORTED'), None
    return dict(result, schema_status='VALID'), text


class Auditor:
    def __init__(self, encode: Callable, model_id: str, threshold=None):
        if threshold is not None and (not math.isfinite(threshold) or not 0 <= threshold <= 4):
            raise ValueError('Threshold must be finite and within [0,4]')
        self.encode, self.model_id, self.threshold = encode, model_id, threshold

    def audit(self, user_intent: str, service: str, action: str, payload: dict):
        result, text = preflight(user_intent, service, action, payload)
        result.update(model=self.model_id, threshold=self.threshold)
        if text is None:
            return result
        try:
            vectors = self.encode([user_intent, text])
            if len(vectors) != 2:
                raise ValueError('Expected two embeddings')
            g = squared_unit_distance(*vectors)
        except Exception:
            return dict(result, reason='ENCODING_FAILED')
        decision = 'UNCALIBRATED'
        if self.threshold is not None:
            decision = 'REVIEW_REQUIRED' if g >= self.threshold else 'BELOW_EXPERIMENTAL_THRESHOLD'
        return dict(result, status=decision, g=g)
