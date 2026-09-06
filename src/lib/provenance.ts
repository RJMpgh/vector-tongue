/**
 * Hash and provenance verification without making legal conclusions.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const HEX_32_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export interface ArtifactCheck {
  path: string;
  expected_sha256: string;
  actual_sha256: string | null;
  status: "match" | "mismatch" | "missing" | "invalid_hash";
  role?: string;
  byte_size?: number;
}

export interface ManifestCheck {
  manifest_version: string;
  project?: string;
  recorded_by?: string;
  artifacts: ArtifactCheck[];
  polygon_status: string;
  warnings: string[];
  all_local_hashes_match: boolean;
  cautions?: string[];
  hashchain_record?: Record<string, unknown>;
  polygon?: Record<string, unknown>;
}

export function sha256File(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

export function verifyManifest(
  manifestPath: string,
  artifactRoot?: string
): ManifestCheck {
  const content = fs.readFileSync(manifestPath, "utf-8");
  const payload = JSON.parse(content);
  const warnings: string[] = [];
  const version = String(payload.manifest_version || "unknown");
  const root = artifactRoot ? path.resolve(artifactRoot) : path.dirname(path.resolve(manifestPath));

  const checks: ArtifactCheck[] = [];
  for (const artifact of payload.artifacts || []) {
    const relPath = String(artifact.path || "");
    const expected = String(artifact.sha256 || "").toLowerCase();

    if (!SHA256_PATTERN.test(expected)) {
      checks.push({
        path: relPath,
        expected_sha256: expected,
        actual_sha256: null,
        status: "invalid_hash",
        role: artifact.role,
        byte_size: artifact.byte_size,
      });
      continue;
    }

    const localPath = path.join(root, relPath);
    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
      checks.push({
        path: relPath,
        expected_sha256: expected,
        actual_sha256: null,
        status: "missing",
        role: artifact.role,
        byte_size: artifact.byte_size,
      });
      continue;
    }

    const actual = sha256File(localPath);
    checks.push({
      path: relPath,
      expected_sha256: expected,
      actual_sha256: actual,
      status: actual === expected ? "match" : "mismatch",
      role: artifact.role,
      byte_size: artifact.byte_size,
    });
  }

  const polygon = payload.polygon || {};
  const tx = polygon.transaction_hash;
  const contract = polygon.contract_address;
  const tokenId = polygon.token_id;

  let polygon_status: string;
  if (tx === null && contract === null && tokenId === null) {
    polygon_status = "identifiers_missing";
    warnings.push("No Polygon transaction hash, contract address, or token ID is recorded.");
  } else if (
    !(
      typeof tx === "string" &&
      HEX_32_PATTERN.test(tx) &&
      typeof contract === "string" &&
      ADDRESS_PATTERN.test(contract) &&
      tokenId !== null &&
      tokenId !== undefined
    )
  ) {
    polygon_status = "identifiers_invalid_or_incomplete";
    warnings.push("Polygon identifiers are incomplete or malformed.");
  } else {
    polygon_status = "identifiers_well_formed_not_chain_verified";
    warnings.push(
      "Identifier syntax is valid, but this local check does not establish ownership, timestamp, content linkage, or legal priority."
    );
  }

  const all_local_hashes_match =
    checks.length > 0 && checks.every((c) => c.status === "match");

  return {
    manifest_version: version,
    project: payload.project,
    recorded_by: payload.recorded_by,
    artifacts: checks,
    polygon_status,
    warnings,
    all_local_hashes_match,
    cautions: payload.cautions,
    hashchain_record: payload.hashchain_record,
    polygon,
  };
}
