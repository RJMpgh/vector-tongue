import React, { useState, useEffect } from "react";
import { Compass, BookOpen, ArrowRight, RotateCcw, AlertCircle } from "lucide-react";
import { DriftResult } from "../types";
import { driftComponents, cosineSimilarity } from "../lib/geometry";
import { norm } from "../lib/matrix";

export const DriftCalculator: React.FC = () => {
  const [vecAStr, setVecAStr] = useState<string>("[1.0, 0.0, 0.2]");
  const [vecBStr, setVecBStr] = useState<string>("[0.8, 0.3, 0.1]");
  const [result, setResult] = useState<DriftResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculateDrift = async () => {
    setError(null);
    try {
      const a = JSON.parse(vecAStr);
      const b = JSON.parse(vecBStr);
      if (!Array.isArray(a) || !Array.isArray(b)) {
        throw new Error("Vectors must be valid JSON number arrays, e.g. [1.0, 0.0, 0.2]");
      }
      if (a.length !== b.length) {
        throw new Error(`Vectors must have matching dimensions. (Got ${a.length} and ${b.length})`);
      }

      try {
        const res = await fetch("/api/drift", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vector_a: a, vector_b: b }),
        });
        if (res.ok) {
          const data = await res.json();
          setResult(data);
          return;
        }
      } catch {
        // Fall back to client calculation below
      }

      // Client-side execution fallback for iOS/offline/iframe
      const vecA = a.map(Number);
      const vecB = b.map(Number);
      const clientCalc = driftComponents(vecA, vecB);
      setResult({
        ...clientCalc,
        norm_a: norm(vecA),
        norm_b: norm(vecB),
        cosine_similarity: cosineSimilarity(vecA, vecB),
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    calculateDrift();
  }, []);

  const setPreset = (a: number[], b: number[]) => {
    setVecAStr(JSON.stringify(a));
    setVecBStr(JSON.stringify(b));
    setError(null);
  };

  // Helper for algebraic unit test check
  const isUnitNorm = result
    ? Math.abs(result.norm_a - 1.0) < 1e-4 && Math.abs(result.norm_b - 1.0) < 1e-4
    : false;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-indigo-500/20 text-indigo-400">
            <Compass className="w-4 h-4" />
          </span>
          <h2 className="text-lg font-semibold text-white">Drift Decomposition & Historical v1 vs v2</h2>
        </div>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Explores the descriptive geometry of representation shifts between two output embeddings, separating cosine distance, Euclidean displacement, and norm shift while preserving the original 2025 Marler Drift v1 index.
        </p>
      </div>

      {/* Interactive Vector Input */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Vector Pair Input</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Presets:</span>
            <button
              onClick={() => setPreset([1.0, 0.0, 0.0], [0.7071, 0.7071, 0.0])}
              className="px-2.5 py-1.5 sm:py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded border border-slate-700/60 cursor-pointer touch-manipulation min-h-[36px] sm:min-h-0 active:scale-95"
            >
              Unit Orthogonal 45°
            </button>
            <button
              onClick={() => setPreset([1.0, 0.0, 0.2], [0.8, 0.3, 0.1])}
              className="px-2.5 py-1.5 sm:py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded border border-slate-700/60 cursor-pointer touch-manipulation min-h-[36px] sm:min-h-0 active:scale-95"
            >
              Sample Prompt Pair
            </button>
            <button
              onClick={() => setPreset([0.0, 1.0, 0.0], [0.0, -1.0, 0.0])}
              className="px-2.5 py-1.5 sm:py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded border border-slate-700/60 cursor-pointer touch-manipulation min-h-[36px] sm:min-h-0 active:scale-95"
            >
              Opposing (180°)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Source Embedding z_A
            </label>
            <input
              id="drift-vec-a-input"
              type="text"
              value={vecAStr}
              onChange={(e) => setVecAStr(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm sm:text-xs font-mono text-cyan-300 focus:outline-none focus:border-indigo-500 min-h-[42px] sm:min-h-0"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Target Embedding z_B
            </label>
            <input
              id="drift-vec-b-input"
              type="text"
              value={vecBStr}
              onChange={(e) => setVecBStr(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm sm:text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500 min-h-[42px] sm:min-h-0"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            id="calculate-drift-btn"
            onClick={calculateDrift}
            className="w-full sm:w-auto px-5 py-3 sm:py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-md shadow-indigo-600/20 transition-all cursor-pointer touch-manipulation min-h-[44px] active:scale-95"
          >
            Compute Drift Metrics
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Metrics Output Grid */}
      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-medium text-slate-400">Cosine Distance</span>
            <div className="text-2xl font-bold text-white mt-1 font-mono">
              {result.cosine_distance.toFixed(6)}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              Similarity: {result.cosine_similarity.toFixed(4)}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-medium text-slate-400">Euclidean Displacement</span>
            <div className="text-2xl font-bold text-white mt-1 font-mono">
              {result.euclidean_displacement.toFixed(6)}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              ||z_B - z_A||₂
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-medium text-slate-400">Norm Shift</span>
            <div className="text-2xl font-bold text-white mt-1 font-mono">
              {result.norm_shift >= 0 ? "+" : ""}{result.norm_shift.toFixed(6)}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              ||z_B|| = {result.norm_b.toFixed(3)}, ||z_A|| = {result.norm_a.toFixed(3)}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-900/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-indigo-300">Marler Drift v1 Index</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                2025 Formula
              </span>
            </div>
            <div className="text-2xl font-bold text-indigo-200 mt-1 font-mono">
              {result.marler_drift_v1.toFixed(6)}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              (1 - cos) × ||z_B - z_A||
            </div>
          </div>
        </div>
      )}

      {/* Unit Vector Algebraic Dependency Callout */}
      {result && isUnitNorm && (
        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <strong className="text-indigo-200">Unit-Norm Vector Detected:</strong> Because both vectors are unit-normalized (||z_A|| = ||z_B|| = 1), the Euclidean distance is algebraically coupled to cosine distance via ||z_B - z_A||₂ = √(2(1 - cos(z_A, z_B))). Therefore, the v1 index simplifies identically to √2 · d_cos^(1.5).
          </div>
        </div>
      )}

      {/* Historical Context and Mathematical Correction */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          The Historical v1 Formulation and the Mathematical Correction
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-lg space-y-2">
            <span className="text-amber-400 font-semibold uppercase tracking-wider text-[10px]">
              Prototype v1 (August 5, 2025)
            </span>
            <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 font-mono text-slate-300">
              δ = z_B - z_A, ẑ_B = z_A + δ<br />
              D_Marler-v1 = (1 - cos(z_A, z_B)) · ||z_B - z_A||₂
            </div>
            <p className="text-slate-400 leading-relaxed">
              The initial proof of concept calculated a pairwise delta vector directly from the target and multiplied cosine distance by Euclidean norm.
            </p>
          </div>

          <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-lg space-y-2">
            <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[10px]">
              Version 2 Correction (2026)
            </span>
            <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 font-mono text-slate-300">
              ẑ_&#123;B,p&#125; = f_&#123;A→B&#125;(z_&#123;A,p&#125;) = z_&#123;A,p&#125; W + b<br />
              Decompose: d_cos, ||z_B - z_A||, ||z_B|| - ||z_A||
            </div>
            <p className="text-slate-400 leading-relaxed">
              V2 establishes two formal corrections: (1) calculating a delta from the target reconstructs it by definition; translation must be learned on calibration prompts and evaluated on held-out prompts. (2) For unit vectors, cosine and Euclidean distance are algebraically redundant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
