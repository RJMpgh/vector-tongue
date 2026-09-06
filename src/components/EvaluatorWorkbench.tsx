import React, { useState, useEffect } from "react";
import { Upload, FileText, Play, RefreshCw, CheckCircle, ShieldAlert, Sliders, Database } from "lucide-react";
import { EvaluationReport, PermutationResult } from "../types";
import { parseEmbeddingPairsCsv } from "../lib/data";
import { RidgeTranslator, OrthogonalTranslator } from "../lib/models";
import { evaluateTranslator } from "../lib/evaluation";
import { pairedTargetPermutationTest } from "../lib/statistics";

const EMBEDDED_SAMPLE_CSV = `prompt_id,category,source_embedding,target_embedding
p001,factual,"[1.0, 0.0, 0.2]","[0.8, 0.3, 0.1]"
p002,factual,"[0.9, 0.1, 0.1]","[0.7, 0.4, 0.0]"
p003,reasoning,"[0.1, 1.0, 0.2]","[-0.2, 0.8, 0.4]"
p004,reasoning,"[0.2, 0.8, 0.3]","[-0.1, 0.7, 0.5]"
p005,creative,"[0.2, 0.1, 1.0]","[0.1, -0.2, 0.9]"
p006,creative,"[0.3, 0.2, 0.8]","[0.2, -0.1, 0.7]"
p007,safety,"[0.7, 0.6, 0.1]","[0.4, 0.7, 0.2]"
p008,safety,"[0.6, 0.7, 0.2]","[0.3, 0.8, 0.3]"
p009,factual,"[0.85, 0.15, 0.1]","[0.65, 0.35, 0.05]"
p010,reasoning,"[0.15, 0.9, 0.25]","[-0.15, 0.75, 0.45]"
p011,creative,"[0.25, 0.15, 0.9]","[0.15, -0.15, 0.8]"
p012,safety,"[0.65, 0.65, 0.15]","[0.35, 0.75, 0.25]"`;

