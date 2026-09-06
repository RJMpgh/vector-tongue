/**
 * Dependency-light uncertainty estimates and negative controls.
 */
import { Matrix } from "./matrix";

export interface Interval {
  estimate: number;
  lower: number;
  upper: number;
  confidence: number;
  resamples: number;
}

export interface PermutationResult {
  observed: number;
  null_mean: number;
  p_value: number;
  permutations: number;
}

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 */
export function createRng(seed: number) {
  let s = Math.floor(seed) >>> 0;
  return function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function percentileBootstrap(
  values: number[],
  options?: {
    statistic?: (sample: number[]) => number;
    confidence?: number;
    resamples?: number;
    seed?: number;
  }
): Interval {
  const {
    statistic = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length,
    confidence = 0.95,
    resamples = 2000,
    seed = 17,
  } = options || {};

  if (values.length < 2) {
    throw new Error("values must contain at least two observations");
  }
  if (!values.every((v) => Number.isFinite(v))) {
    throw new Error("values contain a non-finite value");
  }
  if (confidence <= 0 || confidence >= 1) {
    throw new Error("confidence must be between 0 and 1");
  }
  if (resamples < 100) {
    throw new Error("resamples must be at least 100");
  }

  const rng = createRng(seed);
  const n = values.length;
  const draws = new Array<number>(resamples);

  for (let i = 0; i < resamples; i++) {
    const sample = new Array<number>(n);
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(rng() * n);
      sample[j] = values[idx];
    }
    draws[i] = statistic(sample);
  }

  draws.sort((a, b) => a - b);
  const alpha = (1.0 - confidence) / 2.0;
  const lowerIndex = Math.floor(alpha * resamples);
  const upperIndex = Math.min(resamples - 1, Math.floor((1.0 - alpha) * resamples));

  return {
    estimate: statistic(values),
    lower: draws[lowerIndex],
    upper: draws[upperIndex],
    confidence,
    resamples,
  };
}

export function pairedTargetPermutationTest(
  source: Matrix,
  target: Matrix,
  scoreFn: (X: Matrix, Y: Matrix) => number,
  options?: {
    permutations?: number;
    seed?: number;
  }
): PermutationResult {
  const { permutations = 1000, seed = 17 } = options || {};
  const n = source.length;
  if (n < 3) {
    throw new Error("at least three pairs are required");
  }

  const observed = scoreFn(source, target);
  const rng = createRng(seed);
  let nullSum = 0;
  let countLowerOrEqual = 0;

  for (let p = 0; p < permutations; p++) {
    // Permute indices of target rows
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = perm[i];
      perm[i] = perm[j];
      perm[j] = temp;
    }

    const shuffledTarget: Matrix = perm.map((idx) => target[idx]);
    const nullScore = scoreFn(source, shuffledTarget);
    nullSum += nullScore;
    if (nullScore <= observed) {
      countLowerOrEqual++;
    }
  }

  const pValue = (1.0 + countLowerOrEqual) / (permutations + 1.0);

  return {
    observed,
    null_mean: nullSum / permutations,
    p_value: pValue,
    permutations,
  };
}
