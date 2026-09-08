import React, { useState } from "react";
import { Header, ActiveTab } from "./components/Header";
import { IndustryLaunchWorkbench } from "./components/IndustryLaunchWorkbench";
import { CIReleaseGate } from "./components/CIReleaseGate";
import { VTBenchExplorer } from "./components/VTBenchExplorer";
import { PricingModal } from "./components/PricingModal";
import { DemoWorkbench } from "./components/DemoWorkbench";
import { EvaluatorWorkbench } from "./components/EvaluatorWorkbench";
import { DriftCalculator } from "./components/DriftCalculator";
import { ProvenanceVerifier } from "./components/ProvenanceVerifier";
import { ProtocolDocs } from "./components/ProtocolDocs";
import { ErrorBoundary } from "./components/ErrorBoundary";

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("observability");
  const [pricingOpen, setPricingOpen] = useState(false);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-slate-950 text-slate-100 antialiased">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPricing={() => setPricingOpen(true)}
      />

      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <ErrorBoundary key={activeTab}>
          {activeTab === "observability" && (
            <IndustryLaunchWorkbench onOpenEnterprise={() => setPricingOpen(true)} />
          )}
          {activeTab === "gate" && <CIReleaseGate />}
          {activeTab === "benchmark" && (
            <VTBenchExplorer onRunBenchmark={() => setActiveTab("observability")} />
          )}
          {activeTab === "demo" && <DemoWorkbench />}
          {activeTab === "evaluate" && <EvaluatorWorkbench />}
          {activeTab === "drift" && <DriftCalculator />}
          {activeTab === "provenance" && <ProvenanceVerifier />}
          {activeTab === "protocol" && <ProtocolDocs />}
        </ErrorBoundary>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-5 px-4 text-center text-xs text-slate-500 safe-bottom">
        <p>
          Vector Tongue • Model Change Assurance • Concept, terminology, and original prototype by <span className="text-slate-300 font-medium">RJ Marler</span>
        </p>
      </footer>
    </div>
  );
}

export default App;
