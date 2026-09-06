"""Translation models and baselines for cross-model embedding prediction."""

import math
from typing import List, Sequence, Optional


def _zeros_matrix(rows: int, cols: int) -> List[List[float]]:
    return [[0.0 for _ in range(cols)] for _ in range(rows)]


def _identity_matrix(n: int) -> List[List[float]]:
    return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]


def _matrix_multiply(A: List[List[float]], B: List[List[float]]) -> List[List[float]]:
    rows_A, cols_A = len(A), len(A[0])
    rows_B, cols_B = len(B), len(B[0])
    if cols_A != rows_B:
        raise ValueError(f"Cannot multiply {rows_A}x{cols_A} by {rows_B}x{cols_B}")
    out = _zeros_matrix(rows_A, cols_B)
    for i in range(rows_A):
        for k in range(cols_A):
            a_ik = A[i][k]
            if a_ik != 0.0:
                for j in range(cols_B):
                    out[i][j] += a_ik * B[k][j]
    return out


def _matrix_transpose(A: List[List[float]]) -> List[List[float]]:
    rows, cols = len(A), len(A[0])
    return [[A[i][j] for i in range(rows)] for j in range(cols)]


def _vector_mean(vectors: List[List[float]]) -> List[float]:
    n = len(vectors)
    dim = len(vectors[0])
    mean = [0.0] * dim
    for vec in vectors:
        for j in range(dim):
            mean[j] += vec[j]
    return [x / n for x in mean]


def _solve_linear_system(A: List[List[float]], B: List[List[float]]) -> List[List[float]]:
    """Solve AX = B for X using Gauss-Jordan elimination with partial pivoting."""
    n = len(A)
    m = len(B[0])
    # Augmented matrix [A | B]
    aug = [row_a[:] + row_b[:] for row_a, row_b in zip(A, B)]

    for col in range(n):
        # Find pivot
        max_row = col
        max_val = abs(aug[col][col])
        for r in range(col + 1, n):
            if abs(aug[r][col]) > max_val:
                max_val = abs(aug[r][col])
                max_row = r

        if max_val < 1e-12:
            # Singular or ill-conditioned, add tiny ridge damping
            aug[col][col] += 1e-6
            max_val = abs(aug[col][col])

        # Swap rows
        if max_row != col:
            aug[col], aug[max_row] = aug[max_row], aug[col]

        pivot = aug[col][col]
        for c in range(col, n + m):
            aug[col][c] /= pivot

        for r in range(n):
            if r != col:
                factor = aug[r][col]
                if factor != 0.0:
                    for c in range(col, n + m):
                        aug[r][c] -= factor * aug[col][c]

    # Extract X
    X = [[aug[r][n + c] for c in range(m)] for r in range(n)]
    return X


def _frobenius_norm(A: List[List[float]]) -> float:
    return math.sqrt(sum(val * val for row in A for val in row))


def _compute_polar_orthogonal(M: List[List[float]], max_iter: int = 50) -> List[List[float]]:
    """Compute orthogonal polar factor R of matrix M such that M ~ R H and R^T R = I."""
    n = len(M)
    fnorm = _frobenius_norm(M)
    if fnorm < 1e-12:
        return _identity_matrix(n)

    # Initial scaling
    scale = 1.0 / fnorm
    X = [[M[i][j] * scale for j in range(n)] for i in range(n)]

    # Newton-Schulz iteration for polar factor: X_{k+1} = 0.5 * X_k * (3I - X_k^T X_k)
    I = _identity_matrix(n)
    for _ in range(max_iter):
        Xt = _matrix_transpose(X)
        XtX = _matrix_multiply(Xt, X)
        diff = 0.0
        for i in range(n):
            for j in range(n):
                diff += (XtX[i][j] - I[i][j]) ** 2
        if math.sqrt(diff) < 1e-6:
            break

        factor = [[3.0 * I[i][j] - XtX[i][j] for j in range(n)] for i in range(n)]
        X_next = _matrix_multiply(X, factor)
        X = [[0.5 * X_next[i][j] for j in range(n)] for i in range(n)]

    return X


class TranslationModel:
    """Base interface for translation models and baselines."""
    def fit(self, source_vectors: List[List[float]], target_vectors: List[List[float]]) -> "TranslationModel":
        raise NotImplementedError

    def predict_one(self, source: List[float]) -> List[float]:
        raise NotImplementedError

    def predict(self, sources: List[List[float]]) -> List[List[float]]:
        return [self.predict_one(src) for src in sources]


class IdentityBaseline(TranslationModel):
    """b_hat = a. Tests whether source embedding is already the best target estimate."""
    def __init__(self):
        self.target_dim = 0

    def fit(self, source_vectors: List[List[float]], target_vectors: List[List[float]]) -> "IdentityBaseline":
        self.target_dim = len(target_vectors[0])
        return self

    def predict_one(self, source: List[float]) -> List[float]:
        if len(source) == self.target_dim:
            return list(source)
        if len(source) > self.target_dim:
            return list(source[:self.target_dim])
        return list(source) + [0.0] * (self.target_dim - len(source))


