"""Validated paired-embedding datasets for output-only analysis."""

from __future__ import annotations

import dataclasses
from collections.abc import Iterable, Sequence

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .geometry import as_vector

FloatMatrix = NDArray[np.float64]


@dataclasses.dataclass(frozen=True)
class EmbeddingPair:
    prompt_id: str
    source: NDArray[np.float64]
    target: NDArray[np.float64]
    category: str = "unspecified"

    @classmethod
    def create(
        cls,
        prompt_id: str,
        source: ArrayLike,
        target: ArrayLike,
        category: str = "unspecified",
    ) -> EmbeddingPair:
        if not prompt_id.strip():
            raise ValueError("prompt_id must not be blank")
        source_vector = as_vector(source, name="source")
        target_vector = as_vector(target, name="target")
        if source_vector.shape != target_vector.shape:
            raise ValueError(
                f"source and target dimensions differ: {source_vector.shape} vs "
                f"{target_vector.shape}"
            )
        return cls(prompt_id, source_vector.copy(), target_vector.copy(), category)


@dataclasses.dataclass(frozen=True)
class PairDataset:
    prompt_ids: tuple[str, ...]
    source: FloatMatrix
    target: FloatMatrix
    categories: tuple[str, ...]

    @classmethod
    def from_pairs(cls, pairs: Iterable[EmbeddingPair]) -> PairDataset:
        items = tuple(pairs)
        if not items:
            raise ValueError("at least one embedding pair is required")
        identifiers = tuple(item.prompt_id for item in items)
        if len(set(identifiers)) != len(identifiers):
            raise ValueError("prompt_id values must be unique")
        source = np.vstack([item.source for item in items]).astype(np.float64)
        target = np.vstack([item.target for item in items]).astype(np.float64)
        if source.shape != target.shape:
            raise ValueError("source and target matrices must have equal shape")
        return cls(
            prompt_ids=identifiers,
            source=source,
            target=target,
            categories=tuple(item.category for item in items),
        )

    def __post_init__(self) -> None:
        if self.source.ndim != 2 or self.target.ndim != 2:
            raise ValueError("source and target must be two-dimensional")
        if self.source.shape != self.target.shape:
            raise ValueError("source and target matrices must have equal shape")
        if self.source.shape[0] != len(self.prompt_ids):
            raise ValueError("prompt_ids length does not match matrix rows")
        if len(self.categories) != len(self.prompt_ids):
            raise ValueError("categories length does not match prompt_ids")
        if not np.all(np.isfinite(self.source)) or not np.all(np.isfinite(self.target)):
            raise ValueError("embedding matrices contain non-finite values")

    @property
    def size(self) -> int:
        return self.source.shape[0]

    @property
    def dimension(self) -> int:
        return self.source.shape[1]

    def subset(self, indices: Sequence[int]) -> PairDataset:
        index = np.asarray(indices, dtype=np.int64)
        if index.ndim != 1:
            raise ValueError("indices must be one-dimensional")
        return PairDataset(
            prompt_ids=tuple(self.prompt_ids[int(i)] for i in index),
            source=self.source[index].copy(),
            target=self.target[index].copy(),
            categories=tuple(self.categories[int(i)] for i in index),
        )

    def split(
        self,
        *,
        test_fraction: float = 0.25,
        seed: int = 17,
    ) -> tuple[PairDataset, PairDataset]:
        if not 0.0 < test_fraction < 1.0:
            raise ValueError("test_fraction must be between 0 and 1")
        if self.size < 4:
            raise ValueError("at least four pairs are required for a train/test split")
        rng = np.random.default_rng(seed)
        order = rng.permutation(self.size)
        test_size = min(self.size - 2, max(1, round(self.size * test_fraction)))
        test_indices = order[:test_size]
        train_indices = order[test_size:]
        return self.subset(train_indices), self.subset(test_indices)
