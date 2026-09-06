import React, { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  Mail,
  Megaphone,
  MessageSquare,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";

interface CampaignItem {
  id: string;
  channel: string;
  title: string;
  subtitle: string;
  content: string;
}

export const MarketingHub: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const deployedUrl = "https://ais-pre-4pyciz5tejjrhqfvyjpqeu-52422669128.us-east1.run.app";

  const campaigns: CampaignItem[] = [
    {
      id: "hackernews",
      channel: "Hacker News",
      title: "Show HN: Vector Tongue — What behavior actually changes when you replace an LLM?",
      subtitle: "Highest converting technical channel for senior ML engineers and founders.",
      content: `Show HN: Vector Tongue – What behavior actually changes when you replace an LLM in production?

Link: ${deployedUrl}

Hey HN,

One of the most dangerous moments in AI software engineering is model migration or version upgrades (e.g. Claude 3.5 Sonnet to GPT-4o, or Llama 3 to 3.1). 

Your unit tests tell you whether your code changed incorrectly. But nothing tells you whether your AI changed incorrectly.

Most teams either:
1. Run subjective vibe checks on 10 cherry-picked prompts.
2. Rely on academic benchmarks (MMLU) that have zero correlation with their production traffic.

I built Vector Tongue: an output-only, black-box model observability and migration safety platform.

It does NOT require proprietary weights or latent layer activations. Instead, it tests observable behavior across canonical benchmarks (VT-Bench v1), measures semantic drift, compares learned affine/Procrustes/Kernel RBF mappings against null baselines on held-out test splits, and answers 4 practical developer questions:
1. What changed?
2. Where did it change? (by category)
3. Does it matter? (severity vs baseline)
4. Can I safely ship or migrate? (Automated CI/CD Release Gate)

Try the live interactive workbench (curated demos load with zero setup, or upload your own output vectors):
${deployedUrl}

Feedback, critiques, and ideas on empirical alignment welcome!`,
    },
    {
      id: "linkedin",
      channel: "LinkedIn",
      title: "Executive & Engineering Leader Announcement",
      subtitle: "Targeted at VPs of Engineering, CTOs, and AI platform teams.",
      content: `Before you replace a model in production, Vector Tongue tells you what behavior you’re actually changing.

Your unit tests tell you if your code broke.
Vector Tongue tells you if your AI broke.

Every company shipping generative AI is facing model cutover risks:
- Providers deprecating old checkpoints
- Moving from expensive proprietary models to open weights (Llama, Mistral) to cut cloud bills
- Silent behavioral drift across prompt variations

Traditional evals are either too slow, subjective, or require access to internal weights you don't have.

Vector Tongue is built for black-box model observability:
- 14-axis behavioral stress testing (VT-Bench v1)
- Automated CI/CD Release Gates for GitHub Actions
- High-risk outlier prompt isolation before production cutover
- Empirical held-out baseline validation (Ridge, Procrustes, k-NN vs Target-Mean)

Created by RJ Marler.

Try the live demo now:
${deployedUrl}

If your team is planning a model migration this quarter, check out our 48-Hour Migration Audit pilot.

#GenerativeAI #MachineLearning #AIEngineering #LLMOps #SoftwareArchitecture`,
    },
    {
      id: "twitter",
      channel: "X / Twitter",
      title: "Viral Engineering Thread (5 Posts)",
      subtitle: "Fast, punchy breakdown designed to drive immediate retweets and traffic.",
      content: `1/ Before you replace a model in production, do you actually know what behavior you’re changing?

Your unit tests tell you whether your code changed incorrectly.
Vector Tongue tells you whether your AI changed incorrectly.

Live platform: ${deployedUrl} 🧵👇

2/ The Problem:
Teams switch LLM providers or upgrade minor checkpoints to save 40% on inference.
Two weeks later, edge cases fail in customer support, code formatting breaks, and safety boundaries drift.
Vibe checks don't catch it.

3/ The Solution:
Vector Tongue tests models under pure black-box conditions:
- No internal weights needed
- VT-Bench v1 (14 behavioral dimensions)
- Held-out test baselines (Procrustes, Ridge, k-NN)
- Automated CI/CD Release Gate for GitHub Actions

4/ It answers 4 questions:
- What changed?
- Where did it change?
- Does it matter?
- Can I safely ship?

5/ Try the interactive demos (Claude vs GPT-4o, Llama 3 vs 3.1) or upload your own model outputs:
${deployedUrl}

Created by @rjmarler. RT if you ship LLMs to production!`,
    },
    {
      id: "coldemail",
      channel: "Outreach Email",
      title: "Cold Outreach to VP of Eng / Head of AI",
      subtitle: "High-response direct message to leaders facing model deprecations.",
      content: `Subject: Quick question about your LLM migration / deprecation pipeline

Hi [Name],

I saw your team is scaling LLM-driven features at [Company].

Quick question: when you upgrade checkpoints or evaluate alternative models (e.g. cutting inference spend by moving to open-weights or upgrading Claude/GPT models), how do you verify behavioral zero-regression before cutting production traffic?

Most teams rely on subjective prompt checks or academic benchmarks like MMLU that don't reflect production distributions.

We built Vector Tongue (https://ais-pre-4pyciz5tejjrhqfvyjpqeu-52422669128.us-east1.run.app): black-box model observability that runs comparative audits and automated CI/CD release gates without needing internal model weights.

We’re running 48-Hour Model Migration Audits for selected engineering teams to test candidate models against production baselines before cutover.

Would you be open to a 10-minute walkthrough this week?

Best regards,
RJ Marler
Founder, Vector Tongue
rjmarler8@gmail.com`,
    },
    {
      id: "reddit",
      channel: "Reddit (r/MachineLearning & r/LocalLLaMA)",
      title: "Community Deep-Dive Post",
      subtitle: "Technical post focusing on black-box system identification and falsifiable baselines.",
      content: `Title: Black-box LLM migration testing without internal weights (VT-Bench v1 + Release Gates)

Hey everyone,

Whenever a new open-weight model drops (like Llama 3.1) or an API provider deprecates a snapshot, the biggest hurdle for production deployments is verifying whether the new model preserves relational semantic representations across edge cases.

I built Vector Tongue to treat this as a statistical system identification problem rather than speculative vibe checks:
- Input/output paired behavioral translation
- Evaluated against standard baselines on held-out test splits (Target-Mean, Mean-Shift, Orthogonal Procrustes, Ridge Affine, Kernel RBF)
- 8-tier graded reconstruction testing (proving macro-intent is preserved while verbatim token reconstruction is properly falsified)
- CI/CD Release Gate script for GitHub Actions

Live app: ${deployedUrl}

Would love to hear how folks here handle automated qualification before swapping inference endpoints in prod.`,
    },
  ];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Megaphone className="w-3.5 h-3.5 text-indigo-400" />
              <span>Launch & Marketing Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-2">
              Advertise & Sell Vector Tongue Immediately
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Turn-key, high-converting copy and outreach templates ready to copy and post to buyers today.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={deployedUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Open Public App URL</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Live URL Display */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 truncate mr-2">
            Public App: <strong className="text-emerald-400">{deployedUrl}</strong>
          </span>
          <button
            onClick={() => copyToClipboard(deployedUrl, "url")}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] flex items-center gap-1 shrink-0"
          >
            {copiedId === "url" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedId === "url" ? "Copied!" : "Copy URL"}</span>
          </button>
        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="space-y-4">
        {campaigns.map((camp) => (
          <div
            key={camp.id}
            className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3 hover:border-slate-700 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-indigo-300 border border-slate-700">
                  {camp.channel}
                </span>
                <h3 className="text-sm font-bold text-white mt-1">{camp.title}</h3>
                <p className="text-xs text-slate-400">{camp.subtitle}</p>
              </div>

              <button
                onClick={() => copyToClipboard(camp.content, camp.id)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 shrink-0 cursor-pointer self-start sm:self-center"
              >
                {copiedId === camp.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full Post</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
              {camp.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
