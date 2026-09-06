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
