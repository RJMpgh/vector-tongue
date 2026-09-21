import React, { useEffect, useMemo, useState } from "react";
import { trackLaunchEvent } from "../lib/telemetry";
import { ArrowRight, Building2, Check, Mail, ShieldCheck, Sparkles, X } from "lucide-react";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Offer = "pilot" | "enterprise" | "strategic";

const offerCopy: Record<Offer, { name: string; eyebrow: string; price: string; description: string; bullets: string[] }> = {
  pilot: {
    name: "Model Migration Audit",
    eyebrow: "Founding paid pilot",
    price: "$1,500 fixed • first 3 pilots",
    description: "A scoped, one-time comparison of a production model and candidate replacement using your representative prompt set.",
    bullets: ["Behavioral regression map", "High-risk prompt clusters", "Evidence-graded release recommendation", "Reproducible JSON + executive report"],
  },
  enterprise: {
    name: "Enterprise License",
    eyebrow: "Platform",
    price: "Custom annual license",
    description: "Private commercial terms for teams that want Vector Tongue in their model qualification and release workflow.",
    bullets: ["Model Change Assurance workflow", "Release-gate integration", "Custom evaluation policy", "Security and deployment review"],
  },
  strategic: {
    name: "Strategic Technology Transaction",
    eyebrow: "Confidential",
    price: "Custom transaction",
    description: "Technology licensing, exclusive rights, strategic partnership, or acquisition discussions for qualified buyers.",
    bullets: ["IP and provenance package", "Technical diligence materials", "Product and category roadmap", "Founder-led transition discussion"],
  },
};

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose }) => {
  const [offer, setOffer] = useState<Offer>("pilot");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = useMemo(() => offerCopy[offer], [offer]);
  useEffect(() => { if (isOpen) trackLaunchEvent("pricing_opened"); }, [isOpen]);
  if (!isOpen) return null;

  const submit = async () => {
    setError(null);
    setHandoffUrl(null);
    if (!email.includes("@")) {
      setError("Enter a valid business email so the inquiry can be addressed correctly.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/checkout/inquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: offer, email, company, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to prepare inquiry");
      setHandoffUrl(data.mailto_url);
      trackLaunchEvent("inquiry_prepared", { intent: offer });
    } catch (err: any) {
      setError(err.message || "Unable to prepare inquiry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 overflow-y-auto flex items-center justify-center">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-5 sm:p-8 my-8">
        <button onClick={onClose} className="absolute right-4 top-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>

        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <Building2 className="w-3.5 h-3.5" /> Enterprise & Strategic Access
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3">Start with a $1,500 migration audit. Expand only if the evidence earns it.</h2>
          <p className="text-sm text-slate-400 mt-2">No simulated checkout. No fake license keys. Commercial terms are confirmed directly with RJ Marler before money changes hands.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-3 mt-6">
          {(Object.keys(offerCopy) as Offer[]).map((key) => {
            const item = offerCopy[key];
            const active = offer === key;
            return (
              <button
                key={key}
                onClick={() => setOffer(key)}
                className={`text-left p-4 rounded-xl border transition-all ${active ? "border-indigo-400 bg-indigo-950/35" : "border-slate-800 bg-slate-950/50 hover:border-slate-700"}`}
              >
                <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-300">{item.eyebrow}</div>
                <div className="font-bold text-white mt-1">{item.name}</div>
                <div className="text-xs font-semibold text-emerald-300 mt-1">{item.price}</div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.description}</p>
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-5 mt-5">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
            <div className="flex items-center gap-2 text-white font-bold">
              {offer === "strategic" ? <Sparkles className="w-4 h-4 text-amber-300" /> : <ShieldCheck className="w-4 h-4 text-emerald-300" />}
              {current.name}
            </div>
            <div className="text-sm font-bold text-emerald-300 mt-2">{current.price}</div>
            <ul className="space-y-2 mt-4 text-sm text-slate-300">
              {current.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{bullet}</li>
              ))}
            </ul>
            <div className="mt-5 p-3 rounded-lg bg-slate-900 text-xs text-slate-400">
              Strategic transactions and enterprise terms are handled confidentially. Public demo metrics are never represented as buyer-specific diligence.
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="What models, migration, platform, or strategic transaction are you evaluating?" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" />
            {error && <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-500/30 rounded-lg p-2.5">{error}</div>}

            {handoffUrl ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/25 p-3">
                <p className="text-xs text-emerald-200">Your inquiry is prepared. Open the email draft to send it directly; the app does not falsely claim an email was already sent.</p>
                <a href={handoffUrl} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs">
                  <Mail className="w-4 h-4" /> Open email draft
                </a>
              </div>
            ) : (
              <button onClick={submit} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-50 text-sm font-bold">
                {loading ? "Preparing…" : "Prepare confidential inquiry"}<ArrowRight className="w-4 h-4" />
              </button>
            )}
            <p className="text-[11px] text-slate-500">Contact: rjmarler8@gmail.com • Vector Tongue, RJ Marler</p>
          </div>
        </div>
      </div>
    </div>
  );
};
