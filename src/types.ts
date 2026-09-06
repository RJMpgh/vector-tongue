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
