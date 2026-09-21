import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  parseEmbeddingPairsCsv,
  PairDataset,
  syntheticTranslationDataset,
} from "./src/lib/data";
import { evaluateTranslator, rowSquaredErrors } from "./src/lib/evaluation";
import { RidgeTranslator, OrthogonalTranslator } from "./src/lib/models";
import { asVector, cosineSimilarity, driftComponents } from "./src/lib/geometry";
import { norm } from "./src/lib/matrix";
import { pairedTargetPermutationTest } from "./src/lib/statistics";
import { verifyManifest } from "./src/lib/provenance";

const PORT = Number(process.env.PORT || 3000);
const VERSION = "0.3.0";
const BUILD_COMMIT = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local";
const BUILD = `${VERSION}+${BUILD_COMMIT.slice(0, 8)}`;

type Provider = "openai" | "gemini";

function parseAllowedOrigins() {
  return (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractOpenAIText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks: string[] = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

async function callOpenAI(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 700 }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI request failed (${response.status})`);
  const text = extractOpenAIText(data);
  if (!text) throw new Error("OpenAI returned no text output.");
  return text;
}

async function callGemini(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
      }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gemini request failed (${response.status})`);
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
  if (!text) throw new Error("Gemini returned no text output.");
  return text;
}

async function callProvider(provider: Provider, model: string, prompt: string) {
  return provider === "gemini" ? callGemini(model, prompt) : callOpenAI(model, prompt);
}

