import React, { useState } from "react";
import { Header, ActiveTab } from "./components/Header";
import { ObservabilityWorkbench } from "./components/ObservabilityWorkbench";
import { CIReleaseGate } from "./components/CIReleaseGate";
import { VTBenchExplorer } from "./components/VTBenchExplorer";
import { MarketingHub } from "./components/MarketingHub";
import { PricingModal } from "./components/PricingModal";
import { DemoWorkbench } from "./components/DemoWorkbench";
import { EvaluatorWorkbench } from "./components/EvaluatorWorkbench";
import { DriftCalculator } from "./components/DriftCalculator";
import { ProvenanceVerifier } from "./components/ProvenanceVerifier";
import { ProtocolDocs } from "./components/ProtocolDocs";
import { ErrorBoundary } from "./components/ErrorBoundary";

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("observability");
  const [pricingOpen, setPricingOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-slate-950 text-slate-100 antialiased">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPricing={() => setPricingOpen(true)}
      />

      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <ErrorBoundary key={activeTab}>
          {activeTab === "observability" && (
            <ObservabilityWorkbench onOpenPricing={() => setPricingOpen(true)} />
          )}
          {activeTab === "gate" && <CIReleaseGate />}
          {activeTab === "benchmark" && (
            <VTBenchExplorer onRunBenchmark={() => setActiveTab("observability")} />
          )}
          {activeTab === "marketing" && <MarketingHub />}
          {activeTab === "demo" && <DemoWorkbench />}
          {activeTab === "evaluate" && <EvaluatorWorkbench />}
          {activeTab === "drift" && <DriftCalculator />}
          {activeTab === "provenance" && <ProvenanceVerifier />}
          {activeTab === "protocol" && <ProtocolDocs />}
        </ErrorBoundary>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 text-center text-xs text-slate-500 safe-bottom">
        <p>
          Vector Tongue &bull; Concept, Terminology & Original Prototype: <span className="text-slate-400 font-medium">RJ Marler</span> &bull; Production Model Observability & Migration Testing
        </p>
      </footer>
    </div>
  );
}

export default App;
