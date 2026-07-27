"""Dependency-light uncertainty estimates and negative controls."""

from __future__ import annotations

import dataclasses
from collections.abc import Callable

import numpy as np
from numpy.typing import ArrayLike, NDArray

FloatArray = NDArray[np.float64]


@dataclasses.dataclass(frozen=True)
class Interval:
    estimate: float
    lower: float
    upper: float
    confidence: float
    resamples: int


def percentile_bootstrap(
    values: ArrayLike,
    *,
    statistic: Callable[[FloatArray], float] = np.mean,
    confidence: float = 0.95,
    resamples: int = 2_000,
    seed: int = 17,
) -> Interval:
    observations = np.asarray(values, dtype=np.float64)
    if observations.ndim != 1 or observations.size < 2:
        raise ValueError("values must contain at least two one-dimensional observations")
    if not np.all(np.isfinite(observations)):
        raise ValueError("values contain a non-finite value")
    if not 0.0 < confidence < 1.0:
        raise ValueError("confidence must be between 0 and 1")
    if resamples < 100:
        raise ValueError("resamples must be at least 100")

    rng = np.random.default_rng(seed)
    draws = np.empty(resamples, dtype=np.float64)
    for index in range(resamples):
        sample = rng.choice(observations, size=observations.size, replace=True)
        draws[index] = float(statistic(sample))
    alpha = (1.0 - confidence) / 2.0
    return Interval(
        estimate=float(statistic(observations)),
        lower=float(np.quantile(draws, alpha)),
        upper=float(np.quantile(draws, 1.0 - alpha)),
        confidence=confidence,
        resamples=resamples,
    )


@dataclasses.dataclass(frozen=True)
class PermutationResult:
    observed: float
    null_mean: float
    p_value: float
    permutations: int


def paired_target_permutation_test(
    source: ArrayLike,
    target: ArrayLike,
    *,
    score: Callable[[FloatArray, FloatArray], float],
    permutations: int = 1_000,
    seed: int = 17,
) -> PermutationResult:
    x = np.asarray(source, dtype=np.float64)
    y = np.asarray(target, dtype=np.float64)
    if x.ndim != 2 or y.ndim != 2 or x.shape != y.shape:
        raise ValueError("source and target must be equal-shaped matrices")
    if x.shape[0] < 3:
        raise ValueError("at least three pairs are required")
    if permutations < 100:
        raise ValueError("permutations must be at least 100")
    observed = float(score(x, y))
    rng = np.random.default_rng(seed)
    null = np.empty(permutations, dtype=np.float64)
    for index in range(permutations):
        null[index] = float(score(x, y[rng.permutation(y.shape[0])]))
    # Add one to numerator and denominator for a finite-sample exact-style bound.
    p_value = (1.0 + float(np.count_nonzero(null <= observed))) / (permutations + 1.0)
    return PermutationResult(
        observed=observed,
        null_mean=float(np.mean(null)),
        p_value=p_value,
        permutations=permutations,
    )
