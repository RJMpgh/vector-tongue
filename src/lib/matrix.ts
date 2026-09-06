/**
 * Matrix and vector mathematics for Vector Tongue.
 * Pure TypeScript implementation without external native dependencies.
 */

export type Vector = number[];
export type Matrix = number[][];

export function dot(a: Vector, b: Vector): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

export function norm(a: Vector): number {
  return Math.sqrt(dot(a, a));
}

export function meanVector(matrix: Matrix): Vector {
  const rows = matrix.length;
  if (rows === 0) return [];
  const cols = matrix[0].length;
  const mean = new Array<number>(cols).fill(0);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      mean[j] += matrix[i][j];
    }
  }
  for (let j = 0; j < cols; j++) {
    mean[j] /= rows;
  }
  return mean;
}

export function centerMatrix(matrix: Matrix, mean: Vector): Matrix {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const centered: Matrix = Array.from({ length: rows }, () => new Array<number>(cols));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      centered[i][j] = matrix[i][j] - mean[j];
    }
  }
  return centered;
}

export function transpose(matrix: Matrix): Matrix {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result: Matrix = Array.from({ length: cols }, () => new Array<number>(rows));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = matrix[i][j];
    }
  }
  return result;
}

export function matMul(A: Matrix, B: Matrix): Matrix {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result: Matrix = Array.from({ length: rowsA }, () => new Array<number>(colsB).fill(0));

  for (let i = 0; i < rowsA; i++) {
    for (let k = 0; k < colsA; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < colsB; j++) {
        result[i][j] += aik * B[k][j];
      }
    }
  }
  return result;
}

export function matVecMul(A: Matrix, v: Vector): Vector {
  const rows = A.length;
  const cols = A[0].length;
  const result = new Array<number>(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += A[i][j] * v[j];
    }
    result[i] = sum;
  }
  return result;
}

export function vecMatMul(v: Vector, A: Matrix): Vector {
  const cols = A[0].length;
  const rows = A.length;
  const result = new Array<number>(cols).fill(0);
  for (let j = 0; j < cols; j++) {
    let sum = 0;
    for (let i = 0; i < rows; i++) {
      sum += v[i] * A[i][j];
    }
    result[j] = sum;
  }
  return result;
}

/**
 * Solves AX = B for X using Gaussian elimination with partial pivoting.
 * A is N x N, B is N x M.
 */
export function solveLinearSystem(A: Matrix, B: Matrix): Matrix {
  const n = A.length;
  const m = B[0].length;

  // Clone augmented matrix [A | B]
  const M: number[][] = Array.from({ length: n }, (_, i) => [
    ...A[i],
    ...B[i],
  ]);

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    let maxVal = Math.abs(M[i][i]);
    for (let k = i + 1; k < n; k++) {
      const val = Math.abs(M[k][i]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = k;
      }
    }

    if (maxVal < 1e-12) {
      // Perturb slightly to avoid singularity with regularization
      M[i][i] += 1e-8;
    }

    // Swap rows
    if (maxRow !== i) {
      const tmp = M[i];
      M[i] = M[maxRow];
      M[maxRow] = tmp;
    }

    // Pivot normalization
    const pivot = M[i][i];
    for (let j = i; j < n + m; j++) {
      M[i][j] /= pivot;
    }

    // Eliminate other rows
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = M[k][i];
      if (Math.abs(factor) > 1e-15) {
        for (let j = i; j < n + m; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }

  // Extract X from [I | X]
  const X: Matrix = Array.from({ length: n }, (_, i) => M[i].slice(n, n + m));
  return X;
}

/**
 * Computes SVD of an N x N matrix M = U * S * V^T
 * using One-Sided Jacobi or Two-Sided Jacobi algorithm.
 * Used for Orthogonal Procrustes: R = U * V^T.
 */
export function svdSquare(A: Matrix): { U: Matrix; S: Vector; V: Matrix } {
  const n = A.length;
  // Initialize V = Identity
  let V: Matrix = Array.from({ length: n }, (_, i) => {
    const row = new Array<number>(n).fill(0);
    row[i] = 1;
    return row;
  });

  // U begins as a copy of A
  let U: Matrix = A.map((row) => [...row]);

  // One-sided Jacobi algorithm
  const maxSweeps = 40;
  const tol = 1e-12;

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let converged = true;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // Compute inner products of columns i and j of U
        let alpha = 0; // ||col_i||^2
        let beta = 0;  // ||col_j||^2
        let gamma = 0; // col_i . col_j

        for (let r = 0; r < n; r++) {
          const u_ri = U[r][i];
          const u_rj = U[r][j];
          alpha += u_ri * u_ri;
          beta += u_rj * u_rj;
          gamma += u_ri * u_rj;
        }

        if (Math.abs(gamma) > tol * Math.sqrt(alpha * beta)) {
          converged = false;

          const zeta = (beta - alpha) / (2 * gamma);
          const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
          const c = 1 / Math.sqrt(1 + t * t);
          const s = c * t;

          // Rotate columns of U
          for (let r = 0; r < n; r++) {
            const u_ri = U[r][i];
            const u_rj = U[r][j];
            U[r][i] = c * u_ri - s * u_rj;
            U[r][j] = s * u_ri + c * u_rj;
          }

          // Rotate columns of V
          for (let r = 0; r < n; r++) {
            const v_ri = V[r][i];
            const v_rj = V[r][j];
            V[r][i] = c * v_ri - s * v_rj;
            V[r][j] = s * v_ri + c * v_rj;
          }
        }
      }
    }

    if (converged) break;
  }

  // Extract singular values (norms of columns of U) and normalize U
  const S = new Array<number>(n);
  for (let j = 0; j < n; j++) {
    let colNorm = 0;
    for (let r = 0; r < n; r++) {
      colNorm += U[r][j] * U[r][j];
    }
    colNorm = Math.sqrt(colNorm);
    S[j] = colNorm;
    if (colNorm > 1e-14) {
      for (let r = 0; r < n; r++) {
        U[r][j] /= colNorm;
      }
    }
  }

  return { U, S, V };
}
