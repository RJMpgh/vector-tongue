"""Frozen protocol and artifact I/O for real-model experiments."""

from __future__ import annotations

import csv
import dataclasses
import hashlib
import json
import os
import pathlib
from collections import Counter
from typing import Any

import numpy as np
from numpy.typing import NDArray

FloatMatrix = NDArray[np.float64]


@dataclasses.dataclass(frozen=True)
class ExperimentConfig:
    protocol_version: str
    experiment_id: str
    status: str
    preregistered_utc: str
    prompt_file: str
    source_model: str
    target_model: str
    endpoint: str
    instructions: str
    reasoning_effort: str
    max_output_tokens: int
    store_responses: bool
    replicates: int
    embedding_model: str
    embedding_dimensions: int
    ridge_regularization: float
    bootstrap_resamples: int
    permutation_resamples: int
    confidence: float
    seed: int
    concurrency: int
    request_timeout_seconds: int
    max_retries: int
    calibration_label: str
    heldout_label: str
    responses_file: str
    embeddings_file: str
    embedding_index_file: str
    analysis_file: str
    manifest_file: str
    results_markdown_file: str
    pricing_source: str
    pricing_checked_utc: str
    price_usd_per_million_tokens: dict[str, dict[str, float]]

    @classmethod
    def load(cls, path: str | pathlib.Path) -> ExperimentConfig:
        payload = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
        try:
            config = cls(**payload)
        except TypeError as error:
            raise ValueError(f"invalid experiment configuration: {error}") from error
        config.validate()
        return config

    def validate(self) -> None:
        if not self.experiment_id.strip():
            raise ValueError("experiment_id must not be blank")
        if self.source_model == self.target_model:
            raise ValueError("source_model and target_model must differ")
        if self.endpoint != "responses":
            raise ValueError("only the Responses API is supported")
        if self.replicates < 1:
            raise ValueError("replicates must be at least one")
        if self.max_output_tokens < 1:
            raise ValueError("max_output_tokens must be positive")
        if self.embedding_dimensions < 2:
            raise ValueError("embedding_dimensions must be at least two")
        if self.ridge_regularization <= 0.0:
            raise ValueError("ridge_regularization must be positive")
        if self.bootstrap_resamples < 100:
            raise ValueError("bootstrap_resamples must be at least 100")
        if self.permutation_resamples < 100:
            raise ValueError("permutation_resamples must be at least 100")
        if not 0.0 < self.confidence < 1.0:
            raise ValueError("confidence must be between zero and one")
        if self.concurrency < 1:
            raise ValueError("concurrency must be at least one")
        if self.request_timeout_seconds < 1:
            raise ValueError("request_timeout_seconds must be positive")
        if self.max_retries < 1:
            raise ValueError("max_retries must be at least one")
        required_prices = {self.source_model, self.target_model, self.embedding_model}
        missing_prices = required_prices.difference(self.price_usd_per_million_tokens)
        if missing_prices:
            raise ValueError(f"pricing is missing for: {', '.join(sorted(missing_prices))}")


@dataclasses.dataclass(frozen=True)
class Prompt:
    prompt_id: str
    family: str
    split: str
    text: str


@dataclasses.dataclass(frozen=True)
class ResponseRecord:
    prompt_id: str
    family: str
    split: str
    replicate: int
    requested_model: str
    resolved_model: str
    response_id: str
    response_status: str
    incomplete_reason: str
    response_text: str
    input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    total_tokens: int
    created_at_utc: str
    latency_seconds: float
    attempts: int
    error: str

    @property
    def key(self) -> tuple[str, int, str]:
        return (self.prompt_id, self.replicate, self.requested_model)

    @property
    def succeeded(self) -> bool:
        return bool(self.response_text) and not self.error


@dataclasses.dataclass(frozen=True)
class EmbeddingRecord:
    row_index: int
    prompt_id: str
    family: str
    split: str
    replicate: int
    requested_model: str
    resolved_model: str
    response_id: str

    @property
    def key(self) -> tuple[str, int, str]:
        return (self.prompt_id, self.replicate, self.requested_model)


@dataclasses.dataclass(frozen=True)
class ProtocolSummary:
    prompt_count: int
    family_counts: dict[str, int]
    split_counts: dict[str, int]
    calls: int
    prompt_sha256: str
    config_sha256: str
    conservative_max_cost_usd: float


