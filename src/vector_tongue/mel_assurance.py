"""MEL Assurance: ground-truth-led output-only handoff regression evaluation.

This is a benchmarking tool, not a semantic oracle or prompt-injection firewall.
It never executes tool directives and does not query LLMs on its own.
"""
from __future__ import annotations

import argparse
import json
import math
import random
from collections import defaultdict
from pathlib import Path
from typing import Any, Mapping


class AssuranceError(ValueError):
    """A benchmark or packet failed its published input contract."""


KINDS = frozenset({
    "ENTITY", "RELATION", "ACTION", "PROPERTY", "GOAL", "CLAIM", "QUESTION",
    "CONDITION", "CONSTRAINT", "EVIDENCE", "UNCERTAINTY", "TIME", "CAUSE",
    "COUNTERFACTUAL", "TOOL", "RESULT", "PROVENANCE",
})
RELATIONS = frozenset({
    "IS_A", "HAS", "CAUSES", "ENABLES", "PREVENTS", "BEFORE", "AFTER",
    "PART_OF", "SIMILAR_TO", "DIFFERS_FROM", "DEPENDS_ON", "INCREASES",
    "DECREASES", "IMPLIES", "CONTRADICTS",
})
STATUSES = frozenset({"known", "inferred", "assumed", "unknown"})
PACKET_FIELDS = frozenset({"mel_version", "goal", "atoms", "constraints", "provenance"})
ATOM_FIELDS = frozenset({"kind", "predicate", "arguments", "confidence", "epistemic_status", "source"})
REQUIRED_ATOM_FIELDS = frozenset({"kind", "predicate", "arguments"})


def _text(v: Any, context: str) -> str:
    if not isinstance(v, str) or not v.strip():
        raise AssuranceError(f"{context} must be a nonempty string")
    return " ".join(v.strip().split())


def _str_list(value: Any, context: str) -> list[str]:
    if not isinstance(value, list):
        raise AssuranceError(f"{context} must be an array")
    result = [_text(s, context) for s in value]
    if len(result) != len(set(result)):
        raise AssuranceError(f"{context} contains duplicates")
    return result


