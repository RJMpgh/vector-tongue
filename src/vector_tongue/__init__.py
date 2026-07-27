"""Vector Tongue: output-only cross-model behavioral translation."""

from .anchors import (
    Anchor,
    AnchorRegistry,
    AnchorRegistryError,
    AnchorSpaceCalibrator,
    load_anchor_registry,
)
from .data import EmbeddingPair, PairDataset
from .evaluation import EvaluationReport, evaluate_translator
from .geometry import DriftComponents, drift_components, marler_drift_v1
from .models import (
    IdentityTranslator,
    MeanShiftTranslator,
    RidgeTranslator,
    TranslationModel,
)

__all__ = [
    "Anchor",
    "AnchorRegistry",
    "AnchorRegistryError",
    "AnchorSpaceCalibrator",
    "DriftComponents",
    "EmbeddingPair",
    "EvaluationReport",
    "IdentityTranslator",
    "MeanShiftTranslator",
    "PairDataset",
    "RidgeTranslator",
    "TranslationModel",
    "drift_components",
    "evaluate_translator",
    "load_anchor_registry",
    "marler_drift_v1",
]

__version__ = "0.2.0"