RESPONSE_FIELDS = tuple(field.name for field in dataclasses.fields(ResponseRecord))
EMBEDDING_INDEX_FIELDS = tuple(field.name for field in dataclasses.fields(EmbeddingRecord))


def repository_root(config_path: str | pathlib.Path) -> pathlib.Path:
    path = pathlib.Path(config_path).resolve()
    for candidate in (path.parent, *path.parents):
        if (candidate / "pyproject.toml").is_file():
            return candidate
    raise ValueError(f"could not find repository root above {path}")


def resolve_repo_path(root: pathlib.Path, configured_path: str) -> pathlib.Path:
    relative = pathlib.Path(configured_path)
    if relative.is_absolute():
        raise ValueError(f"configured path must be relative: {configured_path}")
    resolved = (root / relative).resolve()
    try:
        resolved.relative_to(root.resolve())
    except ValueError as error:
        raise ValueError(f"configured path escapes repository: {configured_path}") from error
    return resolved


def sha256_file(path: str | pathlib.Path) -> str:
    digest = hashlib.sha256()
    with pathlib.Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_prompts(
    path: str | pathlib.Path,
    *,
    calibration_label: str,
    heldout_label: str,
) -> list[Prompt]:
    prompts: list[Prompt] = []
    with pathlib.Path(path).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"id", "family", "split", "text"}
        missing = required.difference(reader.fieldnames or ())
        if missing:
            raise ValueError(f"prompt CSV is missing: {', '.join(sorted(missing))}")
        for row_number, row in enumerate(reader, start=2):
            prompt = Prompt(
                prompt_id=(row["id"] or "").strip(),
                family=(row["family"] or "").strip(),
                split=(row["split"] or "").strip(),
                text=(row["text"] or "").strip(),
            )
            if not all((prompt.prompt_id, prompt.family, prompt.split, prompt.text)):
                raise ValueError(f"blank prompt field on CSV row {row_number}")
            if prompt.split not in {calibration_label, heldout_label}:
                raise ValueError(f"invalid split {prompt.split!r} for {prompt.prompt_id}")
            prompts.append(prompt)
    identifiers = [prompt.prompt_id for prompt in prompts]
    duplicates = sorted(
        identifier for identifier, count in Counter(identifiers).items() if count > 1
    )
    if duplicates:
        raise ValueError(f"duplicate prompt IDs: {', '.join(duplicates)}")
    if not prompts:
        raise ValueError("prompt CSV contains no prompts")
    families = sorted({prompt.family for prompt in prompts})
    for family in families:
        family_splits = Counter(prompt.split for prompt in prompts if prompt.family == family)
        if family_splits[calibration_label] < 2:
            raise ValueError(f"{family} needs at least two calibration prompts")
        if family_splits[heldout_label] < 2:
            raise ValueError(f"{family} needs at least two held-out prompts")
    return prompts


def load_protocol(
    config_path: str | pathlib.Path,
) -> tuple[ExperimentConfig, pathlib.Path, list[Prompt]]:
    path = pathlib.Path(config_path).resolve()
    config = ExperimentConfig.load(path)
    root = repository_root(path)
    prompts = load_prompts(
        resolve_repo_path(root, config.prompt_file),
        calibration_label=config.calibration_label,
        heldout_label=config.heldout_label,
    )
    return config, root, prompts


