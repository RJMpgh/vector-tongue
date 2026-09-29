"""Policy gating for Model Esperanto Layer packets.

This is a structural authorization layer, not a complete semantic security system.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from .mel import MELMessage


@dataclass(frozen=True)
class MELPolicy:
    """Allowlist policy for a MEL gateway."""

    allowed_goals: Optional[Sequence[str]] = None
    allowed_tool_predicates: Optional[Sequence[str]] = None
    allowed_action_predicates: Optional[Sequence[str]] = None
    require_provenance: bool = True
    max_atoms: int = 100

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "MELPolicy":
        max_atoms = int(data.get("max_atoms", 100))
        if max_atoms < 1:
            raise ValueError("max_atoms must be >= 1")
        return cls(
            allowed_goals=tuple(v.lower() for v in data["allowed_goals"]) if data.get("allowed_goals") is not None else None,
            allowed_tool_predicates=tuple(v.upper() for v in data["allowed_tool_predicates"]) if data.get("allowed_tool_predicates") is not None else None,
            allowed_action_predicates=tuple(v.upper() for v in data["allowed_action_predicates"]) if data.get("allowed_action_predicates") is not None else None,
            require_provenance=bool(data.get("require_provenance", True)),
            max_atoms=max_atoms,
        )

    @classmethod
    def from_json(cls, payload: str) -> "MELPolicy":
        data = json.loads(payload)
        if not isinstance(data, dict):
            raise ValueError("MEL policy must be a JSON object")
        return cls.from_dict(data)


@dataclass(frozen=True)
class MELPolicyReport:
    allowed: bool
    violations: Tuple[str, ...]

    def to_dict(self) -> Dict[str, Any]:
        return {"allowed": self.allowed, "violations": list(self.violations)}


def evaluate_mel_policy(message: MELMessage, policy: MELPolicy) -> MELPolicyReport:
    """Evaluate a packet against explicit structural authorization rules."""

    violations = []

    if policy.allowed_goals is not None:
        allowed_goals = {v.lower() for v in policy.allowed_goals}
        if message.goal not in allowed_goals:
            violations.append(f"goal_not_allowed:{message.goal}")

    if policy.require_provenance and not message.provenance:
        violations.append("provenance_required")

    if len(message.atoms) > policy.max_atoms:
        violations.append(f"too_many_atoms:{len(message.atoms)}>{policy.max_atoms}")

    allowed_tools = (
        {v.upper() for v in policy.allowed_tool_predicates}
        if policy.allowed_tool_predicates is not None
        else None
    )
    allowed_actions = (
        {v.upper() for v in policy.allowed_action_predicates}
        if policy.allowed_action_predicates is not None
        else None
    )

    for atom in message.atoms:
        if atom.kind == "TOOL" and allowed_tools is not None and atom.predicate not in allowed_tools:
            violations.append(f"tool_not_allowed:{atom.predicate}")
        if atom.kind == "ACTION" and allowed_actions is not None and atom.predicate not in allowed_actions:
            violations.append(f"action_not_allowed:{atom.predicate}")

    unique = tuple(sorted(set(violations)))
    return MELPolicyReport(allowed=not unique, violations=unique)
