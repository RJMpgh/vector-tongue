"""Model Esperanto Layer (MEL): a canonical semantic interchange format.

MEL is deliberately output-only. It does not claim access to model activations.
It represents a model's externally stated semantic state in a normalized,
machine-readable form that can be compared across models and round trips.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import json
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence


MEL_VERSION = "0.1"

VALID_KINDS = {
    "ENTITY", "RELATION", "ACTION", "PROPERTY", "GOAL", "CLAIM", "QUESTION",
    "CONDITION", "CONSTRAINT", "EVIDENCE", "UNCERTAINTY", "TIME", "CAUSE",
    "COUNTERFACTUAL", "TOOL", "RESULT", "PROVENANCE",
}

VALID_RELATIONS = {
    "IS_A", "HAS", "CAUSES", "ENABLES", "PREVENTS", "BEFORE", "AFTER",
    "PART_OF", "SIMILAR_TO", "DIFFERS_FROM", "DEPENDS_ON", "INCREASES",
    "DECREASES", "IMPLIES", "CONTRADICTS",
}

VALID_EPISTEMIC_STATUS = {"known", "inferred", "assumed", "unknown"}


class MELError(ValueError):
    """Raised when a MEL message violates the v0.1 contract."""


def _norm_text(value: str) -> str:
    if not isinstance(value, str):
        raise MELError("text values must be strings")
    value = " ".join(value.strip().split())
    if not value:
        raise MELError("text values must not be empty")
    return value


def _sorted_unique_text(values: Iterable[str]) -> List[str]:
    return sorted({_norm_text(v) for v in values})


@dataclass(frozen=True)
class MELAtom:
    """One canonical semantic statement.

    arguments are ordered because many relations are directional.
    confidence is optional; omission is distinct from a fabricated number.
    """

    kind: str
    predicate: str
    arguments: Sequence[str] = field(default_factory=tuple)
    confidence: Optional[float] = None
    epistemic_status: Optional[str] = None
    source: Optional[str] = None

    def __post_init__(self) -> None:
        kind = self.kind.upper()
        predicate = self.predicate.upper()
        object.__setattr__(self, "kind", kind)
        object.__setattr__(self, "predicate", predicate)

        if kind not in VALID_KINDS:
            raise MELError(f"unknown MEL kind: {kind}")
        if kind in {"RELATION", "CAUSE"} and predicate not in VALID_RELATIONS:
            raise MELError(f"unknown MEL relation: {predicate}")

        args = tuple(_norm_text(v) for v in self.arguments)
        object.__setattr__(self, "arguments", args)

        if self.confidence is not None:
            c = float(self.confidence)
            if not 0.0 <= c <= 1.0:
                raise MELError("confidence must be within [0, 1]")
            object.__setattr__(self, "confidence", c)

        if self.epistemic_status is not None:
            status = self.epistemic_status.lower()
            if status not in VALID_EPISTEMIC_STATUS:
                raise MELError(f"unknown epistemic status: {status}")
            object.__setattr__(self, "epistemic_status", status)

        if self.source is not None:
            object.__setattr__(self, "source", _norm_text(self.source))

    def canonical_key(self) -> str:
        status = self.epistemic_status or ""
        return "|".join((self.kind, self.predicate, *self.arguments, status))

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "kind": self.kind,
            "predicate": self.predicate,
            "arguments": list(self.arguments),
        }
        if self.confidence is not None:
            out["confidence"] = self.confidence
        if self.epistemic_status is not None:
            out["epistemic_status"] = self.epistemic_status
        if self.source is not None:
            out["source"] = self.source
        return out

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "MELAtom":
        return cls(
            kind=data["kind"],
            predicate=data["predicate"],
            arguments=data.get("arguments", ()),
            confidence=data.get("confidence"),
            epistemic_status=data.get("epistemic_status"),
            source=data.get("source"),
        )


@dataclass(frozen=True)
class MELMessage:
    """Canonical model-to-model semantic packet."""

    goal: str
    atoms: Sequence[MELAtom]
    constraints: Sequence[str] = field(default_factory=tuple)
    provenance: Sequence[str] = field(default_factory=tuple)
    version: str = MEL_VERSION

    def __post_init__(self) -> None:
        if self.version != MEL_VERSION:
            raise MELError(f"unsupported MEL version: {self.version}")
        object.__setattr__(self, "goal", _norm_text(self.goal).lower())
        atoms = tuple(sorted(self.atoms, key=lambda a: a.canonical_key()))
        object.__setattr__(self, "atoms", atoms)
        object.__setattr__(self, "constraints", tuple(_sorted_unique_text(self.constraints)))
        object.__setattr__(self, "provenance", tuple(_sorted_unique_text(self.provenance)))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mel_version": self.version,
            "goal": self.goal,
            "atoms": [atom.to_dict() for atom in self.atoms],
            "constraints": list(self.constraints),
            "provenance": list(self.provenance),
        }

    def canonical_json(self) -> str:
        return json.dumps(
            self.to_dict(),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "MELMessage":
        return cls(
            version=data.get("mel_version", MEL_VERSION),
            goal=data["goal"],
            atoms=tuple(MELAtom.from_dict(item) for item in data.get("atoms", [])),
            constraints=tuple(data.get("constraints", [])),
            provenance=tuple(data.get("provenance", [])),
        )

    @classmethod
    def from_json(cls, payload: str) -> "MELMessage":
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise MELError(f"invalid MEL JSON: {exc}") from exc
        if not isinstance(data, dict):
            raise MELError("MEL payload must be a JSON object")
        return cls.from_dict(data)


@dataclass(frozen=True)
class MELComparison:
    """Measured structural difference between two MEL packets."""

    goal_match: bool
    atom_precision: float
    atom_recall: float
    atom_f1: float
    constraint_jaccard: float
    confidence_mae: Optional[float]
    semantic_loss: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "goal_match": self.goal_match,
            "atom_precision": self.atom_precision,
            "atom_recall": self.atom_recall,
            "atom_f1": self.atom_f1,
            "constraint_jaccard": self.constraint_jaccard,
            "confidence_mae": self.confidence_mae,
            "semantic_loss": self.semantic_loss,
        }


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


def compare_mel(reference: MELMessage, candidate: MELMessage) -> MELComparison:
    """Compare semantic packets without inventing unmeasured values.

    The v0.1 loss weights are protocol choices, not learned scientific constants:
      - atom preservation: 70%
      - goal preservation: 20%
      - constraint preservation: 10%

    Confidence error is reported independently and is not folded into loss.
    """

    ref_map = {atom.canonical_key(): atom for atom in reference.atoms}
    cand_map = {atom.canonical_key(): atom for atom in candidate.atoms}
    ref_keys = set(ref_map)
    cand_keys = set(cand_map)
    overlap = ref_keys & cand_keys

    precision = len(overlap) / len(cand_keys) if cand_keys else (1.0 if not ref_keys else 0.0)
    recall = len(overlap) / len(ref_keys) if ref_keys else (1.0 if not cand_keys else 0.0)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    constraint_j = _jaccard(set(reference.constraints), set(candidate.constraints))
    goal_match = reference.goal == candidate.goal

    confidence_deltas: List[float] = []
    for key in overlap:
        a = ref_map[key].confidence
        b = cand_map[key].confidence
        if a is not None and b is not None:
            confidence_deltas.append(abs(a - b))
    confidence_mae = (
        sum(confidence_deltas) / len(confidence_deltas)
        if confidence_deltas
        else None
    )

    preservation = 0.70 * f1 + 0.20 * float(goal_match) + 0.10 * constraint_j
    semantic_loss = min(1.0, max(0.0, 1.0 - preservation))
    if abs(semantic_loss) < 1e-12:
        semantic_loss = 0.0

    return MELComparison(
        goal_match=goal_match,
        atom_precision=precision,
        atom_recall=recall,
        atom_f1=f1,
        constraint_jaccard=constraint_j,
        confidence_mae=confidence_mae,
        semantic_loss=semantic_loss,
    )


def validate_mel_json(payload: str) -> MELMessage:
    """Parse and validate one canonical MEL v0.1 JSON packet."""
    return MELMessage.from_json(payload)
