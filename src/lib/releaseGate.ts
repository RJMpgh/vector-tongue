/**
 * CI/CD Release Gate Engine for Vector Tongue.
 * Evaluates whether a candidate model meets automated release policy thresholds.
 */
import { ReleaseGatePolicy, ReleaseGateResult, ReleaseGateRuleEvaluation } from "../types";

export const DEFAULT_RELEASE_POLICY: ReleaseGatePolicy = {
  max_semantic_drift: 0.15,
  critical_category_max_divergence: 0.20,
  min_retrieval_preservation: 75.0,
  min_neighborhood_preservation: 45.0,
  disallow_untested_categories: true,
};

export function evaluateReleaseGate(
  metrics: {
    semantic_drift: number;
    max_critical_divergence: number;
    retrieval_accuracy: number;
    neighborhood_preservation: number;
    tested_samples: number;
  },
  policy: ReleaseGatePolicy = DEFAULT_RELEASE_POLICY
): ReleaseGateResult {
  const rules: ReleaseGateRuleEvaluation[] = [];

  // Rule 1: Overall Semantic Drift
  const driftPassed = metrics.semantic_drift <= policy.max_semantic_drift;
  rules.push({
    rule: "Overall Semantic Drift Limit",
    target_threshold: `≤ ${(policy.max_semantic_drift * 100).toFixed(1)}%`,
    actual_value: `${(metrics.semantic_drift * 100).toFixed(1)}%`,
    passed: driftPassed,
    severity: "critical",
  });

  // Rule 2: Critical Category Regression
  const criticalPassed = metrics.max_critical_divergence <= policy.critical_category_max_divergence;
  rules.push({
    rule: "Critical Category Zero-Regression Boundary",
    target_threshold: `≤ ${(policy.critical_category_max_divergence * 100).toFixed(1)}%`,
    actual_value: `${(metrics.max_critical_divergence * 100).toFixed(1)}%`,
    passed: criticalPassed,
    severity: "critical",
  });

  // Rule 3: Top-1 Retrieval Preservation
  const retrievalPassed = metrics.retrieval_accuracy >= policy.min_retrieval_preservation;
  rules.push({
    rule: "Cross-Model Retrieval Preservation",
    target_threshold: `≥ ${policy.min_retrieval_preservation.toFixed(1)}%`,
    actual_value: `${metrics.retrieval_accuracy.toFixed(1)}%`,
    passed: retrievalPassed,
    severity: "warning",
  });

  // Rule 4: Neighborhood Retention
  const neighborPassed = metrics.neighborhood_preservation >= policy.min_neighborhood_preservation;
  rules.push({
    rule: "Top-10 Neighborhood Cluster Preservation",
    target_threshold: `≥ ${policy.min_neighborhood_preservation.toFixed(1)}%`,
    actual_value: `${metrics.neighborhood_preservation.toFixed(1)}%`,
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

  const summary = overallPassed
    ? "GATE PASSED: Candidate model exhibits compliant behavioral alignment. Safe for release pipeline."
    : `GATE FAILED: ${failedCount} release gate check(s) violated. Deployment blocked until drift is calibrated.`;

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
