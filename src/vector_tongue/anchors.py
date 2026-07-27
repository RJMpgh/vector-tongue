"""Marlerian Anchor Registry loading, validation, and model calibration."""

from __future__ import annotations

import dataclasses
import json
import pathlib
import re
from collections.abc import Mapping
from itertools import pairwise
from typing import Any

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .evaluation import row_cosine_distances, row_squared_errors
from .models import RidgeTranslator, as_matrix
from .provenance import sha256_file

IDENTIFIER_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$")
VERSION_PATTERN = re.compile(r"^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$")

FloatMatrix = NDArray[np.float64]


class AnchorRegistryError(ValueError):
    """Raised when a registry violates a structural or semantic invariant."""


def _required_text(payload: Mapping[str, Any], key: str, *, context: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise AnchorRegistryError(f"{context}.{key} must be non-empty text")
    return value.strip()


def _required_text_list(
    payload: Mapping[str, Any],
    key: str,
    *,
    context: str,
) -> tuple[str, ...]:
    value = payload.get(key)
    if not isinstance(value, list) or not value:
        raise AnchorRegistryError(f"{context}.{key} must be a non-empty list")
    result: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str) or not item.strip():
            raise AnchorRegistryError(
                f"{context}.{key}[{index}] must be non-empty text"
            )
        result.append(item.strip())
    return tuple(result)


@dataclasses.dataclass(frozen=True)
class PathStage:
    stage_id: str
    position: float
    description: str
    expected_invariants: tuple[str, ...]

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any], *, context: str) -> PathStage:
        stage_id = _required_text(payload, "stage_id", context=context)
        if not IDENTIFIER_PATTERN.fullmatch(stage_id):
            raise AnchorRegistryError(f"{context}.stage_id is not a valid identifier")
        position = payload.get("position")
        if not isinstance(position, (int, float)) or isinstance(position, bool):
            raise AnchorRegistryError(f"{context}.position must be numeric")
        numeric_position = float(position)
        if not 0.0 <= numeric_position <= 1.0:
            raise AnchorRegistryError(f"{context}.position must be within [0, 1]")
        return cls(
            stage_id=stage_id,
            position=numeric_position,
            description=_required_text(payload, "description", context=context),
            expected_invariants=_required_text_list(
                payload,
                "expected_invariants",
                context=context,
            ),
        )


@dataclasses.dataclass(frozen=True)
class EvaluationPrompt:
    prompt_id: str
    text: str
    expected_properties: tuple[str, ...]
    prohibited_inferences: tuple[str, ...]

    @classmethod
    def from_dict(
        cls,
        payload: Mapping[str, Any],
        *,
        context: str,
    ) -> EvaluationPrompt:
        prompt_id = _required_text(payload, "prompt_id", context=context)
        if not IDENTIFIER_PATTERN.fullmatch(prompt_id):
            raise AnchorRegistryError(f"{context}.prompt_id is not a valid identifier")
        prohibited = payload.get("prohibited_inferences", [])
        if not isinstance(prohibited, list) or any(
            not isinstance(item, str) or not item.strip() for item in prohibited
        ):
            raise AnchorRegistryError(
                f"{context}.prohibited_inferences must be a list of non-empty text"
            )
        return cls(
            prompt_id=prompt_id,
            text=_required_text(payload, "text", context=context),
            expected_properties=_required_text_list(
                payload,
                "expected_properties",
                context=context,
            ),
            prohibited_inferences=tuple(item.strip() for item in prohibited),
        )


