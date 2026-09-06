import React from "react";
import { BookOpen, Check, X, Shield, Cpu, HelpCircle } from "lucide-react";

export const ProtocolDocs: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Overview Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          The Vector Tongue Research Protocol
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Vector Tongue asks a concrete, falsifiable question:
        </p>
        <blockquote className="border-l-2 border-indigo-500 pl-4 py-1 text-sm italic text-indigo-200 bg-indigo-950/20 rounded-r">
          "After observing how Model A and Model B answer a calibration set, can we predict Model B's response representation from Model A's response on prompts neither model saw during calibration?"
        </blockquote>
      </div>

      {/* Mathematical Foundation */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          Formal Mathematical Formulation
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
            <span className="font-semibold text-indigo-400 uppercase tracking-wider text-[11px]">
              Output Representation
            </span>
            <div className="font-mono text-slate-200 p-2 bg-slate-900 rounded">
              z_&#123;m,p&#125; = E(y_&#123;m,p&#125;)
            </div>
            <p className="text-slate-400 leading-relaxed">
              For prompt p, model m, response text y_&#123;m,p&#125;, and a fixed external encoder E. No internal model weights or hidden activations are required.
            </p>
          </div>

          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
            <span className="font-semibold text-indigo-400 uppercase tracking-wider text-[11px]">
              Held-Out Translation Map
            </span>
            <div className="font-mono text-slate-200 p-2 bg-slate-900 rounded">
              ẑ_&#123;B,p&#125; = z_&#123;A,p&#125; W + b
            </div>
            <p className="text-slate-400 leading-relaxed">
              Parameters W, b are learned solely on the calibration/training prompt split P_train and evaluated on unseen held-out prompts P_test.
            </p>
          </div>
        </div>
      </div>

      {/* Declared Baselines */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">Three Declared Baselines</h3>
        <p className="text-xs text-slate-400">
          A learned translation operator is scientifically supported only if it significantly outperforms these three output-only baselines on held-out test data:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="font-semibold text-indigo-300">1. Identity Baseline</span>
            <div className="font-mono text-slate-400 mt-1 mb-2">ẑ_&#123;B,p&#125; = z_&#123;A,p&#125;</div>
            <p className="text-slate-400 text-[11px]">
              Assumes both models already produce identical embeddings.
            </p>
          </div>
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="font-semibold text-indigo-300">2. Target-Mean Baseline</span>
            <div className="font-mono text-slate-400 mt-1 mb-2">ẑ_&#123;B,p&#125; = z̄_B</div>
            <p className="text-slate-400 text-[11px]">
              Predicts the static average target embedding learned during calibration.
            </p>
          </div>
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="font-semibold text-indigo-300">3. Mean-Shift Baseline</span>
            <div className="font-mono text-slate-400 mt-1 mb-2">ẑ_&#123;B,p&#125; = z_&#123;A,p&#125; + δ̄</div>
            <p className="text-slate-400 text-[11px]">
              Applies a uniform average displacement vector δ̄ = mean(z_B - z_A).
            </p>
          </div>
        </div>
      </div>

      {/* Claims vs Limitations */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          Methodology & Objective Claims Boundaries
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-lg space-y-2">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Check className="w-4 h-4" /> Observable Black-Box Capabilities
            </span>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside leading-relaxed text-[11px]">
              <li>Operates on observable output representations without requiring proprietary runtime weights.</li>
              <li>Quantifies predictive advantage over declared baselines (Identity, Target-Mean, Mean-Shift, k-NN).</li>
              <li>Applies negative controls (shuffled pairs) and bootstrap intervals to verify geometric alignment.</li>
              <li>Tests graded reconstruction hierarchies (topic, intent, sentiment, retrieval) empirically.</li>
            </ul>
          </div>

          <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-lg space-y-2">
            <span className="text-indigo-400 font-semibold flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Shield className="w-4 h-4" /> Scientific & Scope Demarcation
            </span>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside leading-relaxed text-[11px]">
              <li><strong>Zero Internal Access:</strong> Does not require access to proprietary weights or activations; inferences are strictly behavioral.</li>
              <li><strong>Graded Information Recovery:</strong> Dense embeddings reliably preserve topic, intent, and nearest-neighbor candidates, while exact verbatim token syntax is lost.</li>
              <li><strong>Geometric Alignment:</strong> Tests shared representational geometry between models; avoids subjective claims of emergent private languages.</li>
              <li><strong>Falsifiable Reporting:</strong> All empirical hypotheses include explicit null thresholds, effect sizes, and p-values.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
