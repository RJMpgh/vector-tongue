/**
 * Cross-model translation operators and falsifiable baselines.
 */
import {
  centerMatrix,
  matMul,
  Matrix,
  meanVector,
  norm,
  solveLinearSystem,
  svdSquare,
  transpose,
  Vector,
  vecMatMul,
} from "./matrix";

export function asMatrix(value: unknown, name = "matrix"): Matrix {
  if (!Array.isArray(value) || value.length === 0 || !Array.isArray(value[0])) {
    throw new Error(`${name} must be a 2D array`);
  }
  const rows = value.length;
  const cols = value[0].length;
  if (cols === 0) {
    throw new Error(`${name} must not be empty`);
  }
  const mat: Matrix = [];
  for (let i = 0; i < rows; i++) {
    const row = value[i];
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(`${name} rows must have equal length`);
    }
    const numRow = row.map((v, j) => {
      const num = Number(v);
      if (!Number.isFinite(num)) {
        throw new Error(`${name} contains a non-finite value at [${i}, ${j}]`);
      }
      return num;
    });
    mat.push(numRow);
  }
  return mat;
}

export function validateXY(source: unknown, target: unknown): { X: Matrix; Y: Matrix } {
  const X = asMatrix(source, "source");
  const Y = asMatrix(target, "target");
  if (X.length !== Y.length || X[0].length !== Y[0].length) {
    throw new Error(
      `source and target shapes differ: [${X.length}, ${X[0].length}] vs [${Y.length}, ${Y[0].length}]`
    );
  }
  return { X, Y };
}

export interface TranslationModel {
  name: string;
  fit(source: Matrix, target: Matrix): this;
  predict(source: Matrix): Matrix;
  parameters(): Record<string, unknown>;
}

export class IdentityTranslator implements TranslationModel {
  name = "identity";
  private dimension: number | null = null;

  fit(source: Matrix, target: Matrix): this {
    const { X } = validateXY(source, target);
    this.dimension = X[0].length;
    return this;
  }

  predict(source: Matrix): Matrix {
    const X = asMatrix(source, "source");
    if (this.dimension === null) {
      throw new Error("model must be fitted before prediction");
    }
    if (X[0].length !== this.dimension) {
      throw new Error("source dimension differs from fitted dimension");
    }
    return X.map((row) => [...row]);
  }

  parameters(): Record<string, unknown> {
    return { dimension: this.dimension };
  }
}

export class TargetMeanTranslator implements TranslationModel {
  name = "target_mean";
  private targetMean: Vector | null = null;

  fit(source: Matrix, target: Matrix): this {
    const { Y } = validateXY(source, target);
    this.targetMean = meanVector(Y);
    return this;
  }

  predict(source: Matrix): Matrix {
    const X = asMatrix(source, "source");
    if (this.targetMean === null) {
      throw new Error("model must be fitted before prediction");
    }
    if (X[0].length !== this.targetMean.length) {
      throw new Error("source dimension differs from fitted dimension");
    }
    return X.map(() => [...this.targetMean!]);
  }

  parameters(): Record<string, unknown> {
    return { target_mean: this.targetMean };
  }
}

export class MeanShiftTranslator implements TranslationModel {
  name = "mean_shift";
  private delta: Vector | null = null;

  fit(source: Matrix, target: Matrix): this {
    const { X, Y } = validateXY(source, target);
    const diff: Matrix = Array.from({ length: X.length }, (_, i) =>
      X[i].map((val, j) => Y[i][j] - val)
    );
    this.delta = meanVector(diff);
    return this;
  }

  predict(source: Matrix): Matrix {
    const X = asMatrix(source, "source");
    if (this.delta === null) {
      throw new Error("model must be fitted before prediction");
    }
    if (X[0].length !== this.delta.length) {
      throw new Error("source dimension differs from fitted dimension");
    }
    return X.map((row) => row.map((val, j) => val + this.delta![j]));
  }

  parameters(): Record<string, unknown> {
    return { delta: this.delta };
  }
}

export class RidgeTranslator implements TranslationModel {
  name = "ridge_affine";
  regularization: number;
  private weights: Matrix | null = null;
  private intercept: Vector | null = null;

  constructor(regularization = 1.0) {
    if (regularization < 0) {
      throw new Error("regularization must be non-negative");
    }
    this.regularization = regularization;
  }

  fit(source: Matrix, target: Matrix): this {
    const { X, Y } = validateXY(source, target);
    const xMean = meanVector(X);
    const yMean = meanVector(Y);
    const centeredX = centerMatrix(X, xMean);
    const centeredY = centerMatrix(Y, yMean);

    const xT = transpose(centeredX);
    const gram = matMul(xT, centeredX);
    const dim = X[0].length;

    // Add regularization penalty: gram + lambda * I
    for (let i = 0; i < dim; i++) {
      gram[i][i] += this.regularization;
    }

    const xy = matMul(xT, centeredY);
    this.weights = solveLinearSystem(gram, xy);

    // intercept = yMean - xMean * weights
    const xMeanW = vecMatMul(xMean, this.weights);
    this.intercept = yMean.map((val, j) => val - xMeanW[j]);
    return this;
  }

  predict(source: Matrix): Matrix {
    const X = asMatrix(source, "source");
    if (this.weights === null || this.intercept === null) {
      throw new Error("model must be fitted before prediction");
    }
    if (X[0].length !== this.weights.length) {
      throw new Error("source dimension differs from fitted dimension");
    }
    const pred = matMul(X, this.weights);
    for (let i = 0; i < pred.length; i++) {
      for (let j = 0; j < pred[0].length; j++) {
        pred[i][j] += this.intercept[j];
      }
    }
    return pred;
  }

  parameters(): Record<string, unknown> {
    return {
      regularization: this.regularization,
      weights: this.weights,
      intercept: this.intercept,
    };
  }
}

export class OrthogonalTranslator implements TranslationModel {
  name = "orthogonal_procrustes";
  private rotation: Matrix | null = null;
  private sourceMean: Vector | null = null;
  private targetMean: Vector | null = null;

  fit(source: Matrix, target: Matrix): this {
    const { X, Y } = validateXY(source, target);
    this.sourceMean = meanVector(X);
    this.targetMean = meanVector(Y);
    const centeredX = centerMatrix(X, this.sourceMean);
    const centeredY = centerMatrix(Y, this.targetMean);

    // Covariance = X_c^T * Y_c
    const cov = matMul(transpose(centeredX), centeredY);
    const { U, V } = svdSquare(cov);
    // R = U * V^T
    this.rotation = matMul(U, transpose(V));
    return this;
  }

  predict(source: Matrix): Matrix {
    const X = asMatrix(source, "source");
    if (
      this.rotation === null ||
      this.sourceMean === null ||
      this.targetMean === null
    ) {
      throw new Error("model must be fitted before prediction");
    }
    if (X[0].length !== this.rotation.length) {
      throw new Error("source dimension differs from fitted dimension");
    }
    const centered = centerMatrix(X, this.sourceMean);
    const rotated = matMul(centered, this.rotation);
    return rotated.map((row) => row.map((val, j) => val + this.targetMean![j]));
  }

  parameters(): Record<string, unknown> {
    return {
      rotation: this.rotation,
      source_mean: this.sourceMean,
      target_mean: this.targetMean,
    };
  }
}
