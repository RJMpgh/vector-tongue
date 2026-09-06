/**
 * Validated paired-embedding datasets for output-only analysis.
 */
import { asVector, requireSameShape } from "./geometry";
import { Matrix, Vector } from "./matrix";
import { createRng } from "./statistics";

export interface EmbeddingPair {
  prompt_id: string;
  source: Vector;
  target: Vector;
  category: string;
}

export class PairDataset {
  readonly prompt_ids: string[];
  readonly source: Matrix;
  readonly target: Matrix;
  readonly categories: string[];

  constructor(
    prompt_ids: string[],
    source: Matrix,
    target: Matrix,
    categories: string[]
  ) {
    if (source.length === 0) {
      throw new Error("at least one embedding pair is required");
    }
    if (source.length !== target.length) {
      throw new Error("source and target matrices must have equal shape");
    }
    if (source[0].length !== target[0].length) {
      throw new Error("source and target dimensions differ");
    }
    if (prompt_ids.length !== source.length) {
      throw new Error("prompt_ids length does not match matrix rows");
    }
    if (categories.length !== source.length) {
      throw new Error("categories length does not match prompt_ids");
    }

    this.prompt_ids = [...prompt_ids];
    this.source = source.map((r) => [...r]);
    this.target = target.map((r) => [...r]);
    this.categories = [...categories];
  }

  get size(): number {
    return this.source.length;
  }

  get dimension(): number {
    return this.source[0].length;
  }

  subset(indices: number[]): PairDataset {
    return new PairDataset(
      indices.map((i) => this.prompt_ids[i]),
      indices.map((i) => this.source[i]),
      indices.map((i) => this.target[i]),
      indices.map((i) => this.categories[i])
    );
  }

  split(testFraction = 0.25, seed = 17): { train: PairDataset; test: PairDataset } {
    if (testFraction <= 0 || testFraction >= 1) {
      throw new Error("testFraction must be between 0 and 1");
    }
    if (this.size < 4) {
      throw new Error("at least four pairs are required for a train/test split");
    }

    const rng = createRng(seed);
    const order = Array.from({ length: this.size }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = this.size - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = order[i];
      order[i] = order[j];
      order[j] = temp;
    }

    const testSize = Math.min(this.size - 2, Math.max(1, Math.round(this.size * testFraction)));
    const testIndices = order.slice(0, testSize);
    const trainIndices = order.slice(testSize);

    return {
      train: this.subset(trainIndices),
      test: this.subset(testIndices),
    };
  }

  static fromPairs(pairs: EmbeddingPair[]): PairDataset {
    if (!pairs || pairs.length === 0) {
      throw new Error("at least one embedding pair is required");
    }
    const ids = pairs.map((p) => p.prompt_id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new Error("prompt_id values must be unique");
    }
    const source = pairs.map((p) => asVector(p.source, "source"));
    const target = pairs.map((p) => asVector(p.target, "target"));
    const categories = pairs.map((p) => p.category || "unspecified");

    return new PairDataset(ids, source, target, categories);
  }
}

/**
 * Parse CSV format with columns: prompt_id, category, source_embedding, target_embedding
 */
export function parseEmbeddingPairsCsv(csvText: string): PairDataset {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("CSV file must contain a header and at least one data row");
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCsvRow(headerLine).map((h) => h.trim().toLowerCase());
  const promptIdIdx = headers.indexOf("prompt_id");
  const categoryIdx = headers.indexOf("category");
  const sourceIdx = headers.indexOf("source_embedding");
  const targetIdx = headers.indexOf("target_embedding");

  if (promptIdIdx === -1 || sourceIdx === -1 || targetIdx === -1) {
    throw new Error(
      "CSV header must contain 'prompt_id', 'source_embedding', and 'target_embedding'"
    );
  }

  const pairs: EmbeddingPair[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvRow(line);
    const prompt_id = cols[promptIdIdx]?.trim();
    if (!prompt_id) {
      throw new Error(`Row ${i} missing prompt_id`);
    }
    const category = categoryIdx !== -1 && cols[categoryIdx] ? cols[categoryIdx].trim() : "unspecified";

    let source: number[];
    let target: number[];
    try {
      source = JSON.parse(cols[sourceIdx]);
      target = JSON.parse(cols[targetIdx]);
    } catch {
      throw new Error(
        `Row ${i} contains invalid JSON embedding arrays for prompt ${prompt_id}`
      );
    }

    pairs.push({
      prompt_id,
      category,
      source: asVector(source, `row ${i} source`),
      target: asVector(target, `row ${i} target`),
    });
  }

  return PairDataset.fromPairs(pairs);
}

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let inQuotes = false;
  let currentCell = "";

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(currentCell);
      currentCell = "";
    } else {
      currentCell += char;
    }
  }
  cells.push(currentCell);
  return cells;
}

