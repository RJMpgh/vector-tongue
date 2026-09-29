"""Observable model-migration audit.

This module intentionally separates measurements from interpretations. It can audit
paired text outputs without pretending that text alone proves semantic equivalence.
Semantic/embedding fields remain NOT_MEASURED unless the caller supplies them.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from typing import Any, Dict, Iterable, List, Mapping, Optional

NOT_MEASURED = "NOT_MEASURED"
AUDIT_VERSION = "1.0"

_REFUSAL_MARKERS = (
    "i can't",
    "i cannot",
    "i’m unable",
    "i'm unable",
    "i am unable",
    "cannot help",
    "can't help",
    "not able to",
)


@dataclass(frozen=True)
class MigrationRecord:
    prompt_id: str
    prompt_family: str
    source_output: str
    target_output: str
    constraints: tuple[str, ...] = ()
    expected_format: Optional[str] = None
    source_embedding: Optional[tuple[float, ...]] = None
    target_embedding: Optional[tuple[float, ...]] = None

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "MigrationRecord":
        required = ("prompt_id", "prompt_family", "source_output", "target_output")
        missing = [key for key in required if key not in value]
        if missing:
            raise ValueError(f"missing migration record fields: {', '.join(missing)}")
        source = value["source_output"]
        target = value["target_output"]
        if not isinstance(source, str) or not isinstance(target, str):
            raise ValueError("source_output and target_output must be strings")
        source_embedding = value.get("source_embedding")
        target_embedding = value.get("target_embedding")
        if (source_embedding is None) != (target_embedding is None):
            raise ValueError("source_embedding and target_embedding must be supplied together")
        if source_embedding is not None:
            if not isinstance(source_embedding, list) or not isinstance(target_embedding, list):
                raise ValueError("embeddings must be arrays")
            if len(source_embedding) != len(target_embedding) or not source_embedding:
                raise ValueError("paired embeddings must have equal non-zero dimensions")
            if not all(isinstance(x, (int, float)) for x in source_embedding + target_embedding):
                raise ValueError("embeddings must contain only finite numeric values")
        constraints = value.get("constraints", [])
        if not isinstance(constraints, list) or not all(isinstance(x, str) for x in constraints):
            raise ValueError("constraints must be an array of strings")
        return cls(
            prompt_id=str(value["prompt_id"]),
            prompt_family=str(value["prompt_family"]),
            source_output=source,
            target_output=target,
            constraints=tuple(constraints),
            expected_format=value.get("expected_format"),
            source_embedding=tuple(float(x) for x in source_embedding) if source_embedding is not None else None,
            target_embedding=tuple(float(x) for x in target_embedding) if target_embedding is not None else None,
        )


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _word_count(text: str) -> int:
    return len(re.findall(r"\S+", text))


def _refusal(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in _REFUSAL_MARKERS)


def _json_valid(text: str) -> bool:
    try:
        json.loads(text)
        return True
    except (TypeError, json.JSONDecodeError):
        return False


def _mean(values: Iterable[float]) -> Optional[float]:
    values = list(values)
    return sum(values) / len(values) if values else None


def _embedding_mse(record: MigrationRecord) -> Optional[float]:
    if record.source_embedding is None or record.target_embedding is None:
        return None
    # This is an observable, caller-supplied embedding distance. It is not a
    # claim about the compared models' internal representations.
    return sum((a - b) ** 2 for a, b in zip(record.source_embedding, record.target_embedding)) / len(record.source_embedding)


def audit_migration(
    records: List[MigrationRecord],
    *,
    source_model: str,
    target_model: str,
    semantic_drift_threshold: Optional[float] = None,
    constraint_violation_threshold: int = 0,
) -> Dict[str, Any]:
    """Produce a release-oriented audit from paired, provenance-bearing outputs."""
    if not records:
        raise ValueError("at least one migration record is required")
    prompt_ids = [record.prompt_id for record in records]
    if len(set(prompt_ids)) != len(prompt_ids):
        raise ValueError("prompt_id must be unique; duplicate IDs can hide target leakage")

    family_counts: Dict[str, int] = {}
    per_prompt: List[Dict[str, Any]] = []
    all_violations: List[Dict[str, str]] = []
    embedding_mses: List[float] = []

    for record in records:
        family_counts[record.prompt_family] = family_counts.get(record.prompt_family, 0) + 1
        violations = [
            constraint for constraint in record.constraints
            if constraint.lower() not in record.target_output.lower()
        ]
        for constraint in violations:
            all_violations.append({"prompt_id": record.prompt_id, "constraint": constraint})
        emb_mse = _embedding_mse(record)
        if emb_mse is not None:
            embedding_mses.append(emb_mse)
        per_prompt.append({
            "prompt_id": record.prompt_id,
            "prompt_family": record.prompt_family,
            "source_response_sha256": _sha256(record.source_output),
            "target_response_sha256": _sha256(record.target_output),
            "source_word_count": _word_count(record.source_output),
            "target_word_count": _word_count(record.target_output),
            "word_count_delta": _word_count(record.target_output) - _word_count(record.source_output),
            "exact_response_match": record.source_output == record.target_output,
            "refusal_changed": _refusal(record.source_output) != _refusal(record.target_output),
            "format_changed": (
                _json_valid(record.source_output) != _json_valid(record.target_output)
                if record.expected_format == "json" else NOT_MEASURED
            ),
            "constraint_violations": violations,
            "embedding_mse": emb_mse if emb_mse is not None else NOT_MEASURED,
        })

    refusal_changes = sum(1 for item in per_prompt if item["refusal_changed"])
    semantic_status = "MEASURED" if embedding_mses else NOT_MEASURED
    mean_embedding_mse = _mean(embedding_mses)
    if semantic_drift_threshold is None or not embedding_mses:
        semantic_gate = NOT_MEASURED
    else:
        semantic_gate = "PASS" if mean_embedding_mse is not None and mean_embedding_mse <= semantic_drift_threshold else "FAIL"

    if len(all_violations) > constraint_violation_threshold:
        release_gate = "FAIL"
        gate_reason = "target outputs exceeded the configured constraint-violation threshold"
    elif semantic_gate == "FAIL":
        release_gate = "FAIL"
        gate_reason = "supplied embedding drift exceeded the configured threshold"
    elif semantic_gate == NOT_MEASURED:
        release_gate = "INSUFFICIENT_DATA"
        gate_reason = "semantic drift was not measured; provide paired external-encoder embeddings"
    elif refusal_changes or any(item["format_changed"] is True for item in per_prompt):
        release_gate = "REVIEW"
        gate_reason = "observable refusal or format behavior changed"
    else:
        release_gate = "PASS"
        gate_reason = "all configured measured gates passed"

    return {
        "audit_version": AUDIT_VERSION,
        "evidence": {
            "status": "USER_SUPPLIED",
            "source": "paired migration records supplied by caller",
            "prompt_count": len(records),
            "prompt_families": family_counts,
        },
        "models": {"source": source_model, "target": target_model},
        "measurements": {
            "semantic_drift": {
                "status": semantic_status,
                "mean_embedding_mse": mean_embedding_mse if mean_embedding_mse is not None else NOT_MEASURED,
                "threshold": semantic_drift_threshold if semantic_drift_threshold is not None else NOT_MEASURED,
                "method": "mean per-dimension squared distance over caller-supplied paired external embeddings",
            },
            "constraint_violations": {
                "count": len(all_violations),
                "threshold": constraint_violation_threshold,
                "details": all_violations,
                "method": "case-insensitive required-string presence check",
            },
            "refusal_changes": {
                "count": refusal_changes,
                "method": "documented marker heuristic over observable output text",
            },
            "format_changes": {
                "json_records_measured": sum(item["format_changed"] is not NOT_MEASURED for item in per_prompt),
                "method": "JSON parseability comparison only when expected_format=json",
            },
            "translation_predictability": NOT_MEASURED,
        },
        "per_prompt": per_prompt,
        "release_gate": {
            "status": release_gate,
            "reason": gate_reason,
            "thresholds": {
                "semantic_drift_mse": semantic_drift_threshold if semantic_drift_threshold is not None else NOT_MEASURED,
                "constraint_violations": constraint_violation_threshold,
            },
        },
        "limitations": [
            "Text output comparison does not establish semantic equivalence.",
            "Refusal detection is a transparent heuristic, not a safety classifier.",
            "A semantic result requires caller-supplied paired embeddings from a fixed external encoder.",
            "No private activations, hidden chain-of-thought, or provider internals are inspected.",
        ],
    }


def audit_from_json(payload: Mapping[str, Any]) -> Dict[str, Any]:
    records = [MigrationRecord.from_dict(item) for item in payload.get("records", [])]
    config = payload.get("config", {})
    return audit_migration(
        records,
        source_model=str(config.get("source_model", "NOT_SPECIFIED")),
        target_model=str(config.get("target_model", "NOT_SPECIFIED")),
        semantic_drift_threshold=config.get("semantic_drift_threshold"),
        constraint_violation_threshold=int(config.get("constraint_violation_threshold", 0)),
    )
