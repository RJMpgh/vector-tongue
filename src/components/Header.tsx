import React from "react";
import {
  Activity,
  Compass,
  Cpu,
  DollarSign,
  FileCheck,
  Layers,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";

export type ActiveTab =
  | "observability"
  | "gate"
  | "benchmark"
  | "marketing"
  | "demo"
  | "evaluate"
  | "drift"
  | "provenance"
  | "protocol";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenPricing: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenPricing }) => {
  const tabs = [
    { id: "observability", label: "Model Observability & Migration", icon: Activity, badge: "Primary" },
    { id: "gate", label: "CI/CD Release Gate", icon: ShieldCheck, badge: "GitHub Action" },
    { id: "benchmark", label: "VT-Bench v1", icon: Layers, badge: "14 Axes" },
    { id: "marketing", label: "Launch & Advertise", icon: Megaphone, badge: "Outreach" },
    { id: "demo", label: "Synthetic Lab", icon: Sparkles, badge: "Deterministic" },
    { id: "evaluate", label: "Dataset Evaluator", icon: Terminal, badge: "CSV Upload" },
    { id: "drift", label: "Drift & Historical v1", icon: Compass, badge: "Math" },
    { id: "provenance", label: "Priority & Provenance", icon: FileCheck, badge: "Manifest" },
    { id: "protocol", label: "Research Protocol", icon: Cpu, badge: "Docs" },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 safe-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-white">Vector Tongue</h1>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Production v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1 sm:line-clamp-none">
                Before you replace a model in production, Vector Tongue tells you what behavior you’re actually changing &bull; <span className="text-slate-300 font-medium">RJ Marler</span>
              </p>
            </div>
          </div>

          <nav aria-label="Main Navigation" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 touch-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`flex items-center gap-2 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap touch-manipulation min-h-[40px] sm:min-h-0 active:scale-95 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold"
                      : "bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <button
              onClick={onOpenPricing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-500/20 whitespace-nowrap cursor-pointer shrink-0"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Pricing & Paywall</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
