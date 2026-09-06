import React, { useState, useEffect } from "react";
import {
  Layers,
  Search,
  Filter,
  CheckCircle,
  FileText,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Code2,
  Tag,
  Download,
} from "lucide-react";
import { VTBENCH_PROMPTS, VTBENCH_VERSION } from "../lib/vtBench";
import { VTBenchPrompt } from "../types";

interface VTBenchExplorerProps {
  onSelectPrompt?: (prompt: string) => void;
  onRunBenchmark?: () => void;
}

export const VTBenchExplorer: React.FC<VTBenchExplorerProps> = ({ onSelectPrompt, onRunBenchmark }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [prompts, setPrompts] = useState<VTBenchPrompt[]>(VTBENCH_PROMPTS);

  useEffect(() => {
    // Attempt fetch from server endpoint if available
    fetch("/api/bench/vt-bench-v1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.prompts) setPrompts(data.prompts);
      })
      .catch(() => {});
  }, []);

  const categories = Array.from(new Set(prompts.map((p) => p.category)));

  const filteredPrompts = prompts.filter((p) => {
    const matchesCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      p.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.eval_criteria.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const exportBenchmarkJson = () => {
    const data = {
      benchmark_version: VTBENCH_VERSION,
      timestamp: new Date().toISOString(),
      prompt_count: prompts.length,
      prompts,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vt-bench-v1.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                {VTBENCH_VERSION}
              </span>
              <span className="text-xs text-slate-400">Canonical Behavioral Evaluation Corpus</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Standardized Model Behavioral Benchmark
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              A versioned test corpus covering 14 behavioral stress axes—from instruction following and factual reasoning to safety boundaries, ambiguity, and entity preservation. Every benchmark run records its immutable version ID to ensure longitudinal reproducibility.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRunBenchmark && (
              <button
                onClick={onRunBenchmark}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer touch-manipulation min-h-[44px]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Run Audit on VT-Bench v1</span>
              </button>
            )}
            <button
              onClick={exportBenchmarkJson}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-medium rounded-xl border border-slate-700/60 transition-all cursor-pointer touch-manipulation min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export Benchmark JSON</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search benchmark prompts, criteria, or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 touch-scroll">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === "all"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              All Categories ({prompts.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap capitalize transition-all ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {cat.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prompts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPrompts.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all group"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                  {item.category.replace("_", " ")}
                </span>
                <span className="font-mono text-[11px] text-slate-500">{item.id}</span>
              </div>

              <p className="text-xs text-slate-200 font-medium leading-relaxed group-hover:text-white transition-colors">
                "{item.prompt}"
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate max-w-[240px] text-slate-400" title={item.eval_criteria}>
                Criterion: <span className="text-slate-300">{item.eval_criteria}</span>
              </span>
              {onSelectPrompt && (
                <button
                  onClick={() => onSelectPrompt(item.prompt)}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium shrink-0 ml-2"
                >
                  <span>Select</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
