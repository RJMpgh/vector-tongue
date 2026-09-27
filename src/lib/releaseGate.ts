/**
 * CI/CD Release Gate Engine for Vector Tongue.
 * Evaluates whether a candidate model meets automated release policy thresholds.
 */
import { Measurement, ReleaseGatePolicy, ReleaseGateResult, ReleaseGateRuleEvaluation } from "../types";

export const DEFAULT_RELEASE_POLICY: ReleaseGatePolicy = {
  max_semantic_drift: 0.15,
  critical_category_max_divergence: 0.20,
  min_retrieval_preservation: 75.0,
  min_neighborhood_preservation: 45.0,
  disallow_untested_categories: true,
};

export function evaluateReleaseGate(
  metrics: {
    semantic_drift: Measurement<number>;
    max_critical_divergence: Measurement<number>;
    retrieval_accuracy: Measurement<number>;
    neighborhood_preservation: Measurement<number>;
    tested_samples: number;
  },
  policy: ReleaseGatePolicy = DEFAULT_RELEASE_POLICY
): ReleaseGateResult {
  const rules: ReleaseGateRuleEvaluation[] = [];

  const measured = (value: Measurement<number>): value is number =>
    typeof value === "number" && Number.isFinite(value);
  const fmtPct = (value: Measurement<number>, scale = 100) =>
    measured(value) ? `${(value * scale).toFixed(1)}%` : "NOT_MEASURED";

  // Rule 1: Overall Semantic Drift
  const driftPassed = measured(metrics.semantic_drift) && metrics.semantic_drift <= policy.max_semantic_drift;
  rules.push({
    rule: "Overall Semantic Drift Limit",
    target_threshold: `≤ ${(policy.max_semantic_drift * 100).toFixed(1)}%`,
    actual_value: fmtPct(metrics.semantic_drift),
    passed: driftPassed,
    severity: "critical",
  });

  // Rule 2: Critical Category Regression
  const criticalPassed = measured(metrics.max_critical_divergence) && metrics.max_critical_divergence <= policy.critical_category_max_divergence;
  rules.push({
    rule: "Critical Category Zero-Regression Boundary",
    target_threshold: `≤ ${(policy.critical_category_max_divergence * 100).toFixed(1)}%`,
    actual_value: fmtPct(metrics.max_critical_divergence),
    passed: criticalPassed,
    severity: "critical",
  });

  // Rule 3: Top-1 Retrieval Preservation
  const retrievalPassed = measured(metrics.retrieval_accuracy) && metrics.retrieval_accuracy >= policy.min_retrieval_preservation;
  rules.push({
    rule: "Cross-Model Retrieval Preservation",
    target_threshold: `≥ ${policy.min_retrieval_preservation.toFixed(1)}%`,
    actual_value: measured(metrics.retrieval_accuracy) ? `${metrics.retrieval_accuracy.toFixed(1)}%` : "NOT_MEASURED",
    passed: retrievalPassed,
    severity: "warning",
  });

  // Rule 4: Neighborhood Retention
  const neighborPassed = measured(metrics.neighborhood_preservation) && metrics.neighborhood_preservation >= policy.min_neighborhood_preservation;
  rules.push({
    rule: "Top-10 Neighborhood Cluster Preservation",
    target_threshold: `≥ ${policy.min_neighborhood_preservation.toFixed(1)}%`,
    actual_value: measured(metrics.neighborhood_preservation) ? `${metrics.neighborhood_preservation.toFixed(1)}%` : "NOT_MEASURED",
    passed: neighborPassed,
    severity: "warning",
  });

  // Rule 5: Statistical Power / Sample Volume
  const samplePassed = metrics.tested_samples >= 25;
  rules.push({
    rule: "Minimum Statistical Sample Corpus",
    target_threshold: "≥ 25 prompts",
    actual_value: `${metrics.tested_samples} prompts`,
    passed: samplePassed,
    severity: "critical",
  });

  const allCriticalPassed = rules
    .filter((r) => r.severity === "critical")
    .every((r) => r.passed);
  const overallPassed = allCriticalPassed && rules.filter((r) => r.passed).length >= 4;

  const failedCount = rules.filter((r) => !r.passed).length;
  const status: "PASS" | "FAIL" = overallPassed ? "PASS" : "FAIL";

  const hasUnmeasured = [
    metrics.semantic_drift,
    metrics.max_critical_divergence,
    metrics.retrieval_accuracy,
    metrics.neighborhood_preservation,
  ].some((value) => !measured(value));

  const summary = overallPassed
    ? "GATE PASSED: measured metrics satisfy the declared release policy. This is not a universal safety certification."
    : hasUnmeasured
      ? `GATE FAILED: ${failedCount} check(s) failed or were NOT_MEASURED. Release decision remains incomplete.`
      : `GATE FAILED: ${failedCount} release gate check(s) violated.`;

  return {
    status,
    rules,
    summary,
    exit_code: overallPassed ? 0 : 1,
  };
}

export const GITHUB_ACTION_WORKFLOW_YAML = `name: Vector Tongue Model Release Gate

on:
  pull_request:
    branches: [ main, production ]
    paths:
      - 'prompts/**'
      - 'models/**'
      - 'config/model.json'

jobs:
  model-audit-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run Vector Tongue Release Gate
        env:
          VECTOR_TONGUE_API_URL: https://ais-pre-4pyciz5tejjrhqfvyjpqeu-52422669128.us-east1.run.app
        run: |
          npx @vector-tongue/cli gate \\
            --baseline ./benchmarks/production-baseline.json \\
            --candidate ./benchmarks/candidate-model.json \\
            --max-drift 0.15 \\
            --critical-category-max 0.20 \\
            --fail-on-regression

      - name: Publish Vector Tongue Audit Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: vector-tongue-audit-report
          path: ./vector-tongue-report.json
`;
