"""Hash and provenance verification without making legal conclusions."""

from __future__ import annotations

import dataclasses
import hashlib
import json
import pathlib
import re
from typing import Any

SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
HEX_32_PATTERN = re.compile(r"^0x[0-9a-fA-F]{64}$")
ADDRESS_PATTERN = re.compile(r"^0x[0-9a-fA-F]{40}$")


def sha256_file(path: str | pathlib.Path) -> str:
    digest = hashlib.sha256()
    with pathlib.Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclasses.dataclass(frozen=True)
class ArtifactCheck:
    path: str
    expected_sha256: str
    actual_sha256: str | None
    status: str


@dataclasses.dataclass(frozen=True)
class ManifestCheck:
    manifest_version: str
    artifacts: tuple[ArtifactCheck, ...]
    polygon_status: str
    warnings: tuple[str, ...]

    @property
    def all_local_hashes_match(self) -> bool:
        return bool(self.artifacts) and all(
            artifact.status == "match" for artifact in self.artifacts
        )


def _valid_sha256(value: Any) -> bool:
    return isinstance(value, str) and bool(SHA256_PATTERN.fullmatch(value.lower()))


def verify_manifest(
    manifest_path: str | pathlib.Path,
    *,
    artifact_root: str | pathlib.Path | None = None,
) -> ManifestCheck:
    path = pathlib.Path(manifest_path)
    payload = json.loads(path.read_text(encoding="utf-8"))
    warnings: list[str] = []
    version = str(payload.get("manifest_version", "unknown"))
    root = pathlib.Path(artifact_root) if artifact_root is not None else path.parent
    checks: list[ArtifactCheck] = []
    for artifact in payload.get("artifacts", []):
        relative_path = str(artifact.get("path", ""))
        expected = str(artifact.get("sha256", "")).lower()
        if not _valid_sha256(expected):
            checks.append(ArtifactCheck(relative_path, expected, None, "invalid_hash"))
            continue
        local_path = root / relative_path
        if not local_path.is_file():
            checks.append(ArtifactCheck(relative_path, expected, None, "missing"))
            continue
        actual = sha256_file(local_path)
        checks.append(
            ArtifactCheck(
                relative_path,
                expected,
                actual,
                "match" if actual == expected else "mismatch",
            )
        )

    polygon = payload.get("polygon", {})
    transaction = polygon.get("transaction_hash")
    contract = polygon.get("contract_address")
    token_id = polygon.get("token_id")
    if transaction is None and contract is None and token_id is None:
        polygon_status = "identifiers_missing"
        warnings.append(
            "No Polygon transaction hash, contract address, or token ID is recorded."
        )
    elif not (
        isinstance(transaction, str)
        and HEX_32_PATTERN.fullmatch(transaction)
        and isinstance(contract, str)
        and ADDRESS_PATTERN.fullmatch(contract)
        and token_id is not None
    ):
        polygon_status = "identifiers_invalid_or_incomplete"
        warnings.append("Polygon identifiers are incomplete or malformed.")
    else:
        polygon_status = "identifiers_well_formed_not_chain_verified"
        warnings.append(
            "Identifier syntax is valid, but this local check does not establish ownership, "
            "timestamp, content linkage, or legal priority."
        )
    return ManifestCheck(version, tuple(checks), polygon_status, tuple(warnings))
