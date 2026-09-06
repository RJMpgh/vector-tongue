/**
 * Held-out evaluation for cross-model translation claims.
 */
import { cosineSimilarity } from "./geometry";
import { Matrix, Vector } from "./matrix";
import {
  asMatrix,
  IdentityTranslator,
  MeanShiftTranslator,
  TargetMeanTranslator,
  TranslationModel,
} from "./models";
import { PairDataset } from "./data";
import { Interval, percentileBootstrap } from "./statistics";

export interface MetricSummary {
  mean: number;
  interval: Interval;
}

export interface EvaluationReport {
  model_name: string;
  train_size: number;
  test_size: number;
  dimension: number;
  mean_squared_error: MetricSummary;
  mean_cosine_distance: MetricSummary;
  baseline_mse: Record<string, number>;
  gain_vs_baseline: Record<string, number | null>;
  prompt_ids: string[];
  predictions?: Matrix;
  test_sources?: Matrix;
  test_targets?: Matrix;
  row_errors?: {
    prompt_id: string;
    category: string;
    squared_error: number;
    cosine_distance: number;
  }[];
}

export function rowCosineDistances(predicted: Matrix, target: Matrix): number[] {
  const pred = asMatrix(predicted, "predicted");
  const truth = asMatrix(target, "target");
  if (pred.length !== truth.length || pred[0].length !== truth[0].length) {
    throw new Error("predicted and target matrices must have equal shape");
  }

  const distances = new Array<number>(pred.length);
  for (let i = 0; i < pred.length; i++) {
    const p = pred[i];
    const t = truth[i];
    let num = 0;
    let normP = 0;
    let normT = 0;
    for (let j = 0; j < p.length; j++) {
      num += p[j] * t[j];
      normP += p[j] * p[j];
      normT += t[j] * t[j];
    }
    const denom = Math.sqrt(normP) * Math.sqrt(normT);
    if (denom <= 1e-12) {
      throw new Error(`cosine distance undefined for near-zero vector at row ${i}`);
    }
    const cos = Math.max(-1.0, Math.min(1.0, num / denom));
    distances[i] = 1.0 - cos;
  }
  return distances;
}

export function rowSquaredErrors(predicted: Matrix, target: Matrix): number[] {
  const pred = asMatrix(predicted, "predicted");
  const truth = asMatrix(target, "target");
  if (pred.length !== truth.length || pred[0].length !== truth[0].length) {
    throw new Error("predicted and target matrices must have equal shape");
  }

  const errors = new Array<number>(pred.length);
  const dim = pred[0].length;
  for (let i = 0; i < pred.length; i++) {
    let sumSq = 0;
    for (let j = 0; j < dim; j++) {
      const diff = pred[i][j] - truth[i][j];
      sumSq += diff * diff;
    }
    errors[i] = sumSq / dim;
  }
  return errors;
}

export function safeGain(modelError: number, baselineError: number): number | null {
  if (baselineError <= 1e-15) {
    return null;
  }
  return 1.0 - modelError / baselineError;
}

export function summarizeMetric(values: number[], seed: number): MetricSummary {
  const interval = percentileBootstrap(values, { seed, resamples: 1000 });
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { mean, interval };
}

export function evaluateTranslator(
  translator: TranslationModel,
  train: PairDataset,
  test: PairDataset,
  options?: { seed?: number; includeDetails?: boolean }
): EvaluationReport {
  const { seed = 17, includeDetails = true } = options || {};

  if (train.dimension !== test.dimension) {
    throw new Error("train and test dimensions must match");
  }

  // Fit and predict
  translator.fit(train.source, train.target);
  const predicted = translator.predict(test.source);

  const squaredErrors = rowSquaredErrors(predicted, test.target);
  const cosineErrors = rowCosineDistances(predicted, test.target);

  // Baselines
  const baselines: TranslationModel[] = [
    new IdentityTranslator(),
    new TargetMeanTranslator(),
    new MeanShiftTranslator(),
  ];

  const baseline_mse: Record<string, number> = {};
  for (const baseline of baselines) {
    baseline.fit(train.source, train.target);
    const basePred = baseline.predict(test.source);
    const baseErrors = rowSquaredErrors(basePred, test.target);
    const meanErr = baseErrors.reduce((a, b) => a + b, 0) / baseErrors.length;
    baseline_mse[baseline.name] = meanErr;
  }

  const modelMse = squaredErrors.reduce((a, b) => a + b, 0) / squaredErrors.length;

  const gain_vs_baseline: Record<string, number | null> = {};
  for (const [name, err] of Object.entries(baseline_mse)) {
    gain_vs_baseline[name] = safeGain(modelMse, err);
  }

  const report: EvaluationReport = {
    model_name: translator.name,
    train_size: train.size,
    test_size: test.size,
    dimension: train.dimension,
    mean_squared_error: summarizeMetric(squaredErrors, seed),
    mean_cosine_distance: summarizeMetric(cosineErrors, seed + 1),
    baseline_mse,
    gain_vs_baseline,
    prompt_ids: [...test.prompt_ids],
  };

  if (includeDetails) {
    report.predictions = predicted;
    report.test_sources = test.source;
    report.test_targets = test.target;
    report.row_errors = test.prompt_ids.map((id, idx) => ({
      prompt_id: id,
      category: test.categories[idx],
      squared_error: squaredErrors[idx],
      cosine_distance: cosineErrors[idx],
    }));
  }

  return report;
}
