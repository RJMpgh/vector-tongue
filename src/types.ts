export interface EmbeddingPairItem {
  prompt_id: string;
  source: number[];
  target: number[];
  category: string;
}

export interface MetricInterval {
  estimate: number;
  lower: number;
  upper: number;
  confidence: number;
  resamples: number;
}

export interface MetricSummary {
  mean: number;
  interval: MetricInterval;
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
  predictions?: number[][];
  test_sources?: number[][];
  test_targets?: number[][];
  row_errors?: {
    prompt_id: string;
    category: string;
    squared_error: number;
    cosine_distance: number;
  }[];
}

export interface PermutationResult {
  observed: number;
  null_mean: number;
  p_value: number;
  permutations: number;
}

export interface DriftResult {
  cosine_distance: number;
  euclidean_displacement: number;
  norm_shift: number;
  marler_drift_v1: number;
  norm_a: number;
  norm_b: number;
  cosine_similarity: number;
}

export interface ArtifactCheck {
  path: string;
  expected_sha256: string;
  actual_sha256: string | null;
  status: "match" | "mismatch" | "missing" | "invalid_hash";
  role?: string;
  byte_size?: number;
}

export interface ReconstructionLevelResult {
  level_name: string;
  description: string;
  metric: string;
  score: number; // 0 to 100 or ratio
  baseline_score: number;
  effect_size: number; // Cohen's d or delta
  confidence_interval: [number, number];
  falsified: boolean;
  notes: string;
}

export type MigrationVerdict =
  | "SAFE"
  | "SAFE WITH CAVEATS"
  | "REVIEW REQUIRED"
  | "UNSAFE"
  | "INSUFFICIENT EVIDENCE";

export interface FourQuestionsSummary {
  what_changed: string;
  where_it_changed: string;
  does_it_matter: string;
  can_i_ship: string;
}

export interface HighRiskPrompt {
  id: string;
  prompt: string;
  category: string;
  divergence_score: number; // 0 to 1
  risk_factor: string;
  model_a_output_snippet: string;
  model_b_output_snippet: string;
  affected_dimension?: number;
}

export interface ReleaseGatePolicy {
  max_semantic_drift: number; // e.g. 0.15
  critical_category_max_divergence: number; // e.g. 0.20
  min_retrieval_preservation: number; // e.g. 70 (%)
  min_neighborhood_preservation: number; // e.g. 40 (%)
  disallow_untested_categories: boolean;
}

export interface ReleaseGateRuleEvaluation {
  rule: string;
  target_threshold: string;
  actual_value: string;
  passed: boolean;
  severity: "critical" | "warning";
}

export interface ReleaseGateResult {
  status: "PASS" | "FAIL";
  rules: ReleaseGateRuleEvaluation[];
  summary: string;
  exit_code: 0 | 1;
}

export interface CostEstimate {
  prompt_count: number;
  estimated_tokens: number;
  estimated_api_calls: number;
  estimated_duration_sec: number;
  estimated_cost_usd: number;
  currency: string;
}

export interface VTBenchPrompt {
  id: string;
  category:
    | "factual_reasoning"
    | "instruction_following"
    | "ambiguity"
    | "summarization"
    | "extraction"
    | "coding"
    | "safety_boundary"
    | "tone"
    | "formatting"
    | "entity_preservation"
    | "long_context"
    | "refusal_behavior"
    | "adversarial_paraphrase"
    | "uncertainty";
  prompt: string;
  eval_criteria: string;
}

export interface ExperimentLedger {
  experiment_id: string;
  timestamp_utc: string;
  benchmark_version: string;
  source_model: string;
  target_model: string;
  sample_size: number;
  dimension: number;
  seed: number;
  commit_hash?: string;
  hardware_arch: string;
}

export interface ObservabilityAuditResult {
  id: string;
  timestamp: string;
  model_a_name: string;
  model_b_name: string;
  tested_samples: number;
  embedding_dimension: number;
  verdict_category: MigrationVerdict;
  four_questions: FourQuestionsSummary;
  release_gate: ReleaseGateResult;
  high_risk_prompts: HighRiskPrompt[];
  cost_estimation: CostEstimate;
  experiment_ledger: ExperimentLedger;
  // Baselines comparison
  translation_accuracy: {
    model_type: string;
    r2_score: number;
    mean_cosine_sim: number;
    neighborhood_preservation_k10: number; // rank order / top-k retention
    rank_order_spearman: number;
  };
  baselines: {
    identity_mse: number;
    target_mean_mse: number;
    mean_shift_mse: number;
    knn_mse: number;
    ridge_mse: number;
    procrustes_mse: number;
    kernel_rbf_mse: number;
  };
  // Reconstruction hierarchy
  reconstruction_hierarchy: ReconstructionLevelResult[];
  // Falsifiable Hypotheses status
  hypotheses: {
    id: string;
    statement: string;
    status: "SUPPORTED" | "REFUTED" | "INCONCLUSIVE";
    p_value: number;
    observed_statistic: number;
    null_threshold: number;
    implication: string;
  }[];
  // Drift & Perturbation
  perturbation_robustness: {
    prompt_noise_decay_rate: number;
    temperature_sensitivity_gradient: number;
    category_resilience: Record<string, number>;
  };
  summary: {
    verdict: string;
    commercial_recommendation: string;
    safe_to_migrate: boolean;
    representational_distance: number;
  };
}

export interface ManifestReport {
  manifest_version: string;
  project?: string;
  recorded_by?: string;
  artifacts: ArtifactCheck[];
  polygon_status: string;
  warnings: string[];
  all_local_hashes_match: boolean;
  cautions?: string[];
  hashchain_record?: {
    timestamp_utc?: string;
    inventor_name_on_record?: string;
    contact_email?: string;
    title_on_record?: string;
  };
  polygon?: {
    network?: string;
    verification_status?: string;
    wallet_address?: string | null;
    transaction_hash?: string | null;
    contract_address?: string | null;
    token_id?: string | null;
    ipfs_uri?: string | null;
  };
}