@dataclasses.dataclass(frozen=True)
class Anchor:
    anchor_id: str
    label: str
    operational_definition: str
    invariants: tuple[str, ...]
    inclusions: tuple[str, ...]
    exclusions: tuple[str, ...]
    boundary_cases: tuple[str, ...]
    confounders: tuple[str, ...]
    path: tuple[PathStage, ...]
    evaluation_prompts: tuple[EvaluationPrompt, ...]

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any], *, index: int) -> Anchor:
        context = f"anchors[{index}]"
        anchor_id = _required_text(payload, "anchor_id", context=context)
        if not IDENTIFIER_PATTERN.fullmatch(anchor_id):
            raise AnchorRegistryError(f"{context}.anchor_id is not a valid identifier")

        raw_path = payload.get("path")
        if not isinstance(raw_path, list) or len(raw_path) < 2:
            raise AnchorRegistryError(f"{context}.path must contain at least two stages")
        path = tuple(
            PathStage.from_dict(stage, context=f"{context}.path[{stage_index}]")
            for stage_index, stage in enumerate(raw_path)
            if isinstance(stage, Mapping)
        )
        if len(path) != len(raw_path):
            raise AnchorRegistryError(f"{context}.path entries must be objects")
        positions = tuple(stage.position for stage in path)
        if positions[0] != 0.0 or positions[-1] != 1.0:
            raise AnchorRegistryError(f"{context}.path must begin at 0.0 and end at 1.0")
        if any(right <= left for left, right in pairwise(positions)):
            raise AnchorRegistryError(
                f"{context}.path positions must be strictly increasing"
            )
        stage_ids = tuple(stage.stage_id for stage in path)
        if len(set(stage_ids)) != len(stage_ids):
            raise AnchorRegistryError(f"{context}.path stage_id values must be unique")

        raw_prompts = payload.get("evaluation_prompts")
        if not isinstance(raw_prompts, list) or not raw_prompts:
            raise AnchorRegistryError(
                f"{context}.evaluation_prompts must be a non-empty list"
            )
        prompts = tuple(
            EvaluationPrompt.from_dict(
                prompt,
                context=f"{context}.evaluation_prompts[{prompt_index}]",
            )
            for prompt_index, prompt in enumerate(raw_prompts)
            if isinstance(prompt, Mapping)
        )
        if len(prompts) != len(raw_prompts):
            raise AnchorRegistryError(
                f"{context}.evaluation_prompts entries must be objects"
            )
        prompt_ids = tuple(prompt.prompt_id for prompt in prompts)
        if len(set(prompt_ids)) != len(prompt_ids):
            raise AnchorRegistryError(
                f"{context}.evaluation prompt_id values must be unique"
            )

        return cls(
            anchor_id=anchor_id,
            label=_required_text(payload, "label", context=context),
            operational_definition=_required_text(
                payload,
                "operational_definition",
                context=context,
            ),
            invariants=_required_text_list(payload, "invariants", context=context),
            inclusions=_required_text_list(payload, "inclusions", context=context),
            exclusions=_required_text_list(payload, "exclusions", context=context),
            boundary_cases=_required_text_list(
                payload,
                "boundary_cases",
                context=context,
            ),
            confounders=_required_text_list(payload, "confounders", context=context),
            path=path,
            evaluation_prompts=prompts,
        )