export const EvaluatorWorkbench: React.FC = () => {
  const [csvText, setCsvText] = useState<string>("");
  const [modelType, setModelType] = useState<"ridge" | "orthogonal">("ridge");
  const [regularization, setRegularization] = useState<number>(1.0);
  const [testFraction, setTestFraction] = useState<number>(0.25);
  const [seed, setSeed] = useState<number>(17);
  const [runPermutation, setRunPermutation] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [permutation, setPermutation] = useState<PermutationResult | null>(null);
  const [datasetMeta, setDatasetMeta] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load sample CSV from server with embedded fallback
  const loadSampleCsv = async () => {
    try {
      const res = await fetch("/api/sample-csv");
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          setCsvText(text);
          return;
        }
      }
    } catch {
      // Fall through to embedded sample
    }
    setCsvText(EMBEDDED_SAMPLE_CSV);
  };

  useEffect(() => {
    loadSampleCsv();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvText(content);
        setError(null);
      }
    };
    reader.readAsText(file);
    // Reset so re-uploading the same file works reliably on iOS Safari
    e.target.value = "";
  };

  const runEvaluation = async () => {
    if (!csvText.trim()) {
      setError("Please provide paired embeddings CSV data.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Attempt server-side computation
      try {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csv: csvText,
            model: modelType,
            regularization,
            test_fraction: testFraction,
            seed,
            run_permutation: runPermutation,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setReport(data.report);
          setPermutation(data.permutation);
          setDatasetMeta(data.dataset_meta);
          return;
        }
      } catch {
        // Fall back to client calculation below
      }

      // High-performance client-side fallback for iOS WebKit/offline execution
      const dataset = parseEmbeddingPairsCsv(csvText);
      const { train, test } = dataset.split(testFraction, seed);
      const model = modelType === "ridge"
        ? new RidgeTranslator(regularization)
        : new OrthogonalTranslator();

      model.fit(train.source, train.target);
      const evalReport = evaluateTranslator(model, train, test, { includeDetails: true, seed });

      let permRes: PermutationResult | null = null;
      if (runPermutation) {
        permRes = pairedTargetPermutationTest(
          test.source,
          test.target,
          (X, Y) => {
            const pred = model.predict(X);
            let sumSq = 0;
            for (let i = 0; i < pred.length; i++) {
              for (let j = 0; j < pred[0].length; j++) {
                const diff = pred[i][j] - Y[i][j];
                sumSq += diff * diff;
              }
            }
            return sumSq / pred.length;
          },
          { permutations: 40, seed }
        );
      }

      setReport(evalReport);
      setPermutation(permRes);
      setDatasetMeta({
        num_prompts: dataset.size,
        dimension: dataset.dimension,
        categories: Array.from(new Set(dataset.categories)),
      });
    } catch (err: any) {
      setError(err.message || "Evaluation failed. Please check CSV format.");
    } finally {
      setLoading(false);
    }
  };

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
      {/* Top Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-indigo-500/20 text-indigo-400">
                <Database className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-semibold text-white">Empirical Paired Embedding Evaluator</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Upload or inspect matched prompts with model embeddings z_&#123;A,p&#125; = E(y_&#123;A,p&#125;) and z_&#123;B,p&#125; = E(y_&#123;B,p&#125;). Evaluates translation operators strictly on held-out prompt splits with declared baseline comparisons and permutation falsification controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadSampleCsv}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[40px] active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Load Preset CSV</span>
            </button>

            <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[40px] active:scale-95">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV</span>
              <input
                type="file"
                accept=".csv,text/csv,text/plain,application/vnd.ms-excel,text/comma-separated-values"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Input & Parameters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CSV Editor */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Paired Embeddings CSV
            </label>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">schema: prompt_id, category, source_embedding, target_embedding</span>
          </div>
          <textarea
            id="csv-input-textarea"
            rows={9}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`prompt_id,category,source_embedding,target_embedding\np001,factual,"[1.0, 0.0, 0.2]","[0.8, 0.3, 0.1]"`}
            className="w-full flex-1 p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-sm sm:text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y min-h-[160px]"
          />
        </div>

        {/* Experiment Configuration */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Model & Split Parameters</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Translation Operator</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModelType("ridge")}
                    className={`px-3 py-2.5 sm:py-2 text-xs font-medium rounded-lg border transition-all touch-manipulation min-h-[40px] sm:min-h-0 active:scale-95 ${
                      modelType === "ridge"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Ridge Affine
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelType("orthogonal")}
                    className={`px-3 py-2.5 sm:py-2 text-xs font-medium rounded-lg border transition-all touch-manipulation min-h-[40px] sm:min-h-0 active:scale-95 ${
                      modelType === "orthogonal"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Orthogonal Procrustes
                  </button>
                </div>
              </div>

              {modelType === "ridge" && (
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Regularization (L2 &lambda;)</span>
                    <span className="font-mono text-slate-300">{regularization.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.01}
                    max={10.0}
                    step={0.05}
                    value={regularization}
                    onChange={(e) => setRegularization(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-6 sm:h-4 touch-none py-1"
                  />
                </div>
              )}

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Held-Out Test Fraction</span>
                  <span className="font-mono text-slate-300">{(testFraction * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.5}
                  step={0.05}
                  value={testFraction}
                  onChange={(e) => setTestFraction(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-6 sm:h-4 touch-none py-1"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Split Random Seed</label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                  className="w-full px-3 py-2 sm:py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm sm:text-xs font-mono text-white focus:outline-none focus:border-indigo-500 min-h-[40px] sm:min-h-0"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 touch-manipulation min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={runPermutation}
                    onChange={(e) => setRunPermutation(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Run Shuffled-Target Permutation Test</span>
                </label>
              </div>
            </div>
          </div>

          <button
            id="run-evaluate-btn"
            onClick={runEvaluation}
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 transition-all cursor-pointer touch-manipulation min-h-[44px] active:scale-95"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            <span>Evaluate Translation</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Results Section */}
      {report && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs font-medium text-slate-400">Held-Out MSE</span>
              <div className="text-2xl font-bold text-white mt-1 font-mono">
                {formatNum(report.mean_squared_error.mean, 6)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                95% CI: <span className="text-slate-300 font-mono">[{formatNum(report.mean_squared_error.interval.lower, 6)}, {formatNum(report.mean_squared_error.interval.upper, 6)}]</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs font-medium text-slate-400">Cosine Distance</span>
              <div className="text-2xl font-bold text-white mt-1 font-mono">
                {formatNum(report.mean_cosine_distance.mean, 6)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                95% CI: <span className="text-slate-300 font-mono">[{formatNum(report.mean_cosine_distance.interval.lower, 6)}, {formatNum(report.mean_cosine_distance.interval.upper, 6)}]</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs font-medium text-slate-400">Dataset Partition</span>
              <div className="text-2xl font-bold text-white mt-1 font-mono">
                {report.train_size} train / {report.test_size} test
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Dimension: <span className="text-slate-300 font-mono">{report.dimension}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs font-medium text-slate-400">Gain vs Mean-Shift</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                {formatPct(report.gain_vs_baseline["mean_shift"])}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                vs Identity: <span className="text-emerald-400 font-mono">{formatPct(report.gain_vs_baseline["identity"])}</span>
              </div>
            </div>
          </div>

          {/* Declared Baselines vs Model */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-400" />
              Baselines & Predictive Advantage
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Identity Baseline:</span>
                  <span className="font-mono text-slate-300">{formatNum(report.baseline_mse["identity"], 5)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-white mt-2">
                  <span>Model Advantage:</span>
                  <span className={`font-mono ${Number(report.gain_vs_baseline["identity"]) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatPct(report.gain_vs_baseline["identity"])}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Target-Mean Baseline:</span>
                  <span className="font-mono text-slate-300">{formatNum(report.baseline_mse["target_mean"], 5)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-white mt-2">
                  <span>Model Advantage:</span>
                  <span className={`font-mono ${Number(report.gain_vs_baseline["target_mean"]) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatPct(report.gain_vs_baseline["target_mean"])}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Mean-Shift Baseline:</span>
                  <span className="font-mono text-slate-300">{formatNum(report.baseline_mse["mean_shift"], 5)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-white mt-2">
                  <span>Model Advantage:</span>
                  <span className={`font-mono ${Number(report.gain_vs_baseline["mean_shift"]) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatPct(report.gain_vs_baseline["mean_shift"])}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Permutation Test Falsification Card */}
          {permutation && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Negative Control: Shuffled-Target Permutation Test</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Tests whether observed translation performance exceeds the null distribution obtained by randomly breaking prompt correspondence (shuffling targets).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <div className="text-slate-400 mb-1">Observed Error</div>
                  <div className="text-base font-bold font-mono text-white">{formatNum(permutation.observed, 5)}</div>
                </div>
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <div className="text-slate-400 mb-1">Null Mean Error</div>
                  <div className="text-base font-bold font-mono text-slate-300">{formatNum(permutation.null_mean, 5)}</div>
                </div>
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <div className="text-slate-400 mb-1">Empirical p-value</div>
                  <div className={`text-base font-bold font-mono ${permutation.p_value < 0.05 ? "text-emerald-400" : "text-amber-400"}`}>
                    {formatNum(permutation.p_value, 4)}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <div className="text-slate-400 mb-1">Permutations</div>
                  <div className="text-base font-bold font-mono text-slate-300">{permutation.permutations}</div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Prompt Evaluation Table */}
          {report.row_errors && report.row_errors.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white">Held-Out Test Sample Errors</h3>
                <span className="text-xs text-slate-400 font-mono">{report.row_errors.length} prompts</span>
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
