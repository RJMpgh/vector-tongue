"""Artifact hashing and provenance manifest validation."""

import hashlib
import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional


def compute_sha256(filepath: str) -> str:
    """Compute hex SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def verify_manifest(manifest_path: str, base_dir: Optional[str] = None) -> Dict[str, Any]:
    """Verify the structural integrity of a priority manifest and check any locally present artifacts."""
    manifest_file = Path(manifest_path)
    if not manifest_file.exists():
        raise FileNotFoundError(f"Manifest file not found: {manifest_path}")

    with open(manifest_file, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Validate structural fields
    required_fields = ["manifest_version", "project", "recorded_by", "artifacts"]
    for field in required_fields:
        if field not in manifest:
            raise ValueError(f"Manifest missing required field: {field}")

    if base_dir is None:
        base_dir = str(manifest_file.parent)

    artifact_reports: List[Dict[str, Any]] = []
    matched_count = 0
    missing_count = 0
    mismatch_count = 0

    for item in manifest.get("artifacts", []):
        path = item.get("path")
        expected_sha = item.get("sha256", "").lower()
        role = item.get("role", "unknown")

        # Validate SHA-256 formatting
        valid_sha_format = len(expected_sha) == 64 and all(c in "0123456789abcdef" for c in expected_sha)

        local_path = Path(base_dir) / path if path else None
        if local_path and local_path.exists():
            computed = compute_sha256(str(local_path))
            if computed.lower() == expected_sha:
                status = "verified_match"
                matched_count += 1
            else:
                status = "hash_mismatch"
                mismatch_count += 1
        else:
            status = "missing_locally"
            missing_count += 1

        artifact_reports.append({
            "path": path,
            "role": role,
            "expected_sha256": expected_sha,
            "valid_sha256_format": valid_sha_format,
            "status": status,
        })

    polygon_info = manifest.get("polygon", {})
    hashchain_record = manifest.get("hashchain_record", {})

    is_valid_structure = (
        len(artifact_reports) > 0
        and all(a["valid_sha256_format"] for a in artifact_reports)
        and mismatch_count == 0
    )

    return {
        "is_valid_structure": is_valid_structure,
        "manifest_version": manifest.get("manifest_version"),
        "project": manifest.get("project"),
        "recorded_by": manifest.get("recorded_by"),
        "source_status": manifest.get("source_status"),
        "hashchain_record": hashchain_record,
        "polygon_status": polygon_info.get("verification_status", "not_provided"),
        "summary": {
            "total_artifacts": len(artifact_reports),
            "verified_locally": matched_count,
            "missing_locally": missing_count,
            "mismatch_count": mismatch_count,
        },
        "artifacts": artifact_reports,
    }
