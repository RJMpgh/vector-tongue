import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  X,
  Mail,
  Send,
  Building,
  Sparkles,
  ArrowRight,
  Clock,
  FileCheck,
} from "lucide-react";

interface PilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PilotModal: React.FC<PilotModalProps> = ({ isOpen, onClose }) => {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [teamSize, setTeamSize] = useState("5-20");
  const [currentModel, setCurrentModel] = useState("Claude 3.5 Sonnet");
  const [targetModel, setTargetModel] = useState("GPT-4o / Llama 3.3");
  const [useCase, setUseCase] = useState("Production migration / cost optimization");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!submitted ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Commercial Pilot Offering
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> 48-Hour Turnaround
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Vector Tongue Model Migration Audit
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Before you flip 100% of production traffic to a new model version or provider, let Vector Tongue map the exact behavioral territory you’re altering.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs">
              <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">
                What You Supply:
              </h4>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                <li>Current model endpoint or representative prompt-response dataset (CSV/JSONL)</li>
                <li>Candidate replacement model or version checkpoint</li>
                <li>Critical boundary criteria (e.g. zero regressions on safety or formatting)</li>
              </ul>

              <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[10px] pt-2">
                What Vector Tongue Delivers:
              </h4>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                <li>Executive Migration Verdict: <strong>SAFE</strong>, <strong>CAVEATS</strong>, or <strong>BLOCKED</strong></li>
                <li>Outlier Prompt Regression Map pinpointing exact high-divergence cases</li>
                <li>CI/CD Release Gate policy configuration for automated pull-request testing</li>
                <li>Reproducible, cryptographically anchored audit dossier</li>
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@company.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Current Model</label>
                  <input
                    type="text"
                    value={currentModel}
                    onChange={(e) => setCurrentModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Model</label>
                  <input
                    type="text"
                    value={targetModel}
                    onChange={(e) => setTargetModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Primary Objective / Context</label>
                <input
                  type="text"
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <Send className="w-4 h-4" />
                <span>Request Migration Pilot</span>
              </button>
            </form>

            <p className="text-[11px] text-slate-500 text-center">
              Direct inquiries: <a href="mailto:rjmarler8@gmail.com" className="text-indigo-400 hover:underline">rjmarler8@gmail.com</a> &bull; Inventor: RJ Marler
            </p>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Pilot Request Received</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              Thank you. We have recorded your pilot parameters ({currentModel} &rarr; {targetModel}) for {email}. You will receive pilot onboarding instructions and benchmark intake guidelines within 24 hours.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Return to Workbench
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
