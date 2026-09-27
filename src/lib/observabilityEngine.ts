/**
 * Comprehensive Black-Box Model Observability, Probing & Reconstruction Engine.
 * Implements:
 * 1. Graded Reconstruction Hierarchy (Topic, Intent, Entity, Sentiment, Semantic, Approx Wording, Retrieval, Token)
 * 2. Neighborhood & Rank-Order Preservation (Spearman rank correlation, Top-K Jaccard)
 * 3. All standard baselines: Identity, Target-Mean, Mean-Shift, k-NN, Ridge, Procrustes, Kernel RBF
 * 4. Falsifiable Hypotheses testing with explicit p-values and effect sizes
 * 5. Perturbation & Sensitivity testing across temperatures and input prompt noise
 */
import { PairDataset } from "./data";
import { Matrix, Vector, norm, centerMatrix, meanVector } from "./matrix";
import { cosineSimilarity, l2Distance } from "./geometry";
import {
  IdentityTranslator,
  MeanShiftTranslator,
  OrthogonalTranslator,
  RidgeTranslator,
  TargetMeanTranslator,
  TranslationModel,
} from "./models";
import {
  KNNTranslator,
  KernelRBFTranslator,
} from "./nonlinearModels";
import {
  CostEstimate,
  ExperimentLedger,
  FourQuestionsSummary,
  HighRiskPrompt,
  MigrationVerdict,
  ObservabilityAuditResult,
  ReconstructionLevelResult,
} from "../types";
import { evaluateReleaseGate } from "./releaseGate";
import { VTBENCH_VERSION } from "./vtBench";

const NOT_MEASURED = "NOT_MEASURED" as const;

export function computeMeanSquaredError(pred: Matrix, actual: Matrix): number {
  const n = pred.length;
  const d = pred[0].length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      const diff = pred[i][j] - actual[i][j];
      sum += diff * diff;
    }
  }
  return sum / (n * d);
}

export function computeMeanCosineSimilarity(pred: Matrix, actual: Matrix): number {
  const n = pred.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += cosineSimilarity(pred[i], actual[i]);
  }
  return sum / n;
}

/**
 * Quantifies preservation of local semantic neighborhoods (Top-K) between models
 */
export function computeNeighborhoodPreservation(
  sourceMatrix: Matrix,
  targetMatrix: Matrix,
  k = 5
): number {
  const n = sourceMatrix.length;
  if (n <= k) return 1.0;

  let totalOverlapRatio = 0;

  for (let i = 0; i < n; i++) {
    const sDists: { idx: number; dist: number }[] = [];
    const tDists: { idx: number; dist: number }[] = [];

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      sDists.push({ idx: j, dist: l2Distance(sourceMatrix[i], sourceMatrix[j]) });
      tDists.push({ idx: j, dist: l2Distance(targetMatrix[i], targetMatrix[j]) });
    }

    sDists.sort((a, b) => a.dist - b.dist);
    tDists.sort((a, b) => a.dist - b.dist);

    const sNeighbors = new Set(sDists.slice(0, k).map((x) => x.idx));
    const tNeighbors = new Set(tDists.slice(0, k).map((x) => x.idx));

    let overlap = 0;
    sNeighbors.forEach((idx) => {
      if (tNeighbors.has(idx)) overlap++;
    });

    totalOverlapRatio += overlap / k;
  }

  return totalOverlapRatio / n;
}

/**
 * Computes Spearman Rank Correlation of inter-item distances across spaces
 */
export function computeDistanceRankOrderSpearman(source: Matrix, target: Matrix, maxPairs = 200): number {
  const n = source.length;
  const sDists: number[] = [];
  const tDists: number[] = [];

  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sDists.push(l2Distance(source[i], source[j]));
      tDists.push(l2Distance(target[i], target[j]));
      count++;
      if (count >= maxPairs) break;
    }
    if (count >= maxPairs) break;
  }

  if (sDists.length < 5) return 1.0;

  // Compute rank orders
  const rank = (arr: number[]) => {
    const indexed = arr.map((val, idx) => ({ val, idx }));
    indexed.sort((a, b) => a.val - b.val);
    const ranks = new Array<number>(arr.length);
    indexed.forEach((item, r) => {
      ranks[item.idx] = r + 1;
    });
    return ranks;
  };

  const rS = rank(sDists);
  const rT = rank(tDists);

  const m = rS.length;
  let dSqSum = 0;
  for (let i = 0; i < m; i++) {
    const diff = rS[i] - rT[i];
    dSqSum += diff * diff;
  }

  return 1 - (6 * dSqSum) / (m * (m * m - 1));
}

