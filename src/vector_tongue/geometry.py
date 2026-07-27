"""Numerically safe geometry and historically versioned drift measures."""

from __future__ import annotations

import dataclasses

import numpy as np
from numpy.typing import ArrayLike, NDArray

FloatArray = NDArray[np.float64]


def as_vector(value: ArrayLike, *, name: str = "vector") -> FloatArray:
    vector = np.asarray(value, dtype=np.float64)
    if vector.ndim != 1:
        raise ValueError(f"{name} must be one-dimensional; got shape {vector.shape}")
    if vector.size == 0:
        raise ValueError(f"{name} must not be empty")
    if not np.all(np.isfinite(vector)):
        raise ValueError(f"{name} contains a non-finite value")
    return vector


def require_same_shape(a: FloatArray, b: FloatArray) -> None:
    if a.shape != b.shape:
        raise ValueError(f"vectors must have equal shape; got {a.shape} and {b.shape}")


def cosine_similarity(a: ArrayLike, b: ArrayLike, *, epsilon: float = 1e-12) -> float:
    left = as_vector(a, name="a")
    right = as_vector(b, name="b")
    require_same_shape(left, right)
    denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
    if denominator <= epsilon:
        raise ValueError("cosine similarity is undefined for a near-zero vector")
    return float(np.clip(np.dot(left, right) / denominator, -1.0, 1.0))


def cosine_distance(a: ArrayLike, b: ArrayLike) -> float:
    return 1.0 - cosine_similarity(a, b)


def l2_distance(a: ArrayLike, b: ArrayLike) -> float:
    left = as_vector(a, name="a")
    right = as_vector(b, name="b")
    require_same_shape(left, right)
    return float(np.linalg.norm(right - left))


def marler_drift_v1(a: ArrayLike, b: ArrayLike) -> float:
    """Return the original 2025 Marler Drift index.

    This historical descriptive index multiplies cosine distance by Euclidean
    displacement. For unit-normalized embeddings those terms are algebraically
    dependent, so v2 reports the components separately for interpretation.
    """

    return cosine_distance(a, b) * l2_distance(a, b)


@dataclasses.dataclass(frozen=True)
class DriftComponents:
    cosine_distance: float
    euclidean_displacement: float
    norm_shift: float
    marler_drift_v1: float


def drift_components(a: ArrayLike, b: ArrayLike) -> DriftComponents:
    left = as_vector(a, name="a")
    right = as_vector(b, name="b")
    require_same_shape(left, right)
    cosine = cosine_distance(left, right)
    displacement = float(np.linalg.norm(right - left))
    return DriftComponents(
        cosine_distance=cosine,
        euclidean_displacement=displacement,
        norm_shift=float(np.linalg.norm(right) - np.linalg.norm(left)),
        marler_drift_v1=cosine * displacement,
    )
