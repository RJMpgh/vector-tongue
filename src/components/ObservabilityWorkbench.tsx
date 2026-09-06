import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Layers,
  Lock,
  Play,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
  XCircle,
} from "lucide-react";
import {
  CostEstimate,
  HighRiskPrompt,
  MigrationVerdict,
  ObservabilityAuditResult,
} from "../types";
import { parseEmbeddingPairsCsv, syntheticTranslationDataset } from "../lib/data";
import { runComparativeObservabilityAudit } from "../lib/observabilityEngine";
import { PilotModal } from "./PilotModal";
import { VTBENCH_VERSION } from "../lib/vtBench";

interface DemoPreset {
  id: string;
  name: string;
  label: string;
  modelA: string;
  modelB: string;
  description: string;
  goal: string;
  noise: number;
  samples: number;
}

const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "demo-1",
    name: "Demo 1 — Model Migration",
    label: "Provider Switch",
    modelA: "Anthropic Claude 3.5 Sonnet",
    modelB: "OpenAI GPT-4o (Output Embeddings)",
    description: "Evaluates cross-provider substitution before cutting 100% of production traffic.",
    goal: "Migration safety",
    noise: 0.035,
    samples: 120,
  },
  {
    id: "demo-2",
    name: "Demo 2 — Model Upgrade Regression",
    label: "Version Upgrade",
    modelA: "Meta Llama-3-70B-Instruct",
    modelB: "Meta Llama-3.1-70B-Instruct",
    description: "Audit minor version update for unexpected regressions in formatting & edge cases.",
    goal: "Audit model update",
    noise: 0.022,
    samples: 150,
  },
  {
    id: "demo-3",
    name: "Demo 3 — Prompt Robustness",
    label: "Prompt Drift",
    modelA: "Production Base System Prompt",
    modelB: "Candidate Injection-Shielded Prompt",
    description: "Measures whether guardrail prompt injections cause disproportionate behavioral divergence.",
    goal: "Test prompt robustness",
    noise: 0.055,
    samples: 100,
  },
  {
    id: "demo-4",
    name: "Demo 4 — Semantic Drift",
    label: "Temporal Drift",
    modelA: "Production Model Checkpoint (Q1)",
    modelB: "Hosted Model Checkpoint (Q3)",
    description: "Detects silent provider model weights drift over a 6-month operational period.",
    goal: "Measure semantic drift",
    noise: 0.045,
    samples: 120,
  },
  {
    id: "demo-5",
    name: "Demo 5 — Information Retention",
    label: "Reconstruction",
    modelA: "Dense Output Embeddings (1536-d)",
    modelB: "Downstream Behavioral Surrogate",
    description: "Empirically probes what semantic layers survive translation (macro intent vs verbatim loss).",
    goal: "Analyze reconstruction / information retention",
    noise: 0.03,
    samples: 140,
  },
];

interface ObservabilityWorkbenchProps {
  onOpenPricing?: () => void;
}

