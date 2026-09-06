"""Vector Tongue: A falsifiable, output-only framework for learning and testing
behavioral translation between AI models.
"""

__version__ = "0.2.0"
__author__ = "RJ Marler"

from .geometry import (
    cosine_similarity,
    cosine_distance,
    euclidean_distance,
    norm_shift,
    marler_drift_v1,
)
from .data import PairedExample, PairedDataset, split_dataset
from .models import (
    IdentityBaseline,
    TargetMeanBaseline,
    MeanShiftBaseline,
    AffineRidgeTranslator,
    OrthogonalTranslator,
)
from .evaluation import evaluate_experiment
from .provenance import verify_manifest

__all__ = [
    "cosine_similarity",
    "cosine_distance",
    "euclidean_distance",
    "norm_shift",
    "marler_drift_v1",
    "PairedExample",
    "PairedDataset",
    "split_dataset",
    "IdentityBaseline",
    "TargetMeanBaseline",
    "MeanShiftBaseline",
    "AffineRidgeTranslator",
    "OrthogonalTranslator",
    "evaluate_experiment",
    "verify_manifest",
]
