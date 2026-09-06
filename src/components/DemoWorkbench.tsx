import React, { useState, useEffect } from "react";
import { Play, Sparkles, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp, Info } from "lucide-react";
import { EvaluationReport } from "../types";
import { syntheticTranslationDataset } from "../lib/data";
import { RidgeTranslator } from "../lib/models";
import { evaluateTranslator } from "../lib/evaluation";

export const DemoWorkbench: React.FC = () => {
  const [samples, setSamples] = useState<number>(80);
  const [dimension, setDimension] = useState<number>(12);
  const [noise, setNoise] = useState<number>(0.025);
  const [regularization, setRegularization] = useState<number>(0.1);
  const [seed, setSeed] = useState<number>(17);

  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [datasetMeta, setDatasetMeta] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runDemo = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try API first
      try {
        const res = await fetch("/api/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            samples,
            dimension,
            noise,
            regularization,
            seed,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setReport(data.report);
          setDatasetMeta(data.dataset_meta);
          return;
        }
      } catch {
        // Fall back to client calculation below
      }

      // Client-side execution fallback for iOS/offline
      const dataset = syntheticTranslationDataset({
        samples,
        dimension,
        noise,
        seed,
      });
      const { train, test } = dataset.split(0.25, seed);
      const model = new RidgeTranslator(regularization);
      model.fit(train.source, train.target);
      const evalReport = evaluateTranslator(model, train, test, { includeDetails: true, seed });

      setReport(evalReport);
      setDatasetMeta({
        num_prompts: dataset.size,
        dimension: dataset.dimension,
        categories: Array.from(new Set(dataset.categories)),
      });
    } catch (err: any) {
      setError(err.message || "Failed to run demo simulation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDemo();
  }, []);

  const formatNum = (val: number | null | undefined, digits = 5) => {
    if (val === null || val === undefined) return "N/A";
    return val.toFixed(digits);
  };

  const formatPct = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "N/A";
    const pct = val * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-indigo-500/20 text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-semibold text-white">Deterministic Synthetic Demonstration</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Exercises the end-to-end Vector Tongue pipeline with known affine transformation (rotation + anisotropic scale + intercept + noise). Checks held-out generalization, baselines, and bootstrap uncertainty intervals.
            </p>
          </div>

          <button
            id="run-demo-btn"
            onClick={runDemo}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-md shadow-indigo-600/20 transition-all cursor-pointer whitespace-nowrap touch-manipulation min-h-[44px] active:scale-95 w-full sm:w-auto"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            <span>Run Pipeline</span>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            <strong>Methodological Note:</strong> Synthetic data validates experimental machinery; it is mathematically constructed and is not empirical proof of cross-model translation on real weights.
          </span>
        </div>
      </div>

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Samples (N)</label>
          <input
            id="demo-samples-input"
            type="number"
            min={12}
            max={500}
            value={samples}
            onChange={(e) => setSamples(Math.max(8, Number(e.target.value)))}
            className="w-full px-3 py-2 sm:py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm sm:text-xs text-white focus:outline-none focus:border-indigo-500 min-h-[40px] sm:min-h-0"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Embedding Dim (D)</label>
          <input
            id="demo-dimension-input"
            type="number"
            min={2}
            max={64}
            value={dimension}
            onChange={(e) => setDimension(Math.max(2, Number(e.target.value)))}
            className="w-full px-3 py-2 sm:py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm sm:text-xs text-white focus:outline-none focus:border-indigo-500 min-h-[40px] sm:min-h-0"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Noise Scale (&sigma;)</label>
          <input
            id="demo-noise-input"
            type="number"
            step="0.005"
            min={0}
            max={1.0}
            value={noise}
            onChange={(e) => setNoise(Math.max(0, Number(e.target.value)))}
            className="w-full px-3 py-2 sm:py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm sm:text-xs text-white focus:outline-none focus:border-indigo-500 min-h-[40px] sm:min-h-0"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">L2 Penalty (&lambda;)</label>
          <input
            id="demo-regularization-input"
            type="number"
            step="0.05"
            min={0}
            max={10.0}
            value={regularization}
            onChange={(e) => setRegularization(Math.max(0, Number(e.target.value)))}
            className="w-full px-3 py-2 sm:py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm sm:text-xs text-white focus:outline-none focus:border-indigo-500 min-h-[40px] sm:min-h-0"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Random Seed</label>
          <input
            id="demo-seed-input"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="w-full px-3 py-2 sm:py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm sm:text-xs text-white focus:outline-none focus:border-indigo-500 min-h-[40px] sm:min-h-0"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-xl">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Held-Out MSE</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Primary Metric
                </span>
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {formatNum(report.mean_squared_error.mean, 6)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                95% CI: <span className="text-slate-300 font-mono">[{formatNum(report.mean_squared_error.interval.lower, 6)}, {formatNum(report.mean_squared_error.interval.upper, 6)}]</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Cosine Distance</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  1 - Cosine
                </span>
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {formatNum(report.mean_cosine_distance.mean, 6)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                95% CI: <span className="text-slate-300 font-mono">[{formatNum(report.mean_cosine_distance.interval.lower, 6)}, {formatNum(report.mean_cosine_distance.interval.upper, 6)}]</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Train / Test Split</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Held-Out
                </span>
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {report.train_size} / {report.test_size}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Embedding dimension: <span className="text-slate-300 font-mono">{report.dimension}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Gain vs Mean-Shift</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  Advantage
                </span>
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono flex items-center gap-1">
                <TrendingUp className="w-5 h-5" />
                {formatPct(report.gain_vs_baseline["mean_shift"])}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                vs Identity: <span className="text-emerald-400 font-mono">{formatPct(report.gain_vs_baseline["identity"])}</span>
              </div>
            </div>
          </div>

          {/* Baseline Comparison Breakdown */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              Comparison with Declared Baselines
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-lg">
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span>Identity Baseline (\hat z_B = z_A)</span>
                  <span className="font-mono text-slate-300">{formatNum(report.baseline_mse["identity"], 5)}</span>
                </div>
                <div className="text-sm font-medium text-white flex justify-between items-center mt-2">
                  <span>Translation Model Gain:</span>
                  <span className={`font-mono ${Number(report.gain_vs_baseline["identity"]) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatPct(report.gain_vs_baseline["identity"])}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-lg">
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span>Target Mean Baseline (\hat z_B = \bar z_B)</span>
                  <span className="font-mono text-slate-300">{formatNum(report.baseline_mse["target_mean"], 5)}</span>
                </div>
                <div className="text-sm font-medium text-white flex justify-between items-center mt-2">
                  <span>Translation Model Gain:</span>
                  <span className={`font-mono ${Number(report.gain_vs_baseline["target_mean"]) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatPct(report.gain_vs_baseline["target_mean"])}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-lg">
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span>Mean-Shift Baseline (\hat z_B = z_A + \bar \delta)</span>
                  <span className="font-mono text-slate-300">{formatNum(report.baseline_mse["mean_shift"], 5)}</span>
                </div>
                <div className="text-sm font-medium text-white flex justify-between items-center mt-2">
                  <span>Translation Model Gain:</span>
                  <span className={`font-mono ${Number(report.gain_vs_baseline["mean_shift"]) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatPct(report.gain_vs_baseline["mean_shift"])}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2D Projection Visualization */}
          {report.predictions && report.test_sources && report.test_targets && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Held-Out Embedding Space Projection (Dim 0 vs Dim 1)</h3>
                  <p className="text-xs text-slate-400">
                    Comparing Source \(z_A\), Ground Truth Target \(z_B\), and Model Prediction \(\hat z_B\) on held-out test prompts.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                    <span className="text-slate-300">Source Model A</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <span className="text-slate-300">Target Model B (Truth)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-400/40"></span>
                    <span className="text-slate-300">Predicted \(\hat z_B\)</span>
                  </div>
                </div>
              </div>

              <div className="relative w-full h-72 bg-slate-950 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center p-4">
                <svg className="w-full h-full" viewBox="-3 -3 6 6" preserveAspectRatio="xMidYMid meet">
                  {/* Grid lines */}
                  <line x1="-3" y1="0" x2="3" y2="0" stroke="#1e293b" strokeWidth="0.02" />
                  <line x1="0" y1="-3" x2="0" y2="3" stroke="#1e293b" strokeWidth="0.02" />
                  <circle cx="0" cy="0" r="1" fill="none" stroke="#1e293b" strokeWidth="0.015" strokeDasharray="0.05,0.05" />
                  <circle cx="0" cy="0" r="2" fill="none" stroke="#1e293b" strokeWidth="0.015" strokeDasharray="0.05,0.05" />

                  {/* Connect prediction to truth with displacement vector */}
                  {report.predictions.map((pred, i) => {
                    const target = report.test_targets![i];
                    return (
                      <line
                        key={`line-${i}`}
                        x1={pred[0]}
                        y1={pred[1]}
                        x2={target[0]}
                        y2={target[1]}
                        stroke="#6366f1"
                        strokeWidth="0.02"
                        strokeOpacity="0.4"
                        strokeDasharray="0.04,0.04"
                      />
                    );
                  })}

                  {/* Source points */}
                  {report.test_sources.map((s, i) => (
                    <circle
                      key={`source-${i}`}
                      cx={s[0]}
                      cy={s[1]}
                      r="0.06"
                      fill="#22d3ee"
                      opacity="0.75"
                    />
                  ))}

                  {/* Target truth points */}
                  {report.test_targets.map((t, i) => (
                    <circle
                      key={`target-${i}`}
                      cx={t[0]}
                      cy={t[1]}
                      r="0.07"
                      fill="#34d399"
                    />
                  ))}

                  {/* Predicted points */}
                  {report.predictions.map((p, i) => (
                    <circle
                      key={`pred-${i}`}
                      cx={p[0]}
                      cy={p[1]}
                      r="0.08"
                      fill="#6366f1"
                      stroke="#818cf8"
                      strokeWidth="0.02"
                    />
                  ))}
                </svg>
              </div>
            </div>
          )}

          {/* Held-out Prompt Evaluation Table */}
          {report.row_errors && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white">Held-Out Test Sample Errors</h3>
                <span className="text-xs text-slate-400 font-mono">{report.row_errors.length} prompts evaluated</span>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-800 font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Prompt ID</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Squared Error</th>
                      <th className="py-2.5 px-4">Cosine Distance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {report.row_errors.map((row) => (
                      <tr key={row.prompt_id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-4 text-indigo-300 font-semibold">{row.prompt_id}</td>
                        <td className="py-2 px-4 text-slate-300">
                          <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
                            {row.category}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-slate-200">{formatNum(row.squared_error, 5)}</td>
                        <td className="py-2 px-4 text-slate-200">{formatNum(row.cosine_distance, 5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