async function embedWithOpenAI(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required as the fixed external encoder for live comparisons.");
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", dimensions: 256, input: texts }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Embedding request failed (${response.status})`);
  return (data?.data || []).sort((a: any, b: any) => a.index - b.index).map((item: any) => item.embedding);
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function runAudit(dataset: PairDataset, modelAName: string, modelBName: string, seed: number) {
  const { runComparativeObservabilityAudit } = await import("./src/lib/observabilityEngine");
  return runComparativeObservabilityAudit(dataset, {
    modelAName,
    modelBName,
    testFraction: 0.3,
    seed,
  });
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");

  const allowedOrigins = parseAllowedOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed"));
      },
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", framework: "vector-tongue", version: VERSION, build: BUILD, commit: BUILD_COMMIT });
  });

  app.get("/api/product", (_req, res) => {
    res.json({
      name: "Vector Tongue",
      version: VERSION,
      build: BUILD,
      category: "Model Change Assurance",
      created_by: "RJ Marler",
      positioning: "Black-box behavioral change control for AI model migrations and releases.",
      decision_contract: ["What changed?", "Where?", "Does it matter?", "Can I ship?"],
      evidence_grades: ["SYNTHETIC_DEMO", "USER_SUPPLIED", "LIVE_PROVIDER_CALLS"],
      capabilities: [
        "held-out cross-model translation",
        "semantic drift analysis",
        "declared baselines",
        "negative controls",
        "release gating",
        "reproducible evidence exports",
        "live OpenAI/Gemini comparison when server credentials are configured",
      ],
      truth_boundary: "Synthetic demonstrations are never eligible for production release decisions.",
      code_repository: "https://github.com/RJMpgh/vector-tongue",
    });
  });

  app.get("/api/sample-csv", (_req, res) => {
    try {
      const csvPath = path.join(process.cwd(), "examples", "paired_embeddings.csv");
      if (fs.existsSync(csvPath)) return res.type("text/csv").send(fs.readFileSync(csvPath, "utf-8"));
      return res.status(404).json({ error: "Sample CSV not found." });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/demo", (req, res) => {
    try {
      const { samples = 80, dimension = 12, noise = 0.025, seed = 17, regularization = 0.1 } = req.body || {};
      const dataset = syntheticTranslationDataset({ samples: Number(samples), dimension: Number(dimension), noise: Number(noise), seed: Number(seed) });
      const { train, test } = dataset.split(0.25, Number(seed));
      const report = evaluateTranslator(new RidgeTranslator(Number(regularization)), train, test, { seed: Number(seed), includeDetails: true });
      return res.json({
        demonstration: true,
        evidence: { grade: "SYNTHETIC_DEMO", decision_eligible: false },
        warning: "Synthetic data validates the pipeline; it is not empirical model evidence.",
        report,
        dataset_meta: { total_samples: dataset.size, dimension: dataset.dimension, train_samples: train.size, test_samples: test.size },
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/evaluate", (req, res) => {
    try {
      const { csv, pairs, model = "ridge", regularization = 1.0, test_fraction = 0.25, seed = 17, run_permutation = false } = req.body || {};
      let dataset: PairDataset;
      if (typeof csv === "string" && csv.trim()) dataset = parseEmbeddingPairsCsv(csv);
      else if (Array.isArray(pairs) && pairs.length > 0) dataset = PairDataset.fromPairs(pairs);
      else return res.status(400).json({ error: "Either 'csv' text or 'pairs' array must be provided." });

      const { train, test } = dataset.split(Number(test_fraction), Number(seed));
      const translationModel = model === "orthogonal" ? new OrthogonalTranslator() : new RidgeTranslator(Number(regularization));
      const report = evaluateTranslator(translationModel, train, test, { seed: Number(seed), includeDetails: true });
      let permutationResult = null;
      if (run_permutation && train.size >= 3) {
        permutationResult = pairedTargetPermutationTest(
          train.source,
          train.target,
          (X, Y) => {
            const m = model === "orthogonal" ? new OrthogonalTranslator() : new RidgeTranslator(Number(regularization));
            m.fit(X, Y);
            const pred = m.predict(test.source);
            const errs = rowSquaredErrors(pred, test.target);
            return errs.reduce((a, b) => a + b, 0) / errs.length;
          },
          { permutations: 300, seed: Number(seed) }
        );
      }
      return res.json({ report, permutation: permutationResult, evidence: { grade: "USER_SUPPLIED", decision_eligible: true }, dataset_meta: { total_samples: dataset.size, dimension: dataset.dimension, train_samples: train.size, test_samples: test.size } });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/drift", (req, res) => {
    try {
      const a = asVector(req.body?.vector_a, "vector_a");
      const b = asVector(req.body?.vector_b, "vector_b");
      return res.json({ ...driftComponents(a, b), norm_a: norm(a), norm_b: norm(b), cosine_similarity: cosineSimilarity(a, b) });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/observability-audit", async (req, res) => {
    try {
      const { csv, model_a_name = "Model A", model_b_name = "Model B", seed = 42 } = req.body || {};
      const synthetic = !(typeof csv === "string" && csv.trim().length > 0);
      const dataset = synthetic ? syntheticTranslationDataset({ samples: 120, dimension: 16, noise: 0.035, seed: Number(seed) }) : parseEmbeddingPairsCsv(csv);
      const nameA = synthetic ? "Synthetic Model A Proxy" : String(model_a_name);
      const nameB = synthetic ? "Synthetic Model B Proxy" : String(model_b_name);
      const raw = await runAudit(dataset, nameA, nameB, Number(seed));
      const evidence = synthetic
        ? { grade: "SYNTHETIC_DEMO", decision_eligible: false, source: "deterministic synthetic transformation", note: "Pipeline demonstration only; never use as a production release verdict." }
        : { grade: "USER_SUPPLIED", decision_eligible: true, source: "user-supplied paired embeddings", note: "Decision support is only as trustworthy as the supplied dataset and its provenance." };

      const result: any = {
        ...raw,
        evidence,
        data_source: evidence.source,
        decision_notice: evidence.note,
      };
      if (synthetic) {
        result.verdict_category = "DEMO ONLY";
        result.four_questions = { ...raw.four_questions, can_i_ship: "No production decision is permitted from synthetic demo data. Supply measured paired outputs or run a live provider comparison." };
        result.release_gate = { ...raw.release_gate, status: "NOT_APPLICABLE", exit_code: 3, summary: "Synthetic evidence cannot pass or fail a production release gate." };
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/live-compare", async (req, res) => {
    try {
      const {
        provider_a = "openai",
        model_a = "gpt-5.6-luna",
        provider_b = "gemini",
        model_b = "gemini-3.8-flash",
        prompts,
        seed = 42,
      } = req.body || {};

      if (!["openai", "gemini"].includes(provider_a) || !["openai", "gemini"].includes(provider_b)) {
        return res.status(400).json({ error: "provider_a and provider_b must be 'openai' or 'gemini'." });
      }
      if (!Array.isArray(prompts) || prompts.length < 8 || prompts.length > 40) {
        return res.status(400).json({ error: "Provide between 8 and 40 prompts for a live comparison." });
      }
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ error: "Live comparison is not enabled yet: OPENAI_API_KEY is missing from the server environment." });
      }
      if ((provider_a === "gemini" || provider_b === "gemini") && !process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: "Live comparison is not enabled yet: GEMINI_API_KEY is missing from the server environment." });
      }

      const normalized = prompts.map((p: any, i: number) => typeof p === "string" ? { id: `p${String(i + 1).padStart(3, "0")}`, category: "general", text: p } : { id: String(p.id || `p${i + 1}`), category: String(p.category || "general"), text: String(p.text || "") });
      if (normalized.some((p: any) => !p.text.trim())) return res.status(400).json({ error: "Every live prompt must contain text." });

      const outputsA: string[] = [];
      const outputsB: string[] = [];
      for (const prompt of normalized) {
        const [a, b] = await Promise.all([
          callProvider(provider_a as Provider, String(model_a), prompt.text),
          callProvider(provider_b as Provider, String(model_b), prompt.text),
        ]);
        outputsA.push(a);
        outputsB.push(b);
      }

      const embeddings = await embedWithOpenAI([...outputsA, ...outputsB]);
      const embeddingsA = embeddings.slice(0, outputsA.length);
      const embeddingsB = embeddings.slice(outputsA.length);
      const csv = [
        "prompt_id,category,source_embedding,target_embedding",
        ...normalized.map((p: any, i: number) => `${csvEscape(p.id)},${csvEscape(p.category)},${csvEscape(JSON.stringify(embeddingsA[i]))},${csvEscape(JSON.stringify(embeddingsB[i]))}`),
      ].join("\n");
      const dataset = parseEmbeddingPairsCsv(csv);
      const raw = await runAudit(dataset, `${provider_a}:${model_a}`, `${provider_b}:${model_b}`, Number(seed));
      return res.json({
        ...raw,
        evidence: {
          grade: "LIVE_PROVIDER_CALLS",
          decision_eligible: true,
          source: "live provider outputs embedded with fixed OpenAI text-embedding-3-small encoder (256 dimensions)",
          note: "Measured live outputs. Production decisions still require representative prompts, sufficient sample size, and organization-specific thresholds.",
        },
        data_source: "live_provider_calls",
        decision_notice: "Measured live outputs. Treat the starter suite as a smoke test; expand to production-representative traffic before a high-stakes cutover.",
        live_run: {
          provider_a,
          model_a,
          provider_b,
          model_b,
          prompt_count: normalized.length,
          external_encoder: "OpenAI text-embedding-3-small",
          encoder_dimensions: 256,
          outputs: normalized.map((p: any, i: number) => ({ id: p.id, category: p.category, prompt: p.text, output_a: outputsA[i], output_b: outputsB[i] })),
        },
      });
    } catch (err: any) {
      return res.status(502).json({ error: err.message || "Live provider comparison failed." });
    }
  });

  app.get("/api/bench/vt-bench-v1", async (_req, res) => {
    try {
      const { VTBENCH_PROMPTS, VTBENCH_VERSION } = await import("./src/lib/vtBench");
      return res.json({ version: VTBENCH_VERSION, prompt_count: VTBENCH_PROMPTS.length, prompts: VTBENCH_PROMPTS });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gate", async (req, res) => {
    try {
      const { evaluateReleaseGate, DEFAULT_RELEASE_POLICY } = await import("./src/lib/releaseGate");
      if (!req.body?.metrics) return res.status(400).json({ error: "Missing required 'metrics' object in request body." });
      const gateResult = evaluateReleaseGate(req.body.metrics, req.body.policy || DEFAULT_RELEASE_POLICY);
      return res.status(gateResult.status === "PASS" ? 200 : 422).json(gateResult);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cost-estimate", (req, res) => {
    const { prompt_count = 50, avg_tokens_per_prompt = 512, price_per_million_tokens = 0.5 } = req.body || {};
    const estTokens = Number(prompt_count) * Number(avg_tokens_per_prompt) * 2;
    const estCost = (estTokens / 1_000_000) * Number(price_per_million_tokens);
    return res.json({ prompt_count: Number(prompt_count), estimated_tokens: estTokens, estimated_api_calls: Number(prompt_count) * 2, estimated_cost_usd: Number(estCost.toFixed(4)), currency: "USD", disclaimer: "Estimate only; verify current provider pricing before purchase or deployment." });
  });

  app.post("/api/events", (req, res) => {
    const allowed = new Set(["pricing_opened", "audit_started", "audit_completed", "audit_failed", "report_downloaded", "inquiry_prepared"]);
    const event = String(req.body?.event || "");
    if (!allowed.has(event)) return res.status(400).json({ error: "Unknown launch event." });
    console.log(JSON.stringify({
      type: "vector_tongue_launch_event",
      event,
      timestamp: new Date().toISOString(),
      path: String(req.body?.path || "").slice(0, 200),
      meta: req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : {},
      version: VERSION,
      build: BUILD,
    }));
    return res.status(202).json({ accepted: true });
  });

  app.post("/api/checkout/inquire", (req, res) => {
    try {
      const { intent = "pilot", email = "", company = "", notes = "" } = req.body || {};
      if (!email || !String(email).includes("@")) return res.status(400).json({ error: "A valid contact email is required." });
      const allowedIntents = new Set(["pilot", "enterprise", "strategic"]);
      const normalizedIntent = allowedIntents.has(String(intent)) ? String(intent) : "pilot";
      const inquiryId = `VT-INQ-${Date.now().toString(36).toUpperCase()}`;
      const offer = normalizedIntent === "pilot" ? "Founding Model Migration Audit — $1,500 USD" : normalizedIntent;
      const subject = `Vector Tongue ${normalizedIntent} inquiry — ${company || email}`;
      const body = [
        `Inquiry ID: ${inquiryId}`,
        `Intent: ${normalizedIntent}`,
        `Offer: ${offer}`,
        `Company: ${company || "Not provided"}`,
        `Contact: ${email}`,
        "",
        String(notes || "Please contact me about Vector Tongue."),
      ].join("\n");
      const mailtoUrl = `mailto:rjmarler8@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      console.log(JSON.stringify({ type: "vector_tongue_launch_event", event: "inquiry_prepared", timestamp: new Date().toISOString(), intent: normalizedIntent, version: VERSION, build: BUILD }));
      return res.json({
        success: true,
        status: "ready_to_send",
        inquiry_id: inquiryId,
        intent: normalizedIntent,
        mailto_url: mailtoUrl,
        contact_email: "rjmarler8@gmail.com",
        disclosure: "The app prepared this email draft; it has not claimed or simulated that an email, invoice, payment, or license was sent.",
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/manifest", (_req, res) => {
    try {
      const manifestPath = path.join(process.cwd(), "provenance", "vector_tongue_priority_manifest.json");
      if (!fs.existsSync(manifestPath)) return res.status(404).json({ error: "Manifest file not found" });
      return res.json(verifyManifest(manifestPath));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Vector Tongue ${BUILD} running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