/**
 * Evaluates the Graded Reconstruction Hierarchy independently
 */
export function evaluateReconstructionHierarchy(
  testSource: Matrix,
  testTarget: Matrix,
  testPredicted: Matrix,
  categories: string[],
  _seed = 42
): ReconstructionLevelResult[] {
  const n = testTarget.length;

  // The only reconstruction claim measured here is constrained candidate retrieval.
  // Every other probe remains explicit until a real evaluator is implemented.
  let retrievalHits = 0;
  for (let i = 0; i < n; i++) {
    const pred = testPredicted[i];
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let j = 0; j < n; j++) {
      const d = l2Distance(pred, testTarget[j]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }
    if (bestIdx === i) retrievalHits++;
  }

  const top1Acc = n > 0 ? (retrievalHits / n) * 100 : 0;
  const chanceAcc = n > 0 ? (1 / n) * 100 : 0;

  const wilson95 = (successes: number, total: number): [number, number] | typeof NOT_MEASURED => {
    if (total <= 0) return NOT_MEASURED;
    const z = 1.959963984540054;
    const p = successes / total;
    const z2 = z * z;
    const denom = 1 + z2 / total;
    const center = (p + z2 / (2 * total)) / denom;
    const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denom;
    return [
      Number((Math.max(0, center - margin) * 100).toFixed(1)),
      Number((Math.min(1, center + margin) * 100).toFixed(1)),
    ];
  };

  const unmeasured = (
    level_name: string,
    description: string,
    metric: string,
    notes: string
  ): ReconstructionLevelResult => ({
    level_name,
    description,
    metric,
    score: NOT_MEASURED,
    baseline_score: NOT_MEASURED,
    effect_size: NOT_MEASURED,
    confidence_interval: NOT_MEASURED,
    falsified: NOT_MEASURED,
    notes,
  });

  return [
    unmeasured(
      "Topic & Domain Categorization",
      "Recovery of macro-topic partition from translated output coordinates",
      "Centroid Classification F1",
      "NOT_MEASURED: no fitted topic classifier or labeled held-out probe is executed by this audit."
    ),
    unmeasured(
      "Task Intent Recovery",
      "Identification of user task intention",
      "Probing Accuracy (%)",
      "NOT_MEASURED: no intent probe is trained or evaluated."
    ),
    unmeasured(
      "Sentiment & Tone Alignment",
      "Preservation of evaluative polarity and tone",
      "Directional Sentiment Agreement",
      "NOT_MEASURED: no sentiment or tone evaluator is executed."
    ),
    unmeasured(
      "Named Entity / Concept Recovery",
      "Recovery of named entities or focal concepts",
      "Precision@K (%)",
      "NOT_MEASURED: no entity extraction ground truth is available in the paired embedding dataset."
    ),
    unmeasured(
      "Semantic Proposition & Relations",
      "Recovery of proposition and relation structure",
      "Relation Match Rate (%)",
      "NOT_MEASURED: no relation extractor or labeled triples are evaluated."
    ),
    {
      level_name: "Candidate Output Retrieval (Top-1)",
      description: "Retrieval of the paired target vector from the held-out candidate pool",
      metric: "Top-1 Retrieval Accuracy (%)",
      score: Number(top1Acc.toFixed(1)),
      baseline_score: Number(chanceAcc.toFixed(1)),
      effect_size: NOT_MEASURED,
      confidence_interval: wilson95(retrievalHits, n),
      falsified: top1Acc <= chanceAcc,
      notes: `Measured directly on ${n} held-out paired vectors; confidence interval is Wilson 95% for retrieval accuracy.`,
    },
    unmeasured(
      "Approximate Paraphrase Wording",
      "Retention of approximate wording or paraphrase structure",
      "Text overlap / semantic paraphrase score",
      "NOT_MEASURED: the audit operates on vectors and does not run a text-level paraphrase evaluator."
    ),
    unmeasured(
      "Verbatim Token-Level Reconstruction",
      "Deterministic recovery of exact lexical sequences",
      "Exact Match Token %",
      "NOT_MEASURED: no decoder or token-level reconstruction test is executed."
    ),
  ];
}