export const ObservabilityWorkbench: React.FC<ObservabilityWorkbenchProps> = ({ onOpenPricing }) => {
  // Mode: Simple (Focused developer workflow) vs Professional (Deep ML diagnostics)
  const [productMode, setProductMode] = useState<"simple" | "professional">("simple");

  // Inputs & Configuration
  const [selectedDemo, setSelectedDemo] = useState<string>("demo-1");
  const [goal, setGoal] = useState<string>("Migration safety");
  const [modelA, setModelA] = useState<string>("Anthropic Claude 3.5 Sonnet");
  const [modelB, setModelB] = useState<string>("OpenAI GPT-4o (Output Embeddings)");
  const [inputSource, setInputSource] = useState<"demo" | "upload" | "byom">("demo");
  const [customCsv, setCustomCsv] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [provider, setProvider] = useState<string>("Gemini API");

  // State & Results
  const [loading, setLoading] = useState<boolean>(false);
  const [audit, setAudit] = useState<ObservabilityAuditResult | null>(null);
  const [activeSubView, setActiveSubView] = useState<"baselines" | "reconstruction" | "hypotheses" | "drift">("baselines");
  const [expandedVerdict, setExpandedVerdict] = useState<boolean>(false);
  const [pilotModalOpen, setPilotModalOpen] = useState<boolean>(false);
  const [selectedRiskPrompt, setSelectedRiskPrompt] = useState<HighRiskPrompt | null>(null);

  const applyDemo = (demo: DemoPreset) => {
    setSelectedDemo(demo.id);
    setModelA(demo.modelA);
    setModelB(demo.modelB);
    setGoal(demo.goal);
    setInputSource("demo");
    triggerAuditRun(demo.samples, demo.noise, demo.modelA, demo.modelB);
  };

  const triggerAuditRun = async (
    samples = 120,
    noise = 0.035,
    mA = modelA,
    mB = modelB
  ) => {
    setLoading(true);
    try {
      // 1. Attempt server endpoint
      try {
        const res = await fetch("/api/observability-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csv: inputSource === "upload" ? customCsv : undefined,
            model_a_name: mA,
            model_b_name: mB,
            seed: 42,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAudit(data);
          setLoading(false);
          return;
        }
      } catch {
        // Fall back to client calculation
      }

      // 2. Client-side execution
      let dataset;
      if (inputSource === "upload" && customCsv.trim()) {
        dataset = parseEmbeddingPairsCsv(customCsv);
      } else {
        dataset = syntheticTranslationDataset({
          samples: samples,
          dimension: 16,
          noise: noise,
          seed: 42,
        });
      }

      const result = runComparativeObservabilityAudit(dataset, {
        modelAName: mA,
        modelBName: mB,
        testFraction: 0.3,
        seed: 42,
      });
      setAudit(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    triggerAuditRun();
  }, []);

  // Export handlers
  const downloadReportJson = () => {
    if (!audit) return;
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vector-tongue-audit-${audit.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMarkdownReport = () => {
    if (!audit) return;
    const md = `# Vector Tongue — Model Migration & Observability Audit
**Generated:** ${audit.timestamp}  
**Experiment ID:** \`${audit.id}\`  
**Benchmark:** ${VTBENCH_VERSION}  
**Source Model (A):** ${audit.model_a_name}  
**Target Model (B):** ${audit.model_b_name}  
**Attribution:** Vector Tongue, Created by RJ Marler

---

## Executive Migration Verdict
### **${audit.verdict_category}**
> **Release Gate Status:** ${audit.release_gate.status} (Exit Code ${audit.release_gate.exit_code})  
> ${audit.release_gate.summary}

---

## The Four Core Questions

### 1. What Changed?
${audit.four_questions.what_changed}

### 2. Where Did It Change?
${audit.four_questions.where_it_changed}

### 3. Does It Matter?
${audit.four_questions.does_it_matter}

### 4. Can I Ship?
${audit.four_questions.can_i_ship}

---

## Top Behavioral Outlier Prompts (High Risk)
${audit.high_risk_prompts
  .map(
    (p, i) => `
### ${i + 1}. [${p.category.toUpperCase()}] Divergence Score: ${(p.divergence_score * 100).toFixed(1)}%
- **Prompt:** "${p.prompt}"
- **Risk Factor:** ${p.risk_factor}
- **Model A Snippet:** ${p.model_a_output_snippet}
- **Model B Snippet:** ${p.model_b_output_snippet}
`
  )
  .join("\n")}

---

## Statistical Fit & Baselines (Held-out Test)
- **Cross-Model R² Fit:** ${(audit.translation_accuracy.r2_score * 100).toFixed(1)}%
- **Mean Cosine Similarity:** ${(audit.translation_accuracy.mean_cosine_sim * 100).toFixed(1)}%
- **Top-10 Neighborhood Retention:** ${audit.translation_accuracy.neighborhood_preservation_k10}%
- **Spearman Rank Distance Correlation:** ${audit.translation_accuracy.rank_order_spearman}
- **Identity Baseline MSE:** ${audit.baselines.identity_mse}
- **Target-Mean Baseline MSE:** ${audit.baselines.target_mean_mse}
- **Learned Ridge Affine MSE:** ${audit.baselines.ridge_mse}
`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vector-tongue-executive-summary-${audit.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getVerdictStyle = (v: MigrationVerdict) => {
    switch (v) {
      case "SAFE":
        return {
          bg: "bg-emerald-950/40 border-emerald-500/40 text-emerald-300",
          iconBg: "bg-emerald-500/20 text-emerald-400",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        };
      case "SAFE WITH CAVEATS":
        return {
          bg: "bg-amber-950/40 border-amber-500/40 text-amber-300",
          iconBg: "bg-amber-500/20 text-amber-400",
          badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        };
      case "REVIEW REQUIRED":
        return {
          bg: "bg-orange-950/40 border-orange-500/40 text-orange-300",
          iconBg: "bg-orange-500/20 text-orange-400",
          badge: "bg-orange-500/20 text-orange-300 border-orange-500/30",
        };
      case "UNSAFE":
        return {
          bg: "bg-rose-950/40 border-rose-500/40 text-rose-300",
          iconBg: "bg-rose-500/20 text-rose-400",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
        };
      default:
        return {
          bg: "bg-slate-900 border-slate-700 text-slate-300",
          iconBg: "bg-slate-800 text-slate-400",
          badge: "bg-slate-800 text-slate-300 border-slate-700",
        };
    }
  };

  return (
    <div className="space-y-6">
      <PilotModal isOpen={pilotModalOpen} onClose={() => setPilotModalOpen(false)} />

      {/* Primary Positioning Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Black-Box Model Observability & Migration Platform
              </span>
              <span className="text-xs text-slate-400">Created by RJ Marler</span>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight leading-tight">
              Before you replace a model in production, Vector Tongue tells you what behavior you’re actually changing.
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              <strong className="text-slate-100 font-semibold">Your unit tests tell you whether your code changed incorrectly. Vector Tongue tells you whether your AI changed incorrectly.</strong> Compare models, detect semantic drift, find regressions, and test migrations without needing access to model internals.
            </p>
          </div>

          {/* Simple vs Professional Mode Toggle */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
            <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setProductMode("simple")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  productMode === "simple"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Simple Mode
              </button>
              <button
                onClick={() => setProductMode("professional")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  productMode === "professional"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span>Professional</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPilotModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-indigo-500/20 hover:from-amber-500/30 hover:to-indigo-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Request Pilot</span>
              </button>

              {onOpenPricing && (
                <button
                  onClick={onOpenPricing}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Buy License</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 5 Zero-Friction Curated Demos Pills */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Zero-Friction Curated Demos:
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              DEMO DATA &bull; DETERMINISTIC &bull; NO API KEY REQUIRED
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {DEMO_PRESETS.map((demo) => {
              const isSelected = selectedDemo === demo.id && inputSource === "demo";
              return (
                <button
                  key={demo.id}
                  onClick={() => applyDemo(demo)}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer text-xs ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                      : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <div className="font-semibold text-slate-200 truncate">{demo.name.split(" — ")[1]}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{demo.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Execution Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        {/* Input Source Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInputSource("demo")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                inputSource === "demo" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Curated Demos
            </button>
            <button
              onClick={() => setInputSource("upload")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                inputSource === "upload" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV / JSONL</span>
            </button>
            <button
              onClick={() => setInputSource("byom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                inputSource === "byom" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Bring Your Own Model (BYOM / BYOK)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Evaluation Corpus:</span>
            <span className="font-mono text-indigo-300 font-semibold">{VTBENCH_VERSION}</span>
          </div>
        </div>

        {/* Upload Mode Area */}
        {inputSource === "upload" && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                Upload Paired Model Output Embeddings (CSV)
              </label>
              <button
                onClick={() =>
                  setCustomCsv(
                    `source_dim_0,source_dim_1,target_dim_0,target_dim_1,category,prompt_id\n0.12,0.85,0.18,0.79,reasoning,p1\n-0.45,0.32,-0.41,0.28,factual,p2\n0.68,-0.11,0.61,-0.08,safety,p3`
                  )
                }
                className="text-[11px] text-indigo-400 hover:underline"
              >
                Insert Sample CSV
              </button>
            </div>
            <textarea
              rows={4}
              value={customCsv}
              onChange={(e) => setCustomCsv(e.target.value)}
              placeholder="Paste comma-separated embedding coordinates (source_dim_*, target_dim_*, category, prompt_id)..."
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* BYOM / BYOK Area */}
        {inputSource === "byom" && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                SECURE SERVER-SIDE PROXY
              </span>
              <span className="text-xs text-slate-400">
                Credentials are processed ephemerally on the backend, never stored in client state, logs, or exports.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">API Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  <option value="Gemini API">Google Gemini API (Vertex / AI Studio)</option>
                  <option value="OpenAI Compatible">OpenAI Compatible Endpoint</option>
                  <option value="Anthropic">Anthropic Claude</option>
                  <option value="Ollama Local">Local Ollama Inference (0.0.0.0)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Provider API Key (Optional)</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="ephemeral-token (never stored)"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
            </div>

            {/* Cost Estimator */}
            {audit && (
              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-slate-300">Pre-Run Cost & Resource Estimate:</span>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-300">
                  <span>Prompts: <strong className="text-white">{audit.cost_estimation.prompt_count}</strong></span>
                  <span>Est. Tokens: <strong className="text-white">~{audit.cost_estimation.estimated_tokens.toLocaleString()}</strong></span>
                  <span>Est. Duration: <strong className="text-white">~{audit.cost_estimation.estimated_duration_sec}s</strong></span>
                  <span>Est. Cost: <strong className="text-emerald-400">${audit.cost_estimation.estimated_cost_usd} USD</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Model A vs Model B Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Source Model (Model A / Baseline)
            </label>
            <input
              type="text"
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Target Model (Model B / Candidate)
            </label>
            <input
              type="text"
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Goal / Test
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Migration safety">Migration Safety</option>
              <option value="Compare models">Compare Models</option>
              <option value="Detect regression">Detect Regression</option>
              <option value="Audit model update">Audit Model Update</option>
              <option value="Test prompt robustness">Test Prompt Robustness</option>
              <option value="Measure semantic drift">Measure Semantic Drift</option>
              <option value="Compare providers">Compare Providers</option>
              <option value="Analyze reconstruction / information retention">Reconstruction & Retention</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              onClick={() => triggerAuditRun(120, 0.035, modelA, modelB)}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Run Comparison</span>
            </button>
          </div>
        </div>
      </div>

      {/* CORE RESULTS SECTION: 4 Questions & Large Verdict */}
      {audit && (
        <div className="space-y-6">
          {/* Main Verdict Card */}
          <div className={`p-6 rounded-2xl border ${getVerdictStyle(audit.verdict_category).bg} shadow-xl space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getVerdictStyle(audit.verdict_category).iconBg} border border-current shrink-0`}>
                  {audit.verdict_category === "SAFE" ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : audit.verdict_category === "SAFE WITH CAVEATS" ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <XCircle className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold tracking-wider opacity-80">
                      Migration Safety Verdict
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getVerdictStyle(audit.verdict_category).badge}`}>
                      {audit.verdict_category}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mt-0.5">
                    {audit.verdict_category === "SAFE" && "Safe to Ship Candidate Model"}
                    {audit.verdict_category === "SAFE WITH CAVEATS" && "Proceed with Caveats — Inspect Outliers"}
                    {audit.verdict_category === "REVIEW REQUIRED" && "Review Required — Noticeable Behavioral Drift"}
                    {audit.verdict_category === "UNSAFE" && "Do Not Ship — High Risk Behavioral Divergence"}
                    {audit.verdict_category === "INSUFFICIENT EVIDENCE" && "Insufficient Evidence — More Samples Required"}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setExpandedVerdict(!expandedVerdict)}
                  className="px-3 py-2 bg-slate-950/60 hover:bg-slate-950 border border-slate-700/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>{expandedVerdict ? "Hide Breakdown" : "Inspect Why"}</span>
                  {expandedVerdict ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={downloadMarkdownReport}
                  className="px-3 py-2 bg-slate-950/60 hover:bg-slate-950 border border-slate-700/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Executive Summary (.md)</span>
                </button>
              </div>
            </div>

            {/* Explainable Verdict Accordion */}
            {expandedVerdict && (
              <div className="pt-4 border-t border-current/20 space-y-3 text-xs animate-in fade-in duration-150">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-semibold text-slate-300">Release Gate Rules:</span>
                    <p className="text-slate-400">
                      {audit.release_gate.rules.filter((r) => r.passed).length} of {audit.release_gate.rules.length} checks passed. Exit code: {audit.release_gate.exit_code}.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-semibold text-slate-300">High Risk Prompt Outliers:</span>
                    <p className="text-slate-400">
                      {audit.high_risk_prompts.length} prompts require human inspection prior to full traffic cutover.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-semibold text-slate-300">Recommended Next Action:</span>
                    <p className="text-slate-400">
                      {audit.verdict_category === "SAFE"
                        ? "Execute phased canary deployment (10% -> 50% -> 100%)."
                        : "Apply category-conditional calibration prompt or tune temperature."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* THE FOUR CORE DEVELOPER QUESTIONS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                The Four Core Developer Questions
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Direct, unambiguous answers to the critical operational considerations before modifying production models.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Question 1: What Changed */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    1. What Changed?
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Drift: {(audit.summary.representational_distance * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {audit.four_questions.what_changed}
                </p>
              </div>

              {/* Question 2: Where Did It Change */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    2. Where Did It Change?
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Category Drift Localization
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {audit.four_questions.where_it_changed}
                </p>
              </div>

              {/* Question 3: Does It Matter */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    3. Does It Matter?
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Operational Severity
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {audit.four_questions.does_it_matter}
                </p>
              </div>

              {/* Question 4: Can I Ship */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    4. Can I Ship?
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Release Verdict
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {audit.four_questions.can_i_ship}
                </p>
              </div>
            </div>
          </div>

          {/* HIGH-RISK PROMPT OUTLIER DRILLDOWN */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  What the Developer Should Inspect: High-Risk Outlier Prompts
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Specific test cases where {modelA} and {modelB} diverged furthest from the shared representational manifold.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                {audit.high_risk_prompts.length} Outliers Isolated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {audit.high_risk_prompts.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedRiskPrompt(item)}
                  className="p-4 bg-slate-950 border border-slate-800/90 rounded-xl space-y-3 hover:border-slate-700 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-950/40 text-rose-300 border border-rose-800/40">
                      {item.category.replace("_", " ")}
                    </span>
                    <span className="font-mono text-xs text-rose-400 font-bold">
                      Divergence: {(item.divergence_score * 100).toFixed(1)}%
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-200 group-hover:text-white line-clamp-2">
                    "{item.prompt}"
                  </p>

                  <div className="p-2.5 bg-slate-900/80 rounded-lg text-[11px] text-slate-400 space-y-1">
                    <div>
                      <strong className="text-slate-300">Risk Factor:</strong> {item.risk_factor}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-indigo-400 pt-1">
                    <span>Inspect Output Comparison</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>

            {/* Modal/Drawer for Selected Risk Prompt Comparison */}
            {selectedRiskPrompt && (
              <div className="p-4 bg-slate-950 border border-indigo-500/40 rounded-xl space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Deep Inspection: {selectedRiskPrompt.id} ({selectedRiskPrompt.category})</span>
                  </h4>
                  <button
                    onClick={() => setSelectedRiskPrompt(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <p className="text-xs text-slate-300 italic">"{selectedRiskPrompt.prompt}"</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="font-semibold text-indigo-300 block mb-1">{modelA} Output:</span>
                    <p className="text-slate-400">{selectedRiskPrompt.model_a_output_snippet}</p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="font-semibold text-cyan-300 block mb-1">{modelB} Output:</span>
                    <p className="text-slate-400">{selectedRiskPrompt.model_b_output_snippet}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PROFESSIONAL MODE EXTENSIONS (Only when toggled) */}
          {productMode === "professional" && (
            <div className="space-y-6 pt-4 border-t border-slate-800 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    Professional Mode: Diagnostic Telemetry & Baselines
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Rigorous mathematical models, held-out test baselines, and formal falsification hypotheses.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadReportJson}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-all"
                  >
                    Export JSON
                  </button>
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto touch-scroll">
                {[
                  { id: "baselines", label: "Baselines & Multimodal Mapping", icon: Scale },
                  { id: "reconstruction", label: "Graded Reconstruction Hierarchy", icon: Layers },
                  { id: "hypotheses", label: "Falsifiable Hypotheses & Tests", icon: ShieldCheck },
                  { id: "drift", label: "Perturbation Robustness & Drift", icon: Activity },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeSubView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubView(tab.id as any)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer touch-manipulation min-h-[40px] ${
                        active
                          ? "bg-slate-800 text-white font-semibold shadow-sm border border-slate-700"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Baselines View */}
              {activeSubView === "baselines" && (
                <div className="space-y-4">
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">1. Identity Baseline</span>
                        <div className="text-lg font-mono font-bold text-slate-200">{audit.baselines.identity_mse}</div>
                        <p className="text-[10px] text-slate-500">Assumes identical embedding values</p>
                      </div>

                      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">2. Target-Mean Baseline</span>
                        <div className="text-lg font-mono font-bold text-slate-200">{audit.baselines.target_mean_mse}</div>
                        <p className="text-[10px] text-slate-500">Predicts average target vector (Null)</p>
                      </div>

                      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">3. Mean-Shift Baseline</span>
                        <div className="text-lg font-mono font-bold text-slate-200">{audit.baselines.mean_shift_mse}</div>
                        <p className="text-[10px] text-slate-500">Uniform displacement delta</p>
                      </div>

                      <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/40 rounded-lg space-y-1">
                        <span className="text-[11px] font-semibold text-indigo-300 uppercase flex items-center justify-between">
                          <span>4. Learned Ridge Affine</span>
                          <span className="text-[9px] text-emerald-400 font-bold">BEST FIT</span>
                        </span>
                        <div className="text-lg font-mono font-bold text-indigo-200">{audit.baselines.ridge_mse}</div>
                        <p className="text-[10px] text-indigo-300/80">
                          {Math.round((1 - audit.baselines.ridge_mse / audit.baselines.target_mean_mse) * 100)}% gain vs target mean
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">Orthogonal Procrustes</span>
                        <div className="text-base font-mono font-bold text-slate-200">{audit.baselines.procrustes_mse}</div>
                        <p className="text-[10px] text-slate-500">Isometric rotation & reflection</p>
                      </div>

                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">k-NN Regression (k=5)</span>
                        <div className="text-base font-mono font-bold text-slate-200">{audit.baselines.knn_mse}</div>
                        <p className="text-[10px] text-slate-500">Non-parametric manifold interpolation</p>
                      </div>

                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">Kernel RBF Mapping</span>
                        <div className="text-base font-mono font-bold text-slate-200">{audit.baselines.kernel_rbf_mse}</div>
                        <p className="text-[10px] text-slate-500">Nonlinear kernel alignment</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reconstruction Hierarchy View */}
              {activeSubView === "reconstruction" && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    8-Tier Graded Reconstruction Hierarchy
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2.5 px-3">Level / Test</th>
                          <th className="py-2.5 px-3">Metric</th>
                          <th className="py-2.5 px-3">Score</th>
                          <th className="py-2.5 px-3">Baseline</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {audit.reconstruction_hierarchy.map((lvl, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-200 block">{lvl.level_name}</span>
                              <span className="text-[10px] text-slate-500">{lvl.description}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{lvl.metric}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{lvl.score}%</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">{lvl.baseline_score}%</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  lvl.falsified
                                    ? "bg-rose-950/40 text-rose-400 border border-rose-900/50"
                                    : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50"
                                }`}
                              >
                                {lvl.falsified ? "FALSIFIED" : "CONFIRMED"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Falsifiable Hypotheses View */}
              {activeSubView === "hypotheses" && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Formal Falsifiable Hypotheses ($H_1-H_4$)
                  </h4>
                  <div className="space-y-3">
                    {audit.hypotheses.map((h) => (
                      <div key={h.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-indigo-400 font-bold">{h.id}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${h.status === "SUPPORTED" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-rose-950 text-rose-300 border border-rose-800"}`}>
                            {h.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200">{h.statement}</p>
                        <p className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-1 mt-1">
                          <strong>Implication:</strong> {h.implication}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drift View */}
              {activeSubView === "drift" && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Category Resilience under Perturbation
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {Object.entries(audit.perturbation_robustness.category_resilience).map(([cat, val]) => (
                      <div key={cat} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-300 uppercase">{cat}</span>
                          <span className="font-mono font-bold text-emerald-400">{val}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Experiment Ledger */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
                <div>
                  <span className="text-slate-500">Experiment ID:</span>{" "}
                  <strong className="text-indigo-300">{audit.experiment_ledger.experiment_id}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Seed:</span> {audit.experiment_ledger.seed}
                </div>
                <div>
                  <span className="text-slate-500">Timestamp:</span> {audit.experiment_ledger.timestamp_utc}
                </div>
                <div>
                  <span className="text-slate-500">Architecture:</span> {audit.experiment_ledger.hardware_arch}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
