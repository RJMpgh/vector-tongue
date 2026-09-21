"""Marlerian Anchor Registry validation and shared-reference calibration."""
from __future__ import annotations
import json, re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List
from .evaluation import mean_cosine_distance, mean_squared_error
from .models import AffineRidgeTranslator
from .provenance import compute_sha256

IDENTIFIER = re.compile(r"^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$")
VERSION = re.compile(r"^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$")

class AnchorRegistryError(ValueError):
    """Raised when an anchor registry violates its declared contract."""

def _text(obj: Dict[str, Any], key: str, context: str) -> str:
    value = obj.get(key)
    if not isinstance(value, str) or not value.strip():
        raise AnchorRegistryError(f"{context}.{key} must be non-empty text")
    return value.strip()

def _text_list(obj: Dict[str, Any], key: str, context: str) -> List[str]:
    value = obj.get(key)
    if not isinstance(value, list) or not value or any(not isinstance(x, str) or not x.strip() for x in value):
        raise AnchorRegistryError(f"{context}.{key} must be a non-empty list of text")
    return [x.strip() for x in value]

@dataclass(frozen=True)
class Anchor:
    anchor_id: str
    label: str
    operational_definition: str
    path_stage_count: int
    evaluation_prompt_count: int

@dataclass(frozen=True)
class AnchorRegistry:
    registry_id: str
    version: str
    status: str
    language: str
    steward: str
    anchors: List[Anchor]
    source_sha256: str | None = None

    @classmethod
    def from_dict(cls, payload: Dict[str, Any], source_sha256: str | None = None) -> "AnchorRegistry":
        registry_id = _text(payload, "registry_id", "registry")
        if not IDENTIFIER.fullmatch(registry_id):
            raise AnchorRegistryError("registry.registry_id is not a valid identifier")
        version = _text(payload, "version", "registry")
        if not VERSION.fullmatch(version):
            raise AnchorRegistryError("registry.version must use semantic versioning")
        status = _text(payload, "status", "registry")
        if status not in {"illustrative-draft", "candidate", "stable", "deprecated"}:
            raise AnchorRegistryError("registry.status is not recognized")
        governance = payload.get("governance")
        if not isinstance(governance, dict):
            raise AnchorRegistryError("registry.governance must be an object")
        _text_list(governance, "principles", "governance")
        _text(governance, "change_policy", "governance")
        raw_anchors = payload.get("anchors")
        if not isinstance(raw_anchors, list) or not raw_anchors:
            raise AnchorRegistryError("registry.anchors must be a non-empty list")
        anchors: List[Anchor] = []
        seen = set()
        for index, raw in enumerate(raw_anchors):
            if not isinstance(raw, dict):
                raise AnchorRegistryError(f"anchors[{index}] must be an object")
            context = f"anchors[{index}]"
            anchor_id = _text(raw, "anchor_id", context)
            if not IDENTIFIER.fullmatch(anchor_id):
                raise AnchorRegistryError(f"{context}.anchor_id is not a valid identifier")
            if anchor_id in seen:
                raise AnchorRegistryError("registry anchor_id values must be unique")
            seen.add(anchor_id)
            for key in ["invariants","inclusions","exclusions","boundary_cases","confounders"]:
                _text_list(raw, key, context)
            path = raw.get("path")
            if not isinstance(path, list) or len(path) < 2:
                raise AnchorRegistryError(f"{context}.path must contain at least two stages")
            positions: List[float] = []
            stage_ids = set()
            for sidx, stage in enumerate(path):
                if not isinstance(stage, dict):
                    raise AnchorRegistryError(f"{context}.path[{sidx}] must be an object")
                sid = _text(stage, "stage_id", f"{context}.path[{sidx}]")
                if sid in stage_ids:
                    raise AnchorRegistryError(f"{context}.path stage_id values must be unique")
                stage_ids.add(sid)
                position = stage.get("position")
                if isinstance(position, bool) or not isinstance(position, (int,float)):
                    raise AnchorRegistryError(f"{context}.path[{sidx}].position must be numeric")
                positions.append(float(position))
                _text(stage, "description", f"{context}.path[{sidx}]")
                _text_list(stage, "expected_invariants", f"{context}.path[{sidx}]")
            if positions[0] != 0.0 or positions[-1] != 1.0:
                raise AnchorRegistryError(f"{context}.path must begin at 0.0 and end at 1.0")
            if any(b <= a for a,b in zip(positions, positions[1:])):
                raise AnchorRegistryError(f"{context}.path positions must be strictly increasing")
            prompts = raw.get("evaluation_prompts")
            if not isinstance(prompts, list) or not prompts:
                raise AnchorRegistryError(f"{context}.evaluation_prompts must be non-empty")
            prompt_ids=set()
            for pidx,prompt in enumerate(prompts):
                if not isinstance(prompt, dict):
                    raise AnchorRegistryError(f"{context}.evaluation_prompts[{pidx}] must be an object")
                pid=_text(prompt,"prompt_id",f"{context}.evaluation_prompts[{pidx}]")
                if pid in prompt_ids:
                    raise AnchorRegistryError(f"{context}.evaluation prompt_id values must be unique")
                prompt_ids.add(pid)
                _text(prompt,"text",f"{context}.evaluation_prompts[{pidx}]")
                _text_list(prompt,"expected_properties",f"{context}.evaluation_prompts[{pidx}]")
                prohibited=prompt.get("prohibited_inferences",[])
                if not isinstance(prohibited,list) or any(not isinstance(x,str) or not x.strip() for x in prohibited):
                    raise AnchorRegistryError(f"{context}.evaluation_prompts[{pidx}].prohibited_inferences must be text")
            anchors.append(Anchor(anchor_id,_text(raw,"label",context),_text(raw,"operational_definition",context),len(path),len(prompts)))
        return cls(registry_id,version,status,_text(payload,"language","registry"),_text(governance,"steward","governance"),anchors,source_sha256)

    def summary(self) -> Dict[str, Any]:
        return {"registry_id":self.registry_id,"version":self.version,"status":self.status,"language":self.language,"steward":self.steward,"anchor_count":len(self.anchors),"path_stage_count":sum(a.path_stage_count for a in self.anchors),"evaluation_prompt_count":sum(a.evaluation_prompt_count for a in self.anchors),"source_sha256":self.source_sha256}

