"""Held-out evaluation for cross-model translation claims."""

from __future__ import annotations

import dataclasses
from collections.abc import Iterable
from typing import Any

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .data import PairDataset
from .models import (
    IdentityTranslator,
    MeanShiftTranslator,
    TargetMeanTranslator,
    TranslationModel,
    as_matrix,
)
from .statistics import Interval, percentile_bootstrap

FloatArray = NDArray[np.float64]
FloatMatrix = NDArray[np.float64]


def row_cosine_distances(predicted: ArrayLike, target: ArrayLike) -> FloatArray:
    prediction = as_matrix(predicted, name="predicted")
    truth = as_matrix(target, name="target")
    if prediction.shape != truth.shape:
        raise ValueError("predicted and target matrices must have equal shape")
    numerator = np.sum(prediction * truth, axis=1)
    denominator = np.linalg.norm(prediction, axis=1) * np.linalg.norm(truth, axis=1)
    if np.any(denominator <= 1e-12):
        raise ValueError("cosine distance is undefined for a near-zero row")
    similarities = np.clip(numerator / denominator, -1.0, 1.0)
    return 1.0 - similarities


def row_squared_errors(predicted: ArrayLike, target: ArrayLike) -> FloatArray:
    prediction = as_matrix(predicted, name="predicted")
    truth = as_matrix(target, name="target")
    if prediction.shape != truth.shape:
        raise ValueError("predicted and target matrices must have equal shape")
    return np.mean(np.square(prediction - truth), axis=1)


def safe_gain(model_error: float, baseline_error: float) -> float | None:
    if baseline_error <= 1e-15:
        return None
    return 1.0 - model_error / baseline_error


@dataclasses.dataclass(frozen=True)
class MetricSummary:
    mean: float
    interval: Interval


@dataclasses.dataclass(frozen=True)
class EvaluationReport:
    model_name: str
    train_size: int
    test_size: int
    dimension: int
    mean_squared_error: MetricSummary
    mean_cosine_distance: MetricSummary
    baseline_mse: dict[str, float]
    gain_vs_baseline: dict[str, float | None]
    prompt_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


def summarize_metric(values: FloatArray, *, seed: int) -> MetricSummary:
    interval = percentile_bootstrap(values, seed=seed)
    return MetricSummary(mean=float(np.mean(values)), interval=interval)


def evaluate_translator(
    translator: TranslationModel,
    train: PairDataset,
    test: PairDataset,
    *,
    seed: int = 17,
) -> EvaluationReport:
    if train.dimension != test.dimension:
        raise ValueError("train and test dimensions must match")
    translator.fit(train.source, train.target)
    predicted = translator.predict(test.source)
    squared_errors = row_squared_errors(predicted, test.target)
    cosine_errors = row_cosine_distances(predicted, test.target)

    baselines: Iterable[TranslationModel] = (
        IdentityTranslator(),
        TargetMeanTranslator(),
        MeanShiftTranslator(),
    )
    baseline_mse: dict[str, float] = {}
    for baseline in baselines:
        baseline.fit(train.source, train.target)
        baseline_prediction = baseline.predict(test.source)
        baseline_mse[baseline.name] = float(
            np.mean(row_squared_errors(baseline_prediction, test.target))
        )
    model_mse = float(np.mean(squared_errors))
    return EvaluationReport(
        model_name=translator.name,
        train_size=train.size,
        test_size=test.size,
        dimension=train.dimension,
        mean_squared_error=summarize_metric(squared_errors, seed=seed),
        mean_cosine_distance=summarize_metric(cosine_errors, seed=seed + 1),
        baseline_mse=baseline_mse,
        gain_vs_baseline={
            name: safe_gain(model_mse, error) for name, error in baseline_mse.items()
        },
        prompt_ids=test.prompt_ids,
    )


def cross_validated_errors(
    dataset: PairDataset,
    translator_factory: Any,
    *,
    folds: int = 5,
    seed: int = 17,
) -> FloatArray:
    if folds < 2 or folds > dataset.size:
        raise ValueError("folds must be between 2 and the dataset size")
    rng = np.random.default_rng(seed)
    fold_indices = np.array_split(rng.permutation(dataset.size), folds)
    errors: list[float] = []
    all_indices = np.arange(dataset.size)
    for test_indices in fold_indices:
        train_indices = np.setdiff1d(all_indices, test_indices, assume_unique=True)
        train = dataset.subset(train_indices)
        test = dataset.subset(test_indices)
        translator = translator_factory()
        translator.fit(train.source, train.target)
        errors.extend(row_squared_errors(translator.predict(test.source), test.target))
    return np.asarray(errors, dtype=np.float64)