class TargetMeanBaseline(TranslationModel):
    """b_hat = mean(b_train). Ignores source and predicts average calibration target."""
    def __init__(self):
        self.mean_target: Optional[List[float]] = None

    def fit(self, source_vectors: List[List[float]], target_vectors: List[List[float]]) -> "TargetMeanBaseline":
        self.mean_target = _vector_mean(target_vectors)
        return self

    def predict_one(self, source: List[float]) -> List[float]:
        if self.mean_target is None:
            raise RuntimeError("Model must be fitted before predict")
        return list(self.mean_target)


class MeanShiftBaseline(TranslationModel):
    """b_hat = a + mean(b_train - a_train). Shift calculated only on calibration prompts."""
    def __init__(self):
        self.mean_delta: Optional[List[float]] = None
        self.target_dim = 0

    def fit(self, source_vectors: List[List[float]], target_vectors: List[List[float]]) -> "MeanShiftBaseline":
        n = len(source_vectors)
        s_dim = len(source_vectors[0])
        t_dim = len(target_vectors[0])
        self.target_dim = t_dim

        min_dim = min(s_dim, t_dim)
        delta_acc = [0.0] * t_dim
        for src, tgt in zip(source_vectors, target_vectors):
            for j in range(min_dim):
                delta_acc[j] += tgt[j] - src[j]
            for j in range(min_dim, t_dim):
                delta_acc[j] += tgt[j]

        self.mean_delta = [d / n for d in delta_acc]
        return self

    def predict_one(self, source: List[float]) -> List[float]:
        if self.mean_delta is None:
            raise RuntimeError("Model must be fitted before predict")
        s_dim = len(source)
        min_dim = min(s_dim, self.target_dim)
        out = [0.0] * self.target_dim
        for j in range(min_dim):
            out[j] = source[j] + self.mean_delta[j]
        for j in range(min_dim, self.target_dim):
            out[j] = self.mean_delta[j]
        return out


class AffineRidgeTranslator(TranslationModel):
    """(W, b) = argmin ||A W + b - B||_F^2 + lambda ||W||_F^2.
    Learned affine map estimated on calibration split.
    """
    def __init__(self, regularization: float = 1.0):
        self.regularization = float(regularization)
        self.W: Optional[List[List[float]]] = None
        self.b: Optional[List[float]] = None
        self.mean_source: Optional[List[float]] = None
        self.mean_target: Optional[List[float]] = None

    def fit(self, source_vectors: List[List[float]], target_vectors: List[List[float]]) -> "AffineRidgeTranslator":
        self.mean_source = _vector_mean(source_vectors)
        self.mean_target = _vector_mean(target_vectors)

        # Center data
        A_centered = [
            [src[j] - self.mean_source[j] for j in range(len(src))]
            for src in source_vectors
        ]
        B_centered = [
            [tgt[j] - self.mean_target[j] for j in range(len(tgt))]
            for tgt in target_vectors
        ]

        # Normal equations: (A^T A + lambda * I) W = A^T B
        At = _matrix_transpose(A_centered)
        AtA = _matrix_multiply(At, A_centered)
        AtB = _matrix_multiply(At, B_centered)

        s_dim = len(self.mean_source)
        for i in range(s_dim):
            AtA[i][i] += self.regularization

        # Solve for W
        self.W = _solve_linear_system(AtA, AtB)

        # b = mean_target - mean_source * W
        t_dim = len(self.mean_target)
        src_W = [0.0] * t_dim
        for j in range(t_dim):
            for i in range(s_dim):
                src_W[j] += self.mean_source[i] * self.W[i][j]

        self.b = [self.mean_target[j] - src_W[j] for j in range(t_dim)]
        return self

    def predict_one(self, source: List[float]) -> List[float]:
        if self.W is None or self.b is None:
            raise RuntimeError("Model must be fitted before predict")
        s_dim = len(source)
        t_dim = len(self.b)
        pred = list(self.b)
        for j in range(t_dim):
            for i in range(s_dim):
                pred[j] += source[i] * self.W[i][j]
        return pred


class OrthogonalTranslator(TranslationModel):
    """Orthogonal Procrustes translator:
    b_hat = (a - mean_source) * R + mean_target, subject to R^T R = I.
    """
    def __init__(self):
        self.R: Optional[List[List[float]]] = None
        self.mean_source: Optional[List[float]] = None
        self.mean_target: Optional[List[float]] = None

    def fit(self, source_vectors: List[List[float]], target_vectors: List[List[float]]) -> "OrthogonalTranslator":
        self.mean_source = _vector_mean(source_vectors)
        self.mean_target = _vector_mean(target_vectors)

        A_centered = [
            [src[j] - self.mean_source[j] for j in range(len(src))]
            for src in source_vectors
        ]
        B_centered = [
            [tgt[j] - self.mean_target[j] for j in range(len(tgt))]
            for tgt in target_vectors
        ]

        At = _matrix_transpose(A_centered)
        M = _matrix_multiply(At, B_centered)

        # For square orthogonal transformation
        dim = min(len(M), len(M[0]))
        square_M = [[M[i][j] for j in range(dim)] for i in range(dim)]
        self.R = _compute_polar_orthogonal(square_M)
        return self

    def predict_one(self, source: List[float]) -> List[float]:
        if self.R is None or self.mean_source is None or self.mean_target is None:
            raise RuntimeError("Model must be fitted before predict")
        centered = [s - m for s, m in zip(source, self.mean_source)]
        dim = len(self.R)
        pred = list(self.mean_target)
        for j in range(dim):
            for i in range(dim):
                pred[j] += centered[i] * self.R[i][j]
        return pred
