/**
 * Numerically safe geometry and historically versioned drift measures.
 */
import { dot, norm, Vector } from "./matrix";

export interface DriftComponents {
  cosine_distance: number;
  euclidean_displacement: number;
  norm_shift: number;
  marler_drift_v1: number;
}

export function asVector(value: unknown, name = "vector"): Vector {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  if (value.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
  const vec = value.map((v, i) => {
    const num = Number(v);
    if (!Number.isFinite(num)) {
      throw new Error(`${name} contains a non-finite value at index ${i}`);
    }
    return num;
  });
  return vec;
}

export function requireSameShape(a: Vector, b: Vector): void {
  if (a.length !== b.length) {
    throw new Error(`vectors must have equal shape; got ${a.length} and ${b.length}`);
  }
}

export function cosineSimilarity(a: Vector, b: Vector, epsilon = 1e-12): number {
  requireSameShape(a, b);
  const normA = norm(a);
  const normB = norm(b);
  const denominator = normA * normB;
  if (denominator <= epsilon) {
    throw new Error("cosine similarity is undefined for a near-zero vector");
  }
  const cos = dot(a, b) / denominator;
  return Math.max(-1.0, Math.min(1.0, cos));
}

export function cosineDistance(a: Vector, b: Vector): number {
  return 1.0 - cosineSimilarity(a, b);
}

export function l2Distance(a: Vector, b: Vector): number {
  requireSameShape(a, b);
  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = b[i] - a[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * Return the original 2025 Marler Drift index.
 *
 * This historical descriptive index multiplies cosine distance by Euclidean
 * displacement. For unit-normalized embeddings those terms are algebraically
 * dependent, so v2 reports the components separately for interpretation.
 */
export function marlerDriftV1(a: Vector, b: Vector): number {
  return cosineDistance(a, b) * l2Distance(a, b);
}

export function driftComponents(a: Vector, b: Vector): DriftComponents {
  const cosDist = cosineDistance(a, b);
  const displacement = l2Distance(a, b);
  const normShift = norm(b) - norm(a);
  return {
    cosine_distance: cosDist,
    euclidean_displacement: displacement,
    norm_shift: normShift,
    marler_drift_v1: cosDist * displacement,
  };
}
