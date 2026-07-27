"""Cross-model translation operators and falsifiable baselines."""

from __future__ import annotations

import abc
import dataclasses
from typing import Any

import numpy as np
from numpy.typing import ArrayLike, NDArray

FloatMatrix = NDArray[np.float64]


def as_matrix(value: ArrayLike, *, name: str) -> FloatMatrix:
    matrix = np.asarray(value, dtype=np.float64)
    if matrix.ndim != 2:
        raise ValueError(f"{name} must be two-dimensional; got shape {matrix.shape}")
    if matrix.shape[0] == 0 or matrix.shape[1] == 0:
        raise ValueError(f"{name} must not be empty")
    if not np.all(np.isfinite(matrix)):
        raise ValueError(f"{name} contains a non-finite value")
    return matrix


def validate_xy(source: ArrayLike, target: ArrayLike) -> tuple[FloatMatrix, FloatMatrix]:
    x = as_matrix(source, name="source")
    y = as_matrix(target, name="target")
    if x.shape != y.shape:
        raise ValueError(f"source and target shapes differ: {x.shape} vs {y.shape}")
    return x, y


class TranslationModel(abc.ABC):
    name: str

    @abc.abstractmethod
    def fit(self, source: ArrayLike, target: ArrayLike) -> TranslationModel:
        raise NotImplementedError

    @abc.abstractmethod
    def predict(self, source: ArrayLike) -> FloatMatrix:
        raise NotImplementedError

    @abc.abstractmethod
    def parameters(self) -> dict[str, Any]:
        raise NotImplementedError


@dataclasses.dataclass
class IdentityTranslator(TranslationModel):
    name: str = "identity"
    _dimension: int | None = None

    def fit(self, source: ArrayLike, target: ArrayLike) -> IdentityTranslator:
        x, _ = validate_xy(source, target)
        self._dimension = x.shape[1]
        return self

    def predict(self, source: ArrayLike) -> FloatMatrix:
        x = as_matrix(source, name="source")
        if self._dimension is None:
            raise RuntimeError("model must be fitted before prediction")
        if x.shape[1] != self._dimension:
            raise ValueError("source dimension differs from fitted dimension")
        return x.copy()

    def parameters(self) -> dict[str, Any]:
        return {"dimension": self._dimension}


@dataclasses.dataclass
class TargetMeanTranslator(TranslationModel):
    name: str = "target_mean"
    _target_mean: NDArray[np.float64] | None = None

    def fit(self, source: ArrayLike, target: ArrayLike) -> TargetMeanTranslator:
        _, y = validate_xy(source, target)
        self._target_mean = y.mean(axis=0)
        return self

    def predict(self, source: ArrayLike) -> FloatMatrix:
        x = as_matrix(source, name="source")
        if self._target_mean is None:
            raise RuntimeError("model must be fitted before prediction")
        if x.shape[1] != self._target_mean.shape[0]:
            raise ValueError("source dimension differs from fitted dimension")
        return np.tile(self._target_mean, (x.shape[0], 1))

    def parameters(self) -> dict[str, Any]:
        return {"target_mean": None if self._target_mean is None else self._target_mean.tolist()}


@dataclasses.dataclass
class MeanShiftTranslator(TranslationModel):
    """Learn the average v1 delta on calibration prompts, then hold it fixed."""

    name: str = "mean_shift"
    _delta: NDArray[np.float64] | None = None

    def fit(self, source: ArrayLike, target: ArrayLike) -> MeanShiftTranslator:
        x, y = validate_xy(source, target)
        self._delta = (y - x).mean(axis=0)
        return self

    def predict(self, source: ArrayLike) -> FloatMatrix:
        x = as_matrix(source, name="source")
        if self._delta is None:
            raise RuntimeError("model must be fitted before prediction")
        if x.shape[1] != self._delta.shape[0]:
            raise ValueError("source dimension differs from fitted dimension")
        return x + self._delta

    def parameters(self) -> dict[str, Any]:
        return {"delta": None if self._delta is None else self._delta.tolist()}


