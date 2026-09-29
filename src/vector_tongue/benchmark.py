"""MEL versus natural-language benchmark aggregation.

The benchmark only aggregates supplied per-case evaluator losses. It never
invent[s] model outputs or declares a winner when one route is missing.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Mapping

NOT_MEASURED = "NOT_MEASURED"


def compare_route_losses(cases: Iterable[Mapping[str, Any]]) -> Dict[str, Any]:
    """Compare paired direct and MEL semantic-loss observations."""
    rows: List[Dict[str, float]] = []
    for index, case in enumerate(cases):
        direct = case.get("direct_semantic_loss")
        mel = case.get("mel_semantic_loss")
        if not isinstance(direct, (int, float)) or not isinstance(mel, (int, float)):
            continue
        rows.append({"case_index": index, "direct_semantic_loss": float(direct), "mel_semantic_loss": float(mel)})
    if not rows:
        return {
            "result": NOT_MEASURED,
            "case_count": 0,
            "direct_mean_loss": NOT_MEASURED,
            "mel_mean_loss": NOT_MEASURED,
            "delta_mel_minus_direct": NOT_MEASURED,
            "method": "paired mean semantic loss over supplied evaluator outputs",
        }
    direct_mean = sum(row["direct_semantic_loss"] for row in rows) / len(rows)
    mel_mean = sum(row["mel_semantic_loss"] for row in rows) / len(rows)
    delta = mel_mean - direct_mean
    if delta < 0:
        result = "WIN"
    elif delta > 0:
        result = "LOSS"
    else:
        result = "TIE"
    return {
        "result": result,
        "case_count": len(rows),
        "direct_mean_loss": direct_mean,
        "mel_mean_loss": mel_mean,
        "delta_mel_minus_direct": delta,
        "method": "paired mean semantic loss over supplied evaluator outputs",
        "note": "This aggregate does not prove generalization beyond the supplied cases.",
    }
