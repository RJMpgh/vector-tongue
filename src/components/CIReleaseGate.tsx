import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Sliders,
  AlertTriangle,
  FileCode,
  Download,
} from "lucide-react";
import { ReleaseGatePolicy, ReleaseGateResult } from "../types";
import { DEFAULT_RELEASE_POLICY, evaluateReleaseGate, GITHUB_ACTION_WORKFLOW_YAML } from "../lib/releaseGate";

interface CIReleaseGateProps {
  currentMetrics?: {
    semantic_drift: number;
    max_critical_divergence: number;
    retrieval_accuracy: number;
    neighborhood_preservation: number;
    tested_samples: number;
  };
}

export const CIReleaseGate: React.FC<CIReleaseGateProps> = ({ currentMetrics }) => {
  const [policy, setPolicy] = useState<ReleaseGatePolicy>(DEFAULT_RELEASE_POLICY);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  // Metrics from current experiment or realistic candidate defaults
  const activeMetrics = currentMetrics || {
    semantic_drift: 0.118,
    max_critical_divergence: 0.165,
    retrieval_accuracy: 86.4,
    neighborhood_preservation: 52.8,
    tested_samples: 120,
  };

  const gateResult: ReleaseGateResult = evaluateReleaseGate(activeMetrics, policy);

  const copyYaml = () => {
    navigator.clipboard.writeText(GITHUB_ACTION_WORKFLOW_YAML);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  const cliCommand = `npx @vector-tongue/cli gate \\
  --baseline ./benchmarks/production-baseline.json \\
  --candidate ./benchmarks/candidate-model.json \\
  --max-drift ${policy.max_semantic_drift} \\
  --critical-category-max ${policy.critical_category_max_divergence} \\
  --min-retrieval ${policy.min_retrieval_preservation}`;

  const copyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Infrastructure Release Gate
              </span>
              <span className="text-xs text-slate-400">CI/CD Pipeline Integration</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Automated Model Qualification & Deployment Guardrails
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong className="text-slate-100">“Your unit tests tell you whether your code changed incorrectly. Vector Tongue tells you whether your AI changed incorrectly.”</strong> Block breaking behavioral regressions in GitHub Actions or CI pipelines before candidate models hit production.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`px-5 py-3 rounded-xl border flex items-center gap-3 shadow-lg ${
                gateResult.status === "PASS"
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/40 text-rose-300"
              }`}
            >
              {gateResult.status === "PASS" ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
              )}
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">Release Gate Verdict</span>
                <span className="text-lg font-bold">{gateResult.status} (Exit Code: {gateResult.exit_code})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Policy Sliders + Rule Evaluation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Policy Configuration */}
        <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Release Threshold Policy
            </h3>
            <button
              onClick={() => setPolicy(DEFAULT_RELEASE_POLICY)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300"
            >
              Reset Defaults
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Max Semantic Drift</span>
                <span className="font-mono text-indigo-300">{(policy.max_semantic_drift * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.40"
                step="0.01"
                value={policy.max_semantic_drift}
                onChange={(e) => setPolicy({ ...policy, max_semantic_drift: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-slate-800"
              />
              <p className="text-[10px] text-slate-500">Maximum allowed whole-manifold divergence between source and candidate.</p>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Critical Category Max Divergence</span>
                <span className="font-mono text-indigo-300">{(policy.critical_category_max_divergence * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.01"
                value={policy.critical_category_max_divergence}
                onChange={(e) => setPolicy({ ...policy, critical_category_max_divergence: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-slate-800"
              />
              <p className="text-[10px] text-slate-500">Zero-regression ceiling for high-stakes domains (legal, medical, safety).</p>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Min Cross-Model Retrieval</span>
                <span className="font-mono text-indigo-300">{policy.min_retrieval_preservation.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={policy.min_retrieval_preservation}
                onChange={(e) => setPolicy({ ...policy, min_retrieval_preservation: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-slate-800"
              />
              <p className="text-[10px] text-slate-500">Minimum Top-1 candidate retrieval fidelity across models.</p>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Min Neighborhood Cluster Retention</span>
                <span className="font-mono text-indigo-300">{policy.min_neighborhood_preservation.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="80"
                step="1"
                value={policy.min_neighborhood_preservation}
                onChange={(e) => setPolicy({ ...policy, min_neighborhood_preservation: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-slate-800"
              />
              <p className="text-[10px] text-slate-500">Top-10 nearest neighbor structure conservation.</p>
            </div>
          </div>
        </div>

        {/* Right: Rule Evaluation Table */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Evaluation Rules Breakdown
            </h3>
            <span className="text-[11px] text-slate-400">
              {gateResult.rules.filter((r) => r.passed).length} of {gateResult.rules.length} checks passed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Rule Definition</th>
                  <th className="py-2 px-3">Target Threshold</th>
                  <th className="py-2 px-3">Observed Value</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {gateResult.rules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-200 flex items-center gap-1.5">
                      {rule.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span>{rule.rule}</span>
                      {rule.severity === "critical" && (
                        <span className="px-1.5 py-0.2 text-[9px] rounded bg-rose-950/60 text-rose-400 border border-rose-800/40">
                          Critical
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{rule.target_threshold}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-200">{rule.actual_value}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rule.passed
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {rule.passed ? "PASS" : "FAIL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-lg text-xs text-slate-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Release Gate Logic:</strong> All critical rules must pass unconditionally. Non-critical rules (warnings) tolerate minor variations provided overall statistical significance satisfies $p &lt; 0.05$.
            </p>
          </div>
        </div>
      </div>

      {/* CI/CD Integration: GitHub Action + CLI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GitHub Action */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">GitHub Action Workflow</h3>
            </div>
            <button
              onClick={copyYaml}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              {copiedYaml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedYaml ? "Copied" : "Copy YAML"}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Drop into <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded">.github/workflows/vector-tongue-gate.yml</code> to run on every Pull Request modifying prompts or model configs:
          </p>
          <pre className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
            {GITHUB_ACTION_WORKFLOW_YAML}
          </pre>
        </div>

        {/* CLI / SDK Integration */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">CLI & SDK Integration</h3>
            </div>
            <button
              onClick={copyCli}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              {copiedCli ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCli ? "Copied" : "Copy Command"}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Execute directly from terminal, Docker container, or CI release script:
          </p>
          <pre className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-32 leading-relaxed">
            {cliCommand}
          </pre>

          <div className="pt-2 border-t border-slate-800/80">
            <h4 className="text-xs font-semibold text-slate-300 mb-1">TypeScript / JavaScript SDK</h4>
            <pre className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] font-mono text-indigo-300 overflow-x-auto leading-relaxed">
{`import { vt } from "@vector-tongue/sdk";

const audit = await vt.compare("claude-3-5-sonnet", "gpt-4o", {
  corpus: "vt-bench-v1"
});

const gate = await vt.gate(audit, { maxDrift: 0.15 });
if (!gate.passed) {
  throw new Error(\`Deployment blocked: \${gate.summary}\`);
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