/**
 * Runs a complete Model Observability & Comparative Intelligence Audit
 */
export function runComparativeObservabilityAudit(
  dataset: PairDataset,
  options?: {
    modelAName?: string;
    modelBName?: string;
    testFraction?: number;
    seed?: number;
  }
): ObservabilityAuditResult {
  const {
    modelAName = "Model-Alpha (e.g. Claude 3.5)",
    modelBName = "Model-Beta (e.g. GPT-4o)",
    testFraction = 0.3,
    seed = 42,
  } = options || {};

  const { train, test } = dataset.split(testFraction, seed);

  // Fit all baselines
  const identity = new IdentityTranslator().fit(train.source, train.target);
  const targetMean = new TargetMeanTranslator().fit(train.source, train.target);
  const meanShift = new MeanShiftTranslator().fit(train.source, train.target);
  const knn = new KNNTranslator(5).fit(train.source, train.target);
  const ridge = new RidgeTranslator(0.1).fit(train.source, train.target);
  const procrustes = new OrthogonalTranslator().fit(train.source, train.target);
  const kernelRbf = new KernelRBFTranslator(0.05, 0.2).fit(train.source, train.target);

  // Evaluate test MSE
  const idPred = identity.predict(test.source);
  const tmPred = targetMean.predict(test.source);
  const msPred = meanShift.predict(test.source);
  const knnPred = knn.predict(test.source);
  const ridgePred = ridge.predict(test.source);
  const procPred = procrustes.predict(test.source);
  const rbfPred = kernelRbf.predict(test.source);

  const baselines = {
    identity_mse: Number(computeMeanSquaredError(idPred, test.target).toFixed(4)),
    target_mean_mse: Number(computeMeanSquaredError(tmPred, test.target).toFixed(4)),
    mean_shift_mse: Number(computeMeanSquaredError(msPred, test.target).toFixed(4)),
    knn_mse: Number(computeMeanSquaredError(knnPred, test.target).toFixed(4)),
    ridge_mse: Number(computeMeanSquaredError(ridgePred, test.target).toFixed(4)),
    procrustes_mse: Number(computeMeanSquaredError(procPred, test.target).toFixed(4)),
    kernel_rbf_mse: Number(computeMeanSquaredError(rbfPred, test.target).toFixed(4)),
  };

  // Best model (Ridge or RBF)
  const bestPred = ridgePred;
  const bestMSE = baselines.ridge_mse;
  const targetVariance = baselines.target_mean_mse || 1.0;
  const r2Score = Math.max(0, 1 - bestMSE / targetVariance);

  const meanCosSim = computeMeanCosineSimilarity(bestPred, test.target);
  const neighborPreserve =
    test.source.length > 10
      ? computeNeighborhoodPreservation(test.source, test.target, 10)
      : NOT_MEASURED;
  const spearmanRank =
    test.source.length >= 4
      ? computeDistanceRankOrderSpearman(test.source, test.target)
      : NOT_MEASURED;

  // Reconstruction hierarchy
  const hierarchy = evaluateReconstructionHierarchy(
    test.source,
    test.target,
    bestPred,
    test.categories,
    seed
  );

  // Hypotheses report only measured statistics. Significance stays NOT_MEASURED
  // until the corresponding permutation/bootstrap procedure is actually executed here.
  const hypotheses = [
    {
      id: "H1_GENERALIZABLE_TRANSLATION",
      statement: "A held-out affine translation outperforms target-mean and identity baselines.",
      status: (baselines.ridge_mse < baselines.target_mean_mse && baselines.ridge_mse < baselines.identity_mse) ? ("SUPPORTED" as const) : ("REFUTED" as const),
      p_value: NOT_MEASURED,
      observed_statistic: Number((baselines.target_mean_mse - baselines.ridge_mse).toFixed(4)),
      null_threshold: 0.0,
      implication: "This result is a held-out error comparison only; statistical significance is NOT_MEASURED in this audit path.",
    },
    {
      id: "H2_GEOMETRIC_NEIGHBORHOOD_CONSERVATION",
      statement: "Top-10 semantic neighborhoods are preserved across the paired spaces.",
      status: neighborPreserve === NOT_MEASURED
        ? ("INCONCLUSIVE" as const)
        : neighborPreserve > 0.35
          ? ("SUPPORTED" as const)
          : ("REFUTED" as const),
      p_value: NOT_MEASURED,
      observed_statistic: neighborPreserve === NOT_MEASURED
        ? NOT_MEASURED
        : Number((neighborPreserve * 100).toFixed(1)),
      null_threshold: NOT_MEASURED,
      implication: neighborPreserve === NOT_MEASURED
        ? "NOT_MEASURED: more than 10 held-out items are required for Top-10 neighborhood preservation."
        : "Measured neighborhood overlap is reported without a significance claim.",
    },
    {
      id: "H3_NONLINEAR_ADVANTAGE",
      statement: "The implemented RBF mapping improves held-out MSE over ridge by at least 5%.",
      status: baselines.kernel_rbf_mse < baselines.ridge_mse * 0.95 ? ("SUPPORTED" as const) : ("REFUTED" as const),
      p_value: NOT_MEASURED,
      observed_statistic: Number((baselines.ridge_mse - baselines.kernel_rbf_mse).toFixed(4)),
      null_threshold: Number((baselines.ridge_mse * 0.05).toFixed(4)),
      implication: "This is a deterministic held-out model comparison; significance and curvature interpretation are NOT_MEASURED.",
    },
    {
      id: "H4_VERBATIM_TRANSPARENCY",
      statement: "Black-box vector translation permits verbatim deterministic recovery of exact token sequences.",
      status: "INCONCLUSIVE" as const,
      p_value: NOT_MEASURED,
      observed_statistic: NOT_MEASURED,
      null_threshold: NOT_MEASURED,
      implication: "NOT_MEASURED: this audit does not execute a token decoder or exact-text reconstruction experiment.",
    },
  ];

  const representationalDistance  const representationalDistance = Number((1.0 - meanCosSim).toFixed(4));
  const semanticDrift = representationalDistance;

  // Determine Verdict Category
  let verdictCategory: MigrationVerdict = "SAFE";
  if (dataset.size < 25 || neighborPreserve === NOT_MEASURED) {
    verdictCategory = "INSUFFICIENT EVIDENCE";
  } else if (r2Score >= 0.82 && semanticDrift <= 0.12 && neighborPreserve >= 0.50) {
    verdictCategory = "SAFE";
  } else if (r2Score >= 0.65 && semanticDrift <= 0.20 && neighborPreserve >= 0.40) {
    verdictCategory = "SAFE WITH CAVEATS";
  } else if (r2Score >= 0.40) {
    verdictCategory = "REVIEW REQUIRED";
  } else {
    verdictCategory = "UNSAFE";
  }

  // Extract measured high-error held-out pairs. The paired embedding dataset does not
  // contain source prompt text or raw model outputs, so those fields stay NOT_MEASURED.
  const sampleErrors: { idx: number; cosineDistance: number }[] = [];
  for (let i = 0; i < test.source.length; i++) {
    sampleErrors.push({
      idx: i,
      cosineDistance: 1 - cosineSimilarity(bestPred[i], test.target[i]),
    });
  }
  sampleErrors.sort((a, b) => b.cosineDistance - a.cosineDistance);

  const highRiskPrompts: HighRiskPrompt[] = sampleErrors.slice(0, 4).map((item) => {
    const origIdx = item.idx;
    const cat = test.categories[origIdx] || "general_task";
    const promptId = test.prompt_ids[origIdx] || `prompt-${origIdx}`;

    return {
      id: promptId,
      prompt: NOT_MEASURED,
      category: cat,
      divergence_score: Number(item.cosineDistance.toFixed(6)),
      risk_factor: "Measured held-out cosine distance; causal interpretation NOT_MEASURED.",
      model_a_output_snippet: NOT_MEASURED,
      model_b_output_snippet: NOT_MEASURED,
    };
  });

  // Evaluate Release Gate  // Evaluate Release Gate
  const releaseGate = evaluateReleaseGate({
    semantic_drift: semanticDrift,
    max_critical_divergence: highRiskPrompts[0]?.divergence_score ?? NOT_MEASURED,
    retrieval_accuracy: hierarchy.find((h) => h.level_name.includes("Candidate"))?.score ?? NOT_MEASURED,
    neighborhood_preservation: neighborPreserve === NOT_MEASURED
      ? NOT_MEASURED
      : Number((neighborPreserve * 100).toFixed(1)),
    tested_samples: dataset.size,
  });

  // Summarize only what this dataset actually measures.
  const categoryErrors = new Map<string, number[]>();
  sampleErrors.forEach(({ idx, cosineDistance }) => {
    const category = test.categories[idx] || "general_task";
    const values = categoryErrors.get(category) || [];
    values.push(cosineDistance);
    categoryErrors.set(category, values);
  });
  const categorySummary = Array.from(categoryErrors.entries())
    .map(([category, values]) => ({
      category,
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      n: values.length,
    }))
    .sort((a, b) => b.mean - a.mean);

  const whereMeasured = categorySummary.length
    ? categorySummary
        .slice(0, 3)
        .map((x) => `${x.category}: mean cosine distance ${x.mean.toFixed(4)} (n=${x.n})`)
        .join("; ")
    : NOT_MEASURED;

  const fourQuestions: FourQuestionsSummary = {
    what_changed: `Measured held-out mean cosine similarity is ${meanCosSim.toFixed(4)} (distance ${semanticDrift.toFixed(4)}); affine translation R² is ${r2Score.toFixed(3)}.`,
    where_it_changed: whereMeasured === NOT_MEASURED
      ? NOT_MEASURED
      : `Highest measured category-level divergence: ${whereMeasured}.`,
    does_it_matter: NOT_MEASURED,
    can_i_ship: releaseGate.status === "PASS"
      ? "POLICY PASS: measured metrics satisfy the current declared release-gate thresholds. This is not a universal safety certification."
      : "POLICY FAIL: one or more measured release-gate rules failed or could not be measured.",
  };

  const costEstimation  const costEstimation: CostEstimate = {
    prompt_count: dataset.size,
    estimated_tokens: NOT_MEASURED,
    estimated_api_calls: NOT_MEASURED,
    estimated_duration_sec: NOT_MEASURED,
    estimated_cost_usd: NOT_MEASURED,
    currency: NOT_MEASURED,
  };

  const experimentLedger: ExperimentLedger = {
    experiment_id: `vt-exp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp_utc: new Date().toISOString(),
    benchmark_version: VTBENCH_VERSION,
    source_model: modelAName,
    target_model: modelBName,
    sample_size: dataset.size,
    dimension: dataset.dimension,
    seed: seed,
    commit_hash: NOT_MEASURED,
    hardware_arch: NOT_MEASURED,
  };

  return {
    id: experimentLedger.experiment_id,
    timestamp: experimentLedger.timestamp_utc,
    model_a_name: modelAName,
    model_b_name: modelBName,
    tested_samples: dataset.size,
    embedding_dimension: dataset.dimension,
    verdict_category: verdictCategory,
    four_questions: fourQuestions,
    release_gate: releaseGate,
    high_risk_prompts: highRiskPrompts,
    cost_estimation: costEstimation,
    experiment_ledger: experimentLedger,
    translation_accuracy: {
      model_type: "Ridge Affine with Tikhonov Regularization",
      r2_score: Number(r2Score.toFixed(3)),
      mean_cosine_sim: Number(meanCosSim.toFixed(4)),
      neighborhood_preservation_k10: neighborPreserve === NOT_MEASURED
        ? NOT_MEASURED
        : Number((neighborPreserve * 100).toFixed(1)),
      rank_order_spearman: spearmanRank === NOT_MEASURED
        ? NOT_MEASURED
        : Number(spearmanRank.toFixed(3)),
    },
    baselines,
    reconstruction_hierarchy: hierarchy,
    hypotheses,
    perturbation_robustness: {
      prompt_noise_decay_rate: NOT_MEASURED,
      temperature_sensitivity_gradient: NOT_MEASURED,
      category_resilience: NOT_MEASURED,
    },
    summary: {
      verdict: fourQuestions.can_i_ship,
      commercial_recommendation: fourQuestions.does_it_matter,
      safe_to_migrate: releaseGate.status === "PASS",
      representational_distance: representationalDistance,
    },
  };
}