@dataclasses.dataclass(frozen=True)
class AnchorRegistry:
    registry_id: str
    version: str
    status: str
    language: str
    steward: str
    principles: tuple[str, ...]
    anchors: tuple[Anchor, ...]
    source_sha256: str | None = None

    @classmethod
    def from_dict(
        cls,
        payload: Mapping[str, Any],
        *,
        source_sha256: str | None = None,
    ) -> AnchorRegistry:
        registry_id = _required_text(payload, "registry_id", context="registry")
        if not IDENTIFIER_PATTERN.fullmatch(registry_id):
            raise AnchorRegistryError("registry.registry_id is not a valid identifier")
        version = _required_text(payload, "version", context="registry")
        if not VERSION_PATTERN.fullmatch(version):
            raise AnchorRegistryError("registry.version must use semantic versioning")
        status = _required_text(payload, "status", context="registry")
        if status not in {"illustrative-draft", "candidate", "stable", "deprecated"}:
            raise AnchorRegistryError("registry.status is not recognized")

        governance = payload.get("governance")
        if not isinstance(governance, Mapping):
            raise AnchorRegistryError("registry.governance must be an object")
        raw_anchors = payload.get("anchors")
        if not isinstance(raw_anchors, list) or not raw_anchors:
            raise AnchorRegistryError("registry.anchors must be a non-empty list")
        anchors = tuple(
            Anchor.from_dict(anchor, index=index)
            for index, anchor in enumerate(raw_anchors)
            if isinstance(anchor, Mapping)
        )
        if len(anchors) != len(raw_anchors):
            raise AnchorRegistryError("registry.anchors entries must be objects")
        anchor_ids = tuple(anchor.anchor_id for anchor in anchors)
        if len(set(anchor_ids)) != len(anchor_ids):
            raise AnchorRegistryError("registry anchor_id values must be unique")

        return cls(
            registry_id=registry_id,
            version=version,
            status=status,
            language=_required_text(payload, "language", context="registry"),
            steward=_required_text(governance, "steward", context="governance"),
            principles=_required_text_list(
                governance,
                "principles",
                context="governance",
            ),
            anchors=anchors,
            source_sha256=source_sha256,
        )

    @property
    def anchor_count(self) -> int:
        return len(self.anchors)

    @property
    def path_stage_count(self) -> int:
        return sum(len(anchor.path) for anchor in self.anchors)

    @property
    def evaluation_prompt_count(self) -> int:
        return sum(len(anchor.evaluation_prompts) for anchor in self.anchors)

    def summary(self) -> dict[str, Any]:
        return {
            "registry_id": self.registry_id,
            "version": self.version,
            "status": self.status,
            "language": self.language,
            "steward": self.steward,
            "anchor_count": self.anchor_count,
            "path_stage_count": self.path_stage_count,
            "evaluation_prompt_count": self.evaluation_prompt_count,
            "source_sha256": self.source_sha256,
        }


def load_anchor_registry(path: str | pathlib.Path) -> AnchorRegistry:
    source = pathlib.Path(path)
    payload = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(payload, Mapping):
        raise AnchorRegistryError("registry root must be an object")
    return AnchorRegistry.from_dict(payload, source_sha256=sha256_file(source))


@dataclasses.dataclass(frozen=True)
class CalibrationReport:
    model_id: str
    anchor_count: int
    dimension: int
    regularization: float
    mean_squared_error: float
    mean_cosine_distance: float


@dataclasses.dataclass
class AnchorSpaceCalibrator:
    """Map one model's anchor observations into a shared reference space."""

    regularization: float = 1.0
    _translator: RidgeTranslator | None = None
    _model_id: str | None = None

    def fit(
        self,
        model_id: str,
        model_anchor_vectors: ArrayLike,
        reference_anchor_vectors: ArrayLike,
    ) -> CalibrationReport:
        if not model_id.strip():
            raise ValueError("model_id must not be blank")
        model_vectors = as_matrix(model_anchor_vectors, name="model_anchor_vectors")
        reference_vectors = as_matrix(
            reference_anchor_vectors,
            name="reference_anchor_vectors",
        )
        if model_vectors.shape != reference_vectors.shape:
            raise ValueError(
                "model and reference anchor matrices must have equal shape"
            )
        if model_vectors.shape[0] < 2:
            raise ValueError("at least two anchor observations are required")
        self._translator = RidgeTranslator(regularization=self.regularization).fit(
            model_vectors,
            reference_vectors,
        )
        self._model_id = model_id.strip()
        calibrated = self._translator.predict(model_vectors)
        return CalibrationReport(
            model_id=self._model_id,
            anchor_count=model_vectors.shape[0],
            dimension=model_vectors.shape[1],
            regularization=self.regularization,
            mean_squared_error=float(
                np.mean(row_squared_errors(calibrated, reference_vectors))
            ),
            mean_cosine_distance=float(
                np.mean(row_cosine_distances(calibrated, reference_vectors))
            ),
        )

    def transform(self, vectors: ArrayLike) -> FloatMatrix:
        if self._translator is None:
            raise RuntimeError("calibrator must be fitted before transformation")
        return self._translator.predict(vectors)