/**
 * Standard Gaussian random variable via Box-Muller transform
 */
function gaussian(rng: () => number, mean = 0, std = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z0 * std + mean;
}

/**
 * Deterministic synthetic data generator used to exercise the research pipeline.
 */
export function syntheticTranslationDataset(options?: {
  samples?: number;
  dimension?: number;
  noise?: number;
  seed?: number;
}): PairDataset {
  const {
    samples = 80,
    dimension = 12,
    noise = 0.025,
    seed = 17,
  } = options || {};

  if (samples < 8) throw new Error("samples must be at least 8");
  if (dimension < 2) throw new Error("dimension must be at least 2");
  if (noise < 0) throw new Error("noise must be non-negative");

  const rng = createRng(seed);

  // Generate source vectors
  const source: Matrix = Array.from({ length: samples }, () =>
    Array.from({ length: dimension }, () => gaussian(rng, 0, 1))
  );

  // Generate a random rotation/transformation matrix (QR decomposition approximation)
  const rawRotation: Matrix = Array.from({ length: dimension }, () =>
    Array.from({ length: dimension }, () => gaussian(rng, 0, 1))
  );

  // Gram-Schmidt orthogonalization to get rotation matrix Q
  const Q: Matrix = Array.from({ length: dimension }, () => new Array<number>(dimension).fill(0));
  for (let j = 0; j < dimension; j++) {
    let v = rawRotation.map((row) => row[j]);
    for (let k = 0; k < j; k++) {
      const qk = Q.map((row) => row[k]);
      let dotProd = 0;
      for (let r = 0; r < dimension; r++) dotProd += v[r] * qk[r];
      for (let r = 0; r < dimension; r++) v[r] -= dotProd * qk[r];
    }
    let vNorm = 0;
    for (let r = 0; r < dimension; r++) vNorm += v[r] * v[r];
    vNorm = Math.sqrt(vNorm);
    for (let r = 0; r < dimension; r++) Q[r][j] = v[r] / (vNorm || 1);
  }

  // Linear diagonal scale 0.8 to 1.2
  const scale = Array.from({ length: dimension }, (_, i) => 0.8 + (0.4 * i) / (dimension - 1));
  const weights: Matrix = Array.from({ length: dimension }, (_, i) =>
    Array.from({ length: dimension }, (_, j) => Q[i][j] * scale[j])
  );

  const intercept = Array.from({ length: dimension }, () => gaussian(rng, 0, 0.15));

  // Compute target = source * weights + intercept + noise
  const pairs: EmbeddingPair[] = [];
  const categories = ["factual", "reasoning", "creative", "safety"];

  for (let i = 0; i < samples; i++) {
    const sVec = source[i];
    const tVec = new Array<number>(dimension);
    for (let j = 0; j < dimension; j++) {
      let val = 0;
      for (let k = 0; k < dimension; k++) {
        val += sVec[k] * weights[k][j];
      }
      val += intercept[j] + gaussian(rng, 0, noise);
      tVec[j] = val;
    }
    pairs.push({
      prompt_id: `demo-${String(i).padStart(3, "0")}`,
      source: sVec,
      target: tVec,
      category: categories[i % categories.length],
    });
  }

  return PairDataset.fromPairs(pairs);
}