def load_anchor_registry(path: str | Path) -> AnchorRegistry:
    source=Path(path)
    payload=json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(payload,dict):
        raise AnchorRegistryError("registry root must be an object")
    return AnchorRegistry.from_dict(payload, compute_sha256(str(source)))

@dataclass(frozen=True)
class CalibrationReport:
    model_id: str
    anchor_count: int
    dimension: int
    regularization: float
    mean_squared_error: float
    mean_cosine_distance: float

class AnchorSpaceCalibrator:
    def __init__(self, regularization: float = 1.0):
        self.regularization=float(regularization)
        self._translator: AffineRidgeTranslator | None=None

    @staticmethod
    def _matrix(values: List[List[float]], name: str) -> List[List[float]]:
        if not isinstance(values,list) or len(values)<2 or not all(isinstance(row,list) and row for row in values):
            raise ValueError(f"{name} must contain at least two non-empty vectors")
        dim=len(values[0])
        if any(len(row)!=dim for row in values):
            raise ValueError(f"{name} vectors must have equal dimension")
        return [[float(x) for x in row] for row in values]

    def fit(self, model_id: str, model_anchor_vectors: List[List[float]], reference_anchor_vectors: List[List[float]]) -> CalibrationReport:
        if not model_id.strip():
            raise ValueError("model_id must not be blank")
        source=self._matrix(model_anchor_vectors,"model_anchor_vectors")
        target=self._matrix(reference_anchor_vectors,"reference_anchor_vectors")
        if len(source)!=len(target) or len(source[0])!=len(target[0]):
            raise ValueError("model and reference anchor matrices must have equal shape")
        self._translator=AffineRidgeTranslator(self.regularization).fit(source,target)
        predicted=self._translator.predict(source)
        return CalibrationReport(model_id.strip(),len(source),len(source[0]),self.regularization,mean_squared_error(predicted,target),mean_cosine_distance(predicted,target))

    def transform(self, vectors: List[List[float]]) -> List[List[float]]:
        if self._translator is None:
            raise RuntimeError("calibrator must be fitted before transformation")
        return self._translator.predict(self._matrix(vectors,"vectors"))
