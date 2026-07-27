"""Deterministic synthetic data used only to exercise the research pipeline."""

from __future__ import annotations

import numpy as np

from .data import EmbeddingPair, PairDataset


def synthetic_translation_dataset(
    *,
    samples: int = 80,
    dimension: int = 12,
    noise: float = 0.025,
    seed: int = 17,
) -> PairDataset:
    if samples < 8:
        raise ValueError("samples must be at least 8")
    if dimension < 2:
        raise ValueError("dimension must be at least 2")
    if noise < 0:
        raise ValueError("noise must be non-negative")
    rng = np.random.default_rng(seed)
    source = rng.normal(size=(samples, dimension))
    raw_rotation = rng.normal(size=(dimension, dimension))
    rotation, _ = np.linalg.qr(raw_rotation)
    scale = np.linspace(0.8, 1.2, dimension)
    weights = rotation @ np.diag(scale)
    intercept = rng.normal(scale=0.15, size=dimension)
    target = source @ weights + intercept + rng.normal(
        scale=noise, size=(samples, dimension)
    )
    pairs = [
        EmbeddingPair.create(
            f"demo-{index:03d}",
            source[index],
            target[index],
            category=("factual", "reasoning", "creative", "safety")[index % 4],
        )
        for index in range(samples)
    ]
    return PairDataset.from_pairs(pairs)
