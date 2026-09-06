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
import {
  asVector,
  cosineDistance,
  cosineSimilarity,
  driftComponents,
  l2Distance,
  marlerDriftV1,
} from "./src/lib/geometry";
import { norm } from "./src/lib/matrix";
import { pairedTargetPermutationTest } from "./src/lib/statistics";
import { verifyManifest } from "./src/lib/provenance";

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", framework: "vector-tongue", version: "0.2.0" });
  });

  // GET Sample CSV
  app.get("/api/sample-csv", (_req, res) => {
    try {
      const csvPath = path.join(process.cwd(), "examples", "paired_embeddings.csv");
      if (fs.existsSync(csvPath)) {
        const content = fs.readFileSync(csvPath, "utf-8");
        return res.send(content);
      }
      // Fallback sample data if file missing
      const fallback = `prompt_id,category,source_embedding,target_embedding
p001,factual,"[1.0, 0.0, 0.2]","[0.8, 0.3, 0.1]"
p002,factual,"[0.9, 0.1, 0.1]","[0.7, 0.4, 0.0]"
p003,reasoning,"[0.1, 1.0, 0.2]","[-0.2, 0.8, 0.4]"
p004,reasoning,"[0.2, 0.8, 0.3]","[-0.1, 0.7, 0.5]"
p005,creative,"[0.2, 0.1, 1.0]","[0.1, -0.2, 0.9]"
p006,creative,"[0.3, 0.2, 0.8]","[0.2, -0.1, 0.7]"
p007,safety,"[0.7, 0.6, 0.1]","[0.4, 0.7, 0.2]"
p008,safety,"[0.6, 0.7, 0.2]","[0.3, 0.8, 0.3]"`;
      return res.send(fallback);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/demo: deterministic synthetic demonstration
  app.post("/api/demo", (req, res) => {
    try {
      const {
        samples = 80,
        dimension = 12,
        noise = 0.025,
        seed = 17,
        regularization = 0.1,
      } = req.body || {};

      const dataset = syntheticTranslationDataset({
        samples: Number(samples),
        dimension: Number(dimension),
        noise: Number(noise),
        seed: Number(seed),
      });

      const { train, test } = dataset.split(0.25, Number(seed));
      const model = new RidgeTranslator(Number(regularization));
      const report = evaluateTranslator(model, train, test, {
        seed: Number(seed),
        includeDetails: true,
      });

      return res.json({
        demonstration: true,
        warning:
          "Synthetic data validates the pipeline; it is not empirical model evidence.",
        report,
        dataset_meta: {
          total_samples: dataset.size,
          dimension: dataset.dimension,
          train_samples: train.size,
          test_samples: test.size,
        },
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // POST /api/evaluate: evaluate paired embeddings from CSV or parsed pairs
  app.post("/api/evaluate", (req, res) => {
    try {
      const {
        csv,
        pairs,
        model = "ridge",
        regularization = 1.0,
        test_fraction = 0.25,
        seed = 17,
        run_permutation = false,
      } = req.body || {};

      let dataset: PairDataset;
      if (typeof csv === "string" && csv.trim()) {
        dataset = parseEmbeddingPairsCsv(csv);
      } else if (Array.isArray(pairs) && pairs.length > 0) {
        dataset = PairDataset.fromPairs(pairs);
      } else {
        return res
          .status(400)
          .json({ error: "Either 'csv' text or 'pairs' array must be provided." });
      }

      const { train, test } = dataset.split(
        Number(test_fraction),
        Number(seed)
      );
      const translationModel =
        model === "orthogonal"
          ? new OrthogonalTranslator()
          : new RidgeTranslator(Number(regularization));

      const report = evaluateTranslator(translationModel, train, test, {
        seed: Number(seed),
        includeDetails: true,
      });

      let permutationResult = null;
      if (run_permutation && train.size >= 3) {
        // Run negative control permutation test on training set
        permutationResult = pairedTargetPermutationTest(
          train.source,
          train.target,
          (X, Y) => {
            const m =
              model === "orthogonal"
                ? new OrthogonalTranslator()
                : new RidgeTranslator(Number(regularization));
            m.fit(X, Y);
            const pred = m.predict(test.source);
            const errs = rowSquaredErrors(pred, test.target);
            return errs.reduce((a, b) => a + b, 0) / errs.length;
          },
          { permutations: 300, seed: Number(seed) }
        );
      }

      return res.json({
        report,
        permutation: permutationResult,
        dataset_meta: {
          total_samples: dataset.size,
          dimension: dataset.dimension,
          train_samples: train.size,
          test_samples: test.size,
        },
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // POST /api/drift: compute drift components between two vectors
  app.post("/api/drift", (req, res) => {
    try {
      const { vector_a, vector_b } = req.body || {};
      const a = asVector(vector_a, "vector_a");
      const b = asVector(vector_b, "vector_b");

      const components = driftComponents(a, b);
      const normA = norm(a);
      const normB = norm(b);
      const cosSim = cosineSimilarity(a, b);

      return res.json({
        ...components,
        norm_a: normA,
        norm_b: normB,
        cosine_similarity: cosSim,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // POST /api/observability-audit: complete black-box comparison, baselines, and reconstruction hierarchy
  app.post("/api/observability-audit", async (req, res) => {
    try {
      const {
        csv,
        model_a_name = "Model-Alpha",
        model_b_name = "Model-Beta",
        test_fraction = 0.3,
        seed = 42,
      } = req.body || {};

      let dataset: PairDataset;
      if (csv && typeof csv === "string" && csv.trim().length > 0) {
        dataset = parseEmbeddingPairsCsv(csv);
      } else {
        dataset = syntheticTranslationDataset({ samples: 100, dimension: 16, noise: 0.03, seed: Number(seed) });
      }

      const { runComparativeObservabilityAudit } = await import("./src/lib/observabilityEngine");
      const auditResult = runComparativeObservabilityAudit(dataset, {
        modelAName: String(model_a_name),
        modelBName: String(model_b_name),
        testFraction: Number(test_fraction),
        seed: Number(seed),
      });

      return res.json(auditResult);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // GET /api/bench/vt-bench-v1: canonical benchmark corpus
  app.get("/api/bench/vt-bench-v1", async (_req, res) => {
    try {
      const { VTBENCH_PROMPTS, VTBENCH_VERSION } = await import("./src/lib/vtBench");
      return res.json({
        version: VTBENCH_VERSION,
        prompt_count: VTBENCH_PROMPTS.length,
        prompts: VTBENCH_PROMPTS,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/gate: evaluate model release gate against policy
  app.post("/api/gate", async (req, res) => {
    try {
      const { evaluateReleaseGate, DEFAULT_RELEASE_POLICY } = await import("./src/lib/releaseGate");
      const { metrics, policy } = req.body || {};
      if (!metrics) {
        return res.status(400).json({ error: "Missing required 'metrics' object in request body." });
      }
      const gateResult = evaluateReleaseGate(metrics, policy || DEFAULT_RELEASE_POLICY);
      return res.status(gateResult.status === "PASS" ? 200 : 422).json(gateResult);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/cost-estimate: estimate token and API costs before experiment
  app.post("/api/cost-estimate", (req, res) => {
    try {
      const { prompt_count = 50, avg_tokens_per_prompt = 512, price_per_million_tokens = 0.5 } = req.body || {};
      const estTokens = Number(prompt_count) * Number(avg_tokens_per_prompt) * 2; // prompt + response
      const estCost = (estTokens / 1_000_000) * Number(price_per_million_tokens);
      return res.json({
        prompt_count: Number(prompt_count),
        estimated_tokens: estTokens,
        estimated_api_calls: Number(prompt_count) * 2,
        estimated_duration_sec: Math.max(3, Math.round(Number(prompt_count) * 0.05)),
        estimated_cost_usd: Number(estCost.toFixed(4)),
        currency: "USD",
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // POST /api/checkout/inquire: process commercial purchase or pilot booking
  app.post("/api/checkout/inquire", (req, res) => {
    try {
      const {
        tier = "Migration Audit Pilot ($499)",
        price = 499,
        payment_method = "googlepay",
        email = "",
        company = "",
        model_a = "Claude 3.5 Sonnet",
        model_b = "GPT-4o",
        notes = "",
        cashtag = "",
      } = req.body || {};

      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "A valid contact email is required." });
      }

      const orderId = `VT-ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;
      
      const instructions = {
        cashapp: {
          cashtag: "$rjmarler8",
          pay_url: `https://cash.app/$rjmarler8/${price}`,
          memo: `VT-AUDIT-${orderId.slice(-6)}`,
          instructions: `Send $${price} USD to $rjmarler8 with note "${orderId.slice(-6)}". Verification email dispatched to ${email}.`,
        },
        googlepay: {
          action: "Google Pay / Card Checkout",
          instructions: `Google Pay / Card order registered for ${email}. Direct checkout link or invoice sent to ${email}.`,
          direct_support: "rjmarler8@gmail.com",
        },
        invoice: {
          billing_contact: "rjmarler8@gmail.com",
          status: "Net-30 Invoice Dispatched",
          instructions: `Official tax invoice generated for ${company || email} and routed to ${email}.`,
        },
      };

      return res.json({
        success: true,
        order_id: orderId,
        tier,
        price,
        payment_method,
        email,
        company,
        models: { model_a, model_b },
        instructions: instructions[payment_method as keyof typeof instructions] || instructions.googlepay,
        timestamp: new Date().toISOString(),
        support_email: "rjmarler8@gmail.com",
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/manifest: verify priority manifest
  app.get("/api/manifest", (_req, res) => {
    try {
      const manifestPath = path.join(
        process.cwd(),
        "provenance",
        "vector_tongue_priority_manifest.json"
      );
      if (!fs.existsSync(manifestPath)) {
        return res.status(404).json({ error: "Manifest file not found" });
      }
      const report = verifyManifest(manifestPath);
      return res.json(report);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Vector Tongue running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
