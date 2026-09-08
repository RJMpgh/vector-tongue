import React from "react";
import {
  Activity,
  Building2,
  Calculator,
  FileCheck2,
  FlaskConical,
  Layers,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

export type ActiveTab =
  | "observability"
  | "gate"
  | "benchmark"
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

const tabs: Array<{ id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "observability", label: "Model Change Audit", icon: Activity },
  { id: "gate", label: "Release Gate", icon: ShieldCheck },
  { id: "benchmark", label: "VT-Bench", icon: Layers },
  { id: "evaluate", label: "Dataset Eval", icon: TerminalSquare },
  { id: "drift", label: "Drift", icon: Calculator },
  { id: "provenance", label: "Evidence", icon: FileCheck2 },
  { id: "protocol", label: "Protocol", icon: FlaskConical },
];

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenPricing }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => setActiveTab("observability")}
            className="flex items-center gap-3 min-w-0 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white truncate">Vector Tongue</span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Model Change Assurance
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">Black-box behavioral change control • RJ Marler</p>
            </div>
          </button>

          <button
            onClick={onOpenPricing}
            className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white text-slate-950 hover:bg-slate-200 text-xs font-bold transition-colors"
          >
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Enterprise / Strategic</span>
            <span className="sm:hidden">Enterprise</span>
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? "bg-indigo-500/15 text-indigo-200 border border-indigo-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
