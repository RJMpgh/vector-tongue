import React from "react";
import { Activity, Compass, Cpu, FileCheck, Layers, Sparkles } from "lucide-react";

export type ActiveTab = "demo" | "evaluate" | "drift" | "provenance" | "protocol";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "demo", label: "Synthetic Lab", icon: Sparkles, badge: "Deterministic" },
    { id: "evaluate", label: "Dataset Evaluator", icon: Activity, badge: "CSV & Held-Out" },
    { id: "drift", label: "Drift & Historical v1", icon: Compass, badge: "Math" },
    { id: "provenance", label: "Priority & Provenance", icon: FileCheck, badge: "Manifest" },
    { id: "protocol", label: "Research Protocol", icon: Layers, badge: "Docs" },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Vector Tongue</h1>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Research v0.2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Falsifiable, output-only behavioral translation between AI models &bull; Concept: <span className="text-slate-300 font-medium">RJ Marler</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