def _object(value: Any, context: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise AssuranceError(f"{context} must be a JSON object")
    return value


def validate_packet(value: Any) -> dict[str, Any]:
    """Strict schema-subset validation; fail closed on unknown or duplicate atoms.

    Returns normalized validated packet. This cannot establish truth/provenance.
    """
    data = _object(value, "MEL packet")
    if set(data) != PACKET_FIELDS:
        raise AssuranceError(f"MEL fields differ: missing={sorted(PACKET_FIELDS-set(data))}, extra={sorted(set(data)-PACKET_FIELDS)}")
    if data["mel_version"] != "0.1":
        raise AssuranceError("only MEL v0.1 supported")
    goal = _text(data["goal"], "goal").lower()
    constraints = _str_list(data["constraints"], "constraints")
    provenance = _str_list(data["provenance"], "provenance")
    if not isinstance(data["atoms"], list):
        raise AssuranceError("atoms must be an array")
    atoms = []
    seen = set()
    for i, raw in enumerate(data["atoms"]):
        atom = _object(raw, f"atom[{i}]")
        if not REQUIRED_ATOM_FIELDS <= atom.keys() or atom.keys() - ATOM_FIELDS:
            raise AssuranceError(f"atom[{i}] has missing or unexpected fields")
        kind = _text(atom["kind"], "kind").upper()
        predicate = _text(atom["predicate"], "predicate").upper()
        if kind not in KINDS or (kind in {"RELATION", "CAUSE"} and predicate not in RELATIONS):
            raise AssuranceError(f"atom[{i}] invalid kind or relation predicate")
        # Repeated arguments are legitimate; repeated atoms are not.
        if not isinstance(atom["arguments"], list):
            raise AssuranceError(f"atom[{i}].arguments must be an array")
        args = [_text(s, f"atom[{i}].argument") for s in atom["arguments"]]
        if "epistemic_status" in atom and atom["epistemic_status"] is None:
            raise AssuranceError(f"atom[{i}] null epistemic status")
        status = atom.get("epistemic_status")
        if status is not None:
            status = _text(status, "epistemic_status").lower()
            if status not in STATUSES:
                raise AssuranceError(f"atom[{i}] unsupported epistemic status")
        if "confidence" in atom and atom["confidence"] is None:
            raise AssuranceError(f"atom[{i}] null confidence")
        confidence = atom.get("confidence")
        if confidence is not None and (
            isinstance(confidence, bool) or not isinstance(confidence, (int, float))
            or not math.isfinite(confidence) or not 0 <= confidence <= 1
        ):
            raise AssuranceError(f"atom[{i}] invalid confidence")
        source = _text(atom["source"], "source") if "source" in atom else None
        key = (kind, predicate, tuple(args), status)
        if key in seen:
            raise AssuranceError("duplicate canonical atom; v0.1 comparator would silently collapse this")
        seen.add(key)
        atoms.append({"kind": kind, "predicate": predicate, "arguments": args,
                      "epistemic_status": status, "confidence": confidence, "source": source})
    return {"goal": goal, "atoms": atoms, "constraints": constraints, "provenance": provenance}


def load_json(path: str | Path) -> Any:
    def no_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result = {}
        for key, value in pairs:
            if key in result:
                raise AssuranceError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    try:
        with open(path, encoding="utf-8") as f:
            return json.load(
                f, object_pairs_hook=no_duplicate_keys,
                parse_constant=lambda v: (_ for _ in ()).throw(AssuranceError(f"invalid number {v}"))
            )
    except json.JSONDecodeError as e:
        raise AssuranceError(f"malformed JSON: {e}") from e


def alias_registry(raw: Any) -> dict[str, str]:
    """Only explicitly reviewed whole-argument aliases, frozen before evaluation."""
    if not isinstance(raw, list):
        raise AssuranceError("aliases must be an array")
    registry: dict[str, str] = {}
    canonicals: set[str] = set()
    for item in raw:
        item = _object(item, "alias entry")
        if set(item) != {"canonical", "variants", "reviewed_by"}:
            raise AssuranceError("alias entries require canonical, variants, reviewed_by")
        target = _text(item["canonical"], "canonical").casefold()
        _text(item["reviewed_by"], "reviewed_by")
        variants = _str_list(item["variants"], "variants")
        canonicals.add(target)
        for variant in [target, *(v.casefold() for v in variants)]:
            prev = registry.get(variant)
            if prev is not None and prev != target:
                raise AssuranceError(f"conflicting alias classes for: {variant}")
            registry[variant] = target
    if any(registry.get(k) != k for k in canonicals):
        raise AssuranceError("canonical expression cannot alias another canonical")
    return registry


def _signature(atom: Mapping[str, Any], aliases: Mapping[str, str], include_status: bool = True) -> tuple:
    args = tuple(aliases.get(s.casefold(), s.casefold()) for s in atom["arguments"])
    base = (atom["kind"], atom["predicate"], args)
    return (*base, atom["epistemic_status"]) if include_status else base


def _safe_f1(ref: set, cand: set) -> tuple[float, float, float]:
    if not ref and not cand:
        return 1.0, 1.0, 1.0
    common = len(ref & cand)
    precision = common / len(cand) if cand else 0.0
    recall = common / len(ref) if ref else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def score_packet(reference: Any, candidate: Any, aliases: Mapping[str, str] | None = None) -> dict[str, Any]:
    """Correspondence against an externally supplied reference, not factual truth."""
    aliases = aliases or {}
    ref = validate_packet(reference)
    cand = validate_packet(candidate)
    ref_keys = {_signature(a, aliases) for a in ref["atoms"]}
    cand_keys = {_signature(a, aliases) for a in cand["atoms"]}
    precision, recall, f1 = _safe_f1(ref_keys, cand_keys)
    goal_match = ref["goal"] == cand["goal"]
    ref_constraints = set(ref["constraints"])
    cand_constraints = set(cand["constraints"])
    missing_constraints = sorted(ref_constraints - cand_constraints)
    extra_constraints = sorted(cand_constraints - ref_constraints)
    _, constraint_recall, constraint_f1 = _safe_f1(ref_constraints, cand_constraints)
    ref_provenance = set(ref["provenance"])
    cand_provenance = set(cand["provenance"])
    missing_provenance = sorted(ref_provenance - cand_provenance)
    _, provenance_recall, provenance_f1 = _safe_f1(ref_provenance, cand_provenance)

    ref_by_meaning = {_signature(a, aliases, False): a for a in ref["atoms"]}
    ref_by_signature = {_signature(a, aliases): a for a in ref["atoms"]}
    epistemic_mismatches = []
    ungrounded_known = []
    missing_atom_sources = []
    confidence_errors = []
    for atom in cand["atoms"]:
        key = _signature(atom, aliases, False)
        expected = ref_by_meaning.get(key)
        if expected is not None and atom["epistemic_status"] != expected["epistemic_status"]:
            epistemic_mismatches.append({
                "atom": list(key), "expected": expected["epistemic_status"],
                "observed": atom["epistemic_status"]
            })
        if atom["epistemic_status"] == "known" and (expected is None or expected["epistemic_status"] != "known"):
            ungrounded_known.append(list(key))
        if expected is not None and expected["source"] and atom["source"] != expected["source"]:
            missing_atom_sources.append(list(key))
        exact = ref_by_signature.get(_signature(atom, aliases))
        if exact is not None and exact["confidence"] is not None and atom["confidence"] is not None:
            confidence_errors.append(abs(exact["confidence"] - atom["confidence"]))
    source_count = 0
    source_matches = 0
    for reference_atom in ref["atoms"]:
        if reference_atom["source"]:
            source_count += 1
            cand_matching = [
                a for a in cand["atoms"]
                if _signature(a, aliases) == _signature(reference_atom, aliases)
            ]
            if any(a["source"] == reference_atom["source"] for a in cand_matching):
                source_matches += 1
    source_recall = source_matches / source_count if source_count else 1.0
    extra_tool_or_action_atoms = [
        list(k) for k in sorted(cand_keys - ref_keys) if k[0] in {"TOOL", "ACTION"}
    ]

    # Deliberately declared protocol weights, not universal semantic distances.
    protocol_loss = 1 - (
        0.55 * f1 + 0.15 * constraint_f1 + 0.10 * float(goal_match)
        + 0.10 * provenance_f1 + 0.10 * source_recall
    )
    exact_handoff = bool(
        ref_keys == cand_keys and goal_match and ref_constraints == cand_constraints
        and ref_provenance == cand_provenance and source_recall == 1.0
    )
    return {
        "atom_precision": precision, "atom_recall": recall, "atom_f1": f1,
        "goal_preserved": goal_match, "constraint_recall": constraint_recall,
        "constraint_f1": constraint_f1,
        "provenance_recall": provenance_recall, "provenance_f1": provenance_f1,
        "atom_source_recall": source_recall,
        "confidence_mae_when_measured": (
            sum(confidence_errors) / len(confidence_errors) if confidence_errors else None
        ),
        "missing_constraints": missing_constraints, "extra_constraints": extra_constraints,
        "missing_provenance": missing_provenance, "missing_atom_sources": missing_atom_sources,
        "epistemic_mismatches": epistemic_mismatches,
        "known_claim_without_known_reference": ungrounded_known,
        "extra_tool_or_action_atoms": extra_tool_or_action_atoms,
        "protocol_loss": round(max(0.0, min(1.0, protocol_loss)), 12),
        "exact_handoff": exact_handoff,
        "meaning": "frozen-anchor correspondence; not independent semantic entailment or factual verification",
    }


def _paired_ci(deltas: list[float], seed: int, resamples: int) -> list[float] | None:
    if len(deltas) < 2:
        return None
    rng = random.Random(seed)
    n = len(deltas)
    means = sorted(
        sum(deltas[rng.randrange(n)] for _ in range(n)) / n
        for _ in range(resamples)
    )
    return [means[int(.025 * (resamples - 1))], means[int(.975 * (resamples - 1))]]


def evaluate_benchmark(raw: Any, seed: int = 42, resamples: int = 2000) -> dict[str, Any]:
    benchmark = _object(raw, "benchmark")
    if set(benchmark) != {"benchmark_version", "evidence_grade", "aliases", "cases"}:
        raise AssuranceError("benchmark must contain only benchmark_version, evidence_grade, aliases, cases")
    if benchmark["benchmark_version"] != "0.1":
        raise AssuranceError("benchmark_version must equal 0.1")
    grade = benchmark["evidence_grade"]
    if grade not in ("SYNTHETIC_DEMO", "USER_SUPPLIED", "LIVE_PROVIDER_CALLS"):
        raise AssuranceError("unsupported evidence_grade")
    aliases = alias_registry(benchmark["aliases"])
    cases = benchmark["cases"]
    if not isinstance(cases, list) or not cases:
        raise AssuranceError("cases must be a nonempty array")
    if not isinstance(seed, int) or not (2 <= resamples <= 100000):
        raise AssuranceError("invalid seed or resamples")

    rows = []
    seen: set[str] = set()
    for case in cases:
        case = _object(case, "case")
        if set(case) != {"case_id", "family", "reference", "direct", "mel"}:
            raise AssuranceError("each case requires case_id, family, reference, direct, mel")
        case_id = _text(case["case_id"], "case_id")
        if case_id in seen:
            raise AssuranceError("duplicate case_id; paired bootstrap requires independent case units")
        seen.add(case_id)
        family = _text(case["family"], "family")
        direct = score_packet(case["reference"], case["direct"], aliases)
        mel = score_packet(case["reference"], case["mel"], aliases)
        delta = direct["protocol_loss"] - mel["protocol_loss"]
        rows.append({
            "case_id": case_id, "family": family, "direct": direct,
            "mel": mel, "mel_improvement_positive": round(delta, 12)
        })

    improvements = [row["mel_improvement_positive"] for row in rows]
    group: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        group[row["family"]].append(row["mel_improvement_positive"])
    mean_delta = sum(improvements) / len(improvements)
    return {
        "assurance_version": "0.1", "declared_evidence_grade": grade,
        "claims_status": (
            "DEMONSTRATION_ONLY" if grade == "SYNTHETIC_DEMO" else "NOT_INDEPENDENTLY_VERIFIED"
        ),
        "model_capability_advantage": (
            "NOT_MEASURED" if grade == "SYNTHETIC_DEMO" else "REQUIRES_EXPERIMENTAL_REVIEW"
        ),
        "primary_metric": "paired difference in protocol_loss; positive favors MEL",
        "n_cases": len(rows), "paired_mean_improvement": mean_delta,
        "paired_bootstrap_95ci": _paired_ci(improvements, seed, resamples),
        "by_family": {
            name: {"n": len(d), "mean_improvement": sum(d) / len(d)}
            for name, d in sorted(group.items())
        },
        "bootstrap": {
            "seed": seed, "resamples": resamples,
            "unit": "case_id", "method": "paired percentile"
        },
        "aliased_arguments": len(aliases), "cases": rows,
        "limitations": [
            "Equivalence aliases require independent review",
            "No live model calls or source verification",
            "Benchmark scores reflect chosen anchors and weights",
            "Small or selected datasets cannot establish generalization",
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="MEL Assurance: paired, output-only, ground-truth-led handoff audit"
    )
    parser.add_argument("benchmark", help="Path to benchmark JSON with reference, direct, and MEL outputs")
    parser.add_argument("--output", help="Optional report JSON path")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--resamples", type=int, default=2000)
    args = parser.parse_args(argv)
    try:
        result = evaluate_benchmark(
            load_json(args.benchmark), seed=args.seed, resamples=args.resamples
        )
    except (AssuranceError, OSError) as exc:
        parser.error(str(exc))
    payload = json.dumps(result, sort_keys=True, indent=2) + "\n"
    print(payload, end="")
    if args.output:
        Path(args.output).write_text(payload, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
