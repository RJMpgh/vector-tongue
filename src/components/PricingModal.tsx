import React, { useState } from "react";
import {
  Check,
  CreditCard,
  DollarSign,
  ExternalLink,
  Key,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTier?: "dev" | "team" | "enterprise";
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  defaultTier = "dev",
}) => {
  const [selectedTier, setSelectedTier] = useState<"dev" | "team" | "enterprise">(defaultTier);
  const [paymentMethod, setPaymentMethod] = useState<"cashapp" | "gpay" | "card" | "invoice">("cashapp");
  const [cashAppTag, setCashAppTag] = useState<string>("$rjmarler8");
  const [buyerEmail, setBuyerEmail] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulatePayment = () => {
    if (!buyerEmail.trim()) {
      alert("Please provide an email address to issue the license key.");
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const randomKey = `VT-${selectedTier.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      setLicenseKey(randomKey);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Commercial Access & Licensing</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Purchase Vector Tongue License
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Before you replace a model in production, know what behavior changes. Choose a commercial license or migration audit.
          </p>
        </div>

        {/* License Key Issued View */}
        {licenseKey ? (
          <div className="mt-6 p-6 bg-slate-950 border border-emerald-500/40 rounded-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">License Generated Successfully!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Receipt and commercial activation instructions sent to <strong className="text-slate-200">{buyerEmail}</strong>.
              </p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg font-mono text-sm text-emerald-400 select-all font-bold">
              {licenseKey}
            </div>
            <div className="text-xs text-slate-400">
              Creator & Commercial Rights: <strong className="text-slate-200">RJ Marler</strong>
            </div>
            <button
              onClick={() => {
                setLicenseKey(null);
                onClose();
              }}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all"
            >
              Continue to Workspace
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* Tiers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Developer Tier */}
              <div
                onClick={() => setSelectedTier("dev")}
                className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                  selectedTier === "dev"
                    ? "bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Developer Pro</div>
                <div className="text-2xl font-bold text-white mt-1">
                  $49 <span className="text-xs font-normal text-slate-400">/ mo</span>
                </div>
                <div className="text-[11px] text-indigo-300 mt-0.5">or $299 lifetime license</div>
                <ul className="mt-3 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Bring Your Own Model (BYOM)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Custom CSV / JSONL Upload</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Executive Markdown & JSON Audit</span>
                  </li>
                </ul>
              </div>

              {/* Team / CI Gate Tier */}
              <div
                onClick={() => setSelectedTier("team")}
                className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                  selectedTier === "team"
                    ? "bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white shadow-sm">
                  POPULAR
                </span>
                <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Team CI Gate</div>
                <div className="text-2xl font-bold text-white mt-1">
                  $199 <span className="text-xs font-normal text-slate-400">/ mo</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Automated deployment release</div>
                <ul className="mt-3 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Automated GitHub Actions CI Gate</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Customizable Drift Tolerances</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Zero-Regression Enforcements</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Unlimited CLI Pipeline Runs</span>
                  </li>
                </ul>
              </div>

              {/* Enterprise Migration Audit */}
              <div
                onClick={() => setSelectedTier("enterprise")}
                className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                  selectedTier === "enterprise"
                    ? "bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Migration Audit</div>
                <div className="text-2xl font-bold text-white mt-1">
                  $2,500 <span className="text-xs font-normal text-slate-400">one-time</span>
                </div>
                <div className="text-[11px] text-amber-300/80 mt-0.5">48-Hour Full Cutover Audit</div>
                <ul className="mt-3 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Full 48-Hour Migration Audit</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Custom Domain Test Sets</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Direct Advisory by RJ Marler</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Signed Compliance & Safety Report</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Select Payment Method:
                </span>
                <span className="text-[11px] text-slate-400">
                  Beneficiary: <strong className="text-white">RJ Marler</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cashapp")}
                  className={`p-2.5 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                    paymentMethod === "cashapp"
                      ? "bg-emerald-950/60 border-emerald-500 text-emerald-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Cash App</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("gpay")}
                  className={`p-2.5 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                    paymentMethod === "gpay"
                      ? "bg-indigo-950/60 border-indigo-500 text-indigo-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span>Google Pay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`p-2.5 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                    paymentMethod === "card"
                      ? "bg-indigo-950/60 border-indigo-500 text-indigo-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span>Credit Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("invoice")}
                  className={`p-2.5 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                    paymentMethod === "invoice"
                      ? "bg-amber-950/60 border-amber-500 text-amber-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Invoice / Wire</span>
                </button>
              </div>

              {/* Payment Details Display */}
              <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-2">
                {paymentMethod === "cashapp" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Cash App Cashtag:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">{cashAppTag}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Send payment on Cash App to <strong className="text-slate-300">{cashAppTag}</strong> with note: <code className="text-slate-300">Vector Tongue {selectedTier.toUpperCase()}</code>.
                    </p>
                  </div>
                )}

                {paymentMethod === "gpay" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Google Pay Direct Payee:</span>
                      <span className="font-mono font-bold text-indigo-300 text-xs">rjmarler8@gmail.com</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Send payment via Google Pay to <strong className="text-slate-300">rjmarler8@gmail.com</strong>.
                    </p>
                  </div>
                )}

                {paymentMethod === "card" && (
                  <div className="space-y-1.5">
                    <p className="text-slate-300">
                      Secure credit/debit card checkout via Stripe gateway or merchant direct link.
                    </p>
                  </div>
                )}

                {paymentMethod === "invoice" && (
                  <div className="space-y-1.5">
                    <p className="text-slate-300">
                      We will generate an enterprise net-30 invoice and ACH/Wire instructions addressed to your accounting team.
                    </p>
                  </div>
                )}
              </div>

              {/* Email & Complete Button */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Your Email (for license delivery & receipt):
                  </label>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="buyer@company.com"
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSimulatePayment}
                  disabled={isProcessing}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {isProcessing
                      ? "Verifying Payment & Generating Key..."
                      : `Confirm & Issue License for ${
                          selectedTier === "dev" ? "$49/mo" : selectedTier === "team" ? "$199/mo" : "$2,500"
                        }`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