def conservative_cost_estimate(config: ExperimentConfig, prompts: list[Prompt]) -> float:
    estimated_input_tokens = sum(
        max(1, (len(config.instructions) + len(prompt.text) + 3) // 4) for prompt in prompts
    )
    total = 0.0
    for model in (config.source_model, config.target_model):
        rates = config.price_usd_per_million_tokens[model]
        total += (
            config.replicates
            * (
                estimated_input_tokens * rates["input"]
                + len(prompts) * config.max_output_tokens * rates["output"]
            )
            / 1_000_000.0
        )
    estimated_embedding_tokens = config.replicates * (
        len(prompts) * 2 * max(1, config.max_output_tokens)
    )
    embedding_rate = config.price_usd_per_million_tokens[config.embedding_model]["input"]
    total += estimated_embedding_tokens * embedding_rate / 1_000_000.0
    return total


def protocol_summary(
    config_path: str | pathlib.Path,
) -> ProtocolSummary:
    config, root, prompts = load_protocol(config_path)
    prompt_path = resolve_repo_path(root, config.prompt_file)
    return ProtocolSummary(
        prompt_count=len(prompts),
        family_counts=dict(sorted(Counter(p.family for p in prompts).items())),
        split_counts=dict(sorted(Counter(p.split for p in prompts).items())),
        calls=len(prompts) * 2 * config.replicates,
        prompt_sha256=sha256_file(prompt_path),
        config_sha256=sha256_file(config_path),
        conservative_max_cost_usd=conservative_cost_estimate(config, prompts),
    )


def load_local_api_key(root: pathlib.Path) -> str:
    existing = os.environ.get("OPENAI_API_KEY", "").strip()
    if existing:
        return existing
    env_path = root / ".env.local"
    if not env_path.is_file():
        raise RuntimeError(
            "OPENAI_API_KEY is absent; set it in the environment or ignored .env.local"
        )
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() == "OPENAI_API_KEY":
            key = value.strip().strip("'\"")
            if key:
                return key
    raise RuntimeError("OPENAI_API_KEY is not defined in .env.local")


def read_response_records(path: str | pathlib.Path) -> list[ResponseRecord]:
    source = pathlib.Path(path)
    if not source.exists():
        return []
    records: list[ResponseRecord] = []
    with source.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = set(RESPONSE_FIELDS).difference(reader.fieldnames or ())
        if missing:
            raise ValueError(f"response CSV is missing: {', '.join(sorted(missing))}")
        for row in reader:
            records.append(
                ResponseRecord(
                    prompt_id=row["prompt_id"],
                    family=row["family"],
                    split=row["split"],
                    replicate=int(row["replicate"]),
                    requested_model=row["requested_model"],
                    resolved_model=row["resolved_model"],
                    response_id=row["response_id"],
                    response_status=row["response_status"],
                    incomplete_reason=row["incomplete_reason"],
                    response_text=row["response_text"],
                    input_tokens=int(row["input_tokens"]),
                    cached_input_tokens=int(row["cached_input_tokens"]),
                    output_tokens=int(row["output_tokens"]),
                    total_tokens=int(row["total_tokens"]),
                    created_at_utc=row["created_at_utc"],
                    latency_seconds=float(row["latency_seconds"]),
                    attempts=int(row["attempts"]),
                    error=row["error"],
                )
            )
    keys = [record.key for record in records]
    if len(set(keys)) != len(keys):
        raise ValueError("response CSV contains duplicate response keys")
    return records


def write_response_records(path: str | pathlib.Path, records: list[ResponseRecord]) -> None:
    destination = pathlib.Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=RESPONSE_FIELDS)
        writer.writeheader()
        for record in records:
            writer.writerow(dataclasses.asdict(record))
    temporary.replace(destination)


def read_embedding_index(path: str | pathlib.Path) -> list[EmbeddingRecord]:
    records: list[EmbeddingRecord] = []
    with pathlib.Path(path).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = set(EMBEDDING_INDEX_FIELDS).difference(reader.fieldnames or ())
        if missing:
            raise ValueError(f"embedding index is missing: {', '.join(sorted(missing))}")
        for row in reader:
            records.append(
                EmbeddingRecord(
                    row_index=int(row["row_index"]),
                    prompt_id=row["prompt_id"],
                    family=row["family"],
                    split=row["split"],
                    replicate=int(row["replicate"]),
                    requested_model=row["requested_model"],
                    resolved_model=row["resolved_model"],
                    response_id=row["response_id"],
                )
            )
    if [record.row_index for record in records] != list(range(len(records))):
        raise ValueError("embedding index rows must be contiguous and ordered")
    if len({record.key for record in records}) != len(records):
        raise ValueError("embedding index contains duplicate response keys")
    return records


def write_embedding_index(path: str | pathlib.Path, records: list[EmbeddingRecord]) -> None:
    destination = pathlib.Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=EMBEDDING_INDEX_FIELDS)
        writer.writeheader()
        for record in records:
            writer.writerow(dataclasses.asdict(record))
    temporary.replace(destination)


def write_json_atomic(path: str | pathlib.Path, payload: Any) -> None:
    destination = pathlib.Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(destination)
