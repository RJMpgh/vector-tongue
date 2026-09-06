"""Geometric drift and similarity measures for embedding vectors."""

import math
from typing import Sequence, Dict


def dot_product(a: Sequence[float], b: Sequence[float]) -> float:
    """Compute dot product between two vectors."""
    if len(a) != len(b):
        raise ValueError(f"Vector dimension mismatch: {len(a)} vs {len(b)}")
    return sum(x * y for x, y in zip(a, b))


def vector_norm(a: Sequence[float]) -> float:
    """Compute Euclidean (L2) norm of a vector."""
    return math.sqrt(sum(x * x for x in a))


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    """Compute cosine similarity between two vectors."""
    norm_a = vector_norm(a)
    norm_b = vector_norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    val = dot_product(a, b) / (norm_a * norm_b)
    # Clamp to [-1.0, 1.0] to prevent numerical floating point drift
    return max(-1.0, min(1.0, val))


def cosine_distance(a: Sequence[float], b: Sequence[float]) -> float:
    """Compute cosine distance: 1 - cosine_similarity(a, b)."""
    return 1.0 - cosine_similarity(a, b)


def euclidean_distance(a: Sequence[float], b: Sequence[float]) -> float:
    """Compute Euclidean distance ||b - a||_2."""
    if len(a) != len(b):
        raise ValueError(f"Vector dimension mismatch: {len(a)} vs {len(b)}")
    return math.sqrt(sum((y - x) ** 2 for x, y in zip(a, b)))


def norm_shift(a: Sequence[float], b: Sequence[float]) -> float:
    """Compute change in vector length: ||b||_2 - ||a||_2."""
    return vector_norm(b) - vector_norm(a)


def marler_drift_v1(a: Sequence[float], b: Sequence[float]) -> float:
    """Historical Marler Drift v1 index: (1 - cos(a, b)) * ||b - a||_2."""
    return cosine_distance(a, b) * euclidean_distance(a, b)


def compute_pair_metrics(a: Sequence[float], b: Sequence[float]) -> Dict[str, float]:
    """Compute comprehensive descriptive metrics for a source/target vector pair."""
    return {
        "cosine_similarity": cosine_similarity(a, b),
        "cosine_distance": cosine_distance(a, b),
        "euclidean_distance": euclidean_distance(a, b),
        "norm_shift": norm_shift(a, b),
        "marler_drift_v1": marler_drift_v1(a, b),
    }