@dataclasses.dataclass
class RidgeTranslator(TranslationModel):
    """Affine cross-model map learned with L2-regularized least squares."""

    regularization: float = 1.0
    name: str = "ridge_affine"
    _weights: FloatMatrix | None = None
    _intercept: NDArray[np.float64] | None = None
    _dual_source: FloatMatrix | None = None
    _dual_coefficients: FloatMatrix | None = None
    _source_mean: NDArray[np.float64] | None = None
    _target_mean: NDArray[np.float64] | None = None
    _solver: str = "unfitted"

    def __post_init__(self) -> None:
        if self.regularization < 0.0:
            raise ValueError("regularization must be non-negative")

    def fit(self, source: ArrayLike, target: ArrayLike) -> RidgeTranslator:
        x, y = validate_xy(source, target)
        x_mean = x.mean(axis=0)
        y_mean = y.mean(axis=0)
        centered_x = x - x_mean
        centered_y = y - y_mean
        self._weights = None
        self._intercept = None
        self._dual_source = None
        self._dual_coefficients = None
        self._source_mean = None
        self._target_mean = None

        if x.shape[0] < x.shape[1] and self.regularization > 0.0:
            # Linear ridge has an equivalent dual form. Solving the sample-space
            # system prevents a prohibitively large d-by-d solve for embeddings.
            gram = centered_x @ centered_x.T
            penalty = self.regularization * np.eye(x.shape[0], dtype=np.float64)
            self._dual_source = centered_x
            self._dual_coefficients = np.linalg.solve(gram + penalty, centered_y)
            self._source_mean = x_mean
            self._target_mean = y_mean
            self._solver = "dual"
        else:
            if self.regularization == 0.0:
                self._weights = np.linalg.lstsq(centered_x, centered_y, rcond=None)[0]
            else:
                gram = centered_x.T @ centered_x
                penalty = self.regularization * np.eye(x.shape[1], dtype=np.float64)
                self._weights = np.linalg.solve(gram + penalty, centered_x.T @ centered_y)
            self._intercept = y_mean - x_mean @ self._weights
            self._solver = "primal"
        return self

    def predict(self, source: ArrayLike) -> FloatMatrix:
        x = as_matrix(source, name="source")
        if self._solver == "dual":
            if (
                self._dual_source is None
                or self._dual_coefficients is None
                or self._source_mean is None
                or self._target_mean is None
            ):
                raise RuntimeError("model must be fitted before prediction")
            if x.shape[1] != self._dual_source.shape[1]:
                raise ValueError("source dimension differs from fitted dimension")
            kernel = (x - self._source_mean) @ self._dual_source.T
            return kernel @ self._dual_coefficients + self._target_mean
        if self._solver == "primal":
            if self._weights is None or self._intercept is None:
                raise RuntimeError("model must be fitted before prediction")
            if x.shape[1] != self._weights.shape[0]:
                raise ValueError("source dimension differs from fitted dimension")
            return x @ self._weights + self._intercept
        raise RuntimeError("model must be fitted before prediction")

    def parameters(self) -> dict[str, Any]:
        if self._solver == "dual":
            return {
                "regularization": self.regularization,
                "solver": self._solver,
                "dual_source": None if self._dual_source is None else self._dual_source.tolist(),
                "dual_coefficients": None
                if self._dual_coefficients is None
                else self._dual_coefficients.tolist(),
                "source_mean": None if self._source_mean is None else self._source_mean.tolist(),
                "target_mean": None if self._target_mean is None else self._target_mean.tolist(),
            }
        return {
            "regularization": self.regularization,
            "solver": self._solver,
            "weights": None if self._weights is None else self._weights.tolist(),
            "intercept": None if self._intercept is None else self._intercept.tolist(),
        }


@dataclasses.dataclass
class OrthogonalTranslator(TranslationModel):
    """Centered orthogonal Procrustes map for rotation-preserving translation."""

    name: str = "orthogonal_procrustes"
    _rotation: FloatMatrix | None = None
    _source_mean: NDArray[np.float64] | None = None
    _target_mean: NDArray[np.float64] | None = None

    def fit(self, source: ArrayLike, target: ArrayLike) -> OrthogonalTranslator:
        x, y = validate_xy(source, target)
        self._source_mean = x.mean(axis=0)
        self._target_mean = y.mean(axis=0)
        covariance = (x - self._source_mean).T @ (y - self._target_mean)
        left, _, right_t = np.linalg.svd(covariance, full_matrices=False)
        self._rotation = left @ right_t
        return self

    def predict(self, source: ArrayLike) -> FloatMatrix:
        x = as_matrix(source, name="source")
        if self._rotation is None or self._source_mean is None or self._target_mean is None:
            raise RuntimeError("model must be fitted before prediction")
        if x.shape[1] != self._rotation.shape[0]:
            raise ValueError("source dimension differs from fitted dimension")
        return (x - self._source_mean) @ self._rotation + self._target_mean

    def parameters(self) -> dict[str, Any]:
        return {
            "rotation": None if self._rotation is None else self._rotation.tolist(),
            "source_mean": None if self._source_mean is None else self._source_mean.tolist(),
            "target_mean": None if self._target_mean is None else self._target_mean.tolist(),
        }
