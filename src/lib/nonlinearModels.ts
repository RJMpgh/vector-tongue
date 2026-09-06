/**
 * Pure TypeScript implementations of diverse translation models and baselines:
 * - Identity baseline
 * - Target-Mean baseline
 * - Mean-Shift baseline
 * - K-Nearest Neighbors (k-NN) regression
 * - Ridge Affine regression
 * - Orthogonal Procrustes
 * - Kernel RBF mapping
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
import { cosineSimilarity, l2Distance } from "./geometry";
import { asMatrix, validateXY, TranslationModel } from "./models";

/**
 * K-Nearest Neighbors regression mapping from source to target space
 */
export class KNNTranslator implements TranslationModel {
  name = "k_nearest_neighbors";
  private k: number;
  private trainX: Matrix | null = null;
  private trainY: Matrix | null = null;

  constructor(k = 5) {
    this.k = Math.max(1, k);
  }

  fit(source: Matrix, target: Matrix): this {
    const { X, Y } = validateXY(source, target);
    this.trainX = X.map((r) => [...r]);
    this.trainY = Y.map((r) => [...r]);
    return this;
  }

  predict(source: Matrix): Matrix {
    const X = asMatrix(source, "source");
    if (!this.trainX || !this.trainY) {
      throw new Error("KNN model must be fitted before prediction");
    }

    const nTest = X.length;
    const nTrain = this.trainX.length;
    const targetDim = this.trainY[0].length;
    const k = Math.min(this.k, nTrain);

    const predictions: Matrix = Array.from({ length: nTest }, () =>
      new Array<number>(targetDim).fill(0)
    );

    for (let i = 0; i < nTest; i++) {
      const q = X[i];
      // Compute distances to all train points
      const distances: { dist: number; idx: number }[] = [];
      for (let j = 0; j < nTrain; j++) {
        distances.push({
          dist: l2Distance(q, this.trainX[j]),
          idx: j,
        });
      }
      distances.sort((a, b) => a.dist - b.dist);

      // Weighted average with inverse distance (plus epsilon)
      let weightSum = 0;
      for (let rank = 0; rank < k; rank++) {
        const item = distances[rank];
        const w = 1.0 / (item.dist + 1e-5);
        weightSum += w;
        const trainTargetVec = this.trainY[item.idx];
        for (let d = 0; d < targetDim; d++) {
          predictions[i][d] += trainTargetVec[d] * w;
        }
      }

      for (let d = 0; d < targetDim; d++) {
        predictions[i][d] /= weightSum;
      }
    }

    return predictions;
  }

  parameters(): Record<string, unknown> {
    return { k: this.k, training_samples: this.trainX?.length || 0 };
  }
}

/**
 * Kernel Ridge / RBF mapping for nonlinear behavioral alignment
 */
export class KernelRBFTranslator implements TranslationModel {
  name = "kernel_rbf";
  private gamma: number;
  private alpha: number;
  private trainX: Matrix | null = null;
  private dualWeights: Matrix | null = null;

  constructor(gamma = 0.1, alpha = 0.5) {
    this.gamma = gamma;
    this.alpha = alpha;
  }

  private rbfKernel(x1: Vector, x2: Vector): number {
    const d = l2Distance(x1, x2);
    return Math.exp(-this.gamma * d * d);
  }

  fit(source: Matrix, target: Matrix): this {
    const { X, Y } = validateXY(source, target);
    this.trainX = X.map((r) => [...r]);
    const n = X.length;

    // Build Kernel Gram matrix K (n x n)
    const K: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const kVal = this.rbfKernel(X[i], X[j]);
        K[i][j] = kVal;
        K[j][i] = kVal;
      }
      K[i][i] += this.alpha; // Tikhonov regularization
    }

    // Solve (K + alpha * I) * Dual = Y
    this.dualWeights = solveLinearSystem(K, Y);
    return this;
  }

  predict(source: Matrix): Matrix {
    const X = asMatrix(source, "source");
    if (!this.trainX || !this.dualWeights) {
      throw new Error("Kernel RBF model must be fitted before prediction");
    }

    const nTest = X.length;
    const nTrain = this.trainX.length;
    const targetDim = this.dualWeights[0].length;

    const predictions: Matrix = Array.from({ length: nTest }, () =>
      new Array<number>(targetDim).fill(0)
    );

    for (let i = 0; i < nTest; i++) {
      for (let j = 0; j < nTrain; j++) {
        const kVal = this.rbfKernel(X[i], this.trainX[j]);
        for (let d = 0; d < targetDim; d++) {
          predictions[i][d] += kVal * this.dualWeights[j][d];
        }
      }
    }

    return predictions;
  }

  parameters(): Record<string, unknown> {
    return {
      gamma: this.gamma,
      alpha: this.alpha,
      training_samples: this.trainX?.length || 0,
    };
  }
}
