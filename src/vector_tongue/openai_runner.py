"""Resumable OpenAI response collection and fixed-encoder embedding."""

from __future__ import annotations

import concurrent.futures
import datetime as dt
import pathlib
import time
from collections.abc import Sequence
from typing import Any

import numpy as np

from .experiment import (
    EmbeddingRecord,
    ExperimentConfig,
    Prompt,
    ResponseRecord,
    load_local_api_key,
    load_protocol,
    read_response_records,
    resolve_repo_path,
    write_embedding_index,
    write_response_records,
)


def _openai_class() -> Any:
    try:
        from openai import OpenAI
    except ImportError as error:
        raise RuntimeError(
            "The OpenAI experiment dependency is missing. "
            "Install this project with the 'experiment' extra."
        ) from error
    return OpenAI


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _usage_value(usage: Any, name: str) -> int:
    return int(getattr(usage, name, 0) or 0)


def _cached_tokens(usage: Any) -> int:
    details = getattr(usage, "input_tokens_details", None)
    return int(getattr(details, "cached_tokens", 0) or 0)


def _redacted_error(error: Exception, api_key: str) -> str:
    message = f"{type(error).__name__}: {error}"
    return message.replace(api_key, "[REDACTED]")


def _collect_one(
    *,
    client: Any,
    config: ExperimentConfig,
    prompt: Prompt,
    model: str,
    replicate: int,
    api_key: str,
) -> ResponseRecord:
    started = time.monotonic()
    last_error = ""
    for attempt in range(1, config.max_retries + 1):
        try:
            response = client.responses.create(
                model=model,
                instructions=config.instructions,
                input=prompt.text,
                reasoning={"effort": config.reasoning_effort},
                max_output_tokens=config.max_output_tokens,
                store=config.store_responses,
                metadata={
                    "experiment_id": config.experiment_id,
                    "prompt_id": prompt.prompt_id,
                    "replicate": str(replicate),
                },
            )
            text = (response.output_text or "").strip()
            if not text:
                raise RuntimeError("API response contained no output text")
            response_status = str(getattr(response, "status", "") or "")
            incomplete_details = getattr(response, "incomplete_details", None)
            incomplete_reason = str(getattr(incomplete_details, "reason", "") or "")
            if response_status and response_status != "completed":
                raise RuntimeError(
                    f"API response status was {response_status}: "
                    f"{incomplete_reason or 'unspecified reason'}"
                )
            usage = response.usage
            return ResponseRecord(
                prompt_id=prompt.prompt_id,
                family=prompt.family,
                split=prompt.split,
                replicate=replicate,
                requested_model=model,
                resolved_model=str(getattr(response, "model", "") or model),
                response_id=str(getattr(response, "id", "") or ""),
                response_status=response_status or "completed",
                incomplete_reason=incomplete_reason,
                response_text=text,
                input_tokens=_usage_value(usage, "input_tokens"),
                cached_input_tokens=_cached_tokens(usage),
                output_tokens=_usage_value(usage, "output_tokens"),
                total_tokens=_usage_value(usage, "total_tokens"),
                created_at_utc=_utc_now(),
                latency_seconds=round(time.monotonic() - started, 6),
                attempts=attempt,
                error="",
            )
        except Exception as error:  # provider exceptions vary by SDK version
            last_error = _redacted_error(error, api_key)
            if attempt < config.max_retries:
                time.sleep(min(2 ** (attempt - 1), 20))
    return ResponseRecord(
        prompt_id=prompt.prompt_id,
        family=prompt.family,
        split=prompt.split,
        replicate=replicate,
        requested_model=model,
        resolved_model="",
        response_id="",
        response_status="failed",
        incomplete_reason="",
        response_text="",
        input_tokens=0,
        cached_input_tokens=0,
        output_tokens=0,
        total_tokens=0,
        created_at_utc=_utc_now(),
        latency_seconds=round(time.monotonic() - started, 6),
        attempts=config.max_retries,
        error=last_error,
    )


def _record_order(
    prompts: Sequence[Prompt], config: ExperimentConfig
) -> dict[tuple[str, int, str], int]:
    order: dict[tuple[str, int, str], int] = {}
    index = 0
    for prompt in prompts:
        for replicate in range(1, config.replicates + 1):
            for model in (config.source_model, config.target_model):
                order[(prompt.prompt_id, replicate, model)] = index
                index += 1
    return order


def collect_responses(
    config_path: str | pathlib.Path,
    *,
    limit: int | None = None,
) -> dict[str, Any]:
    config, root, prompts = load_protocol(config_path)
    if limit is not None:
        if limit < 1:
            raise ValueError("limit must be positive")
        selected_prompts = prompts[:limit]
    else:
        selected_prompts = prompts
    api_key = load_local_api_key(root)
    OpenAI = _openai_class()
    client = OpenAI(
        api_key=api_key,
        timeout=config.request_timeout_seconds,
        max_retries=0,
    )
    destination = resolve_repo_path(root, config.responses_file)
    existing = {record.key: record for record in read_response_records(destination)}
    prompt_by_id = {prompt.prompt_id: prompt for prompt in prompts}
    allowed_models = {config.source_model, config.target_model}
    for record in existing.values():
        prompt = prompt_by_id.get(record.prompt_id)
        if prompt is None or record.requested_model not in allowed_models:
            raise ValueError("existing responses do not match the frozen protocol")
        if (record.family, record.split) != (prompt.family, prompt.split):
            raise ValueError("existing response metadata differs from prompt registry")
        if not 1 <= record.replicate <= config.replicates:
            raise ValueError("existing response replicate is outside the protocol")

    tasks: list[tuple[Prompt, str, int]] = []
    for prompt in selected_prompts:
        for replicate in range(1, config.replicates + 1):
            for model in (config.source_model, config.target_model):
                key = (prompt.prompt_id, replicate, model)
                if not existing.get(key, None) or not existing[key].succeeded:
                    tasks.append((prompt, model, replicate))

    order = _record_order(prompts, config)

    def persist() -> None:
        records = sorted(existing.values(), key=lambda record: order[record.key])
        write_response_records(destination, records)

    if tasks:
        with concurrent.futures.ThreadPoolExecutor(max_workers=config.concurrency) as executor:
            futures = [
                executor.submit(
                    _collect_one,
                    client=client,
                    config=config,
                    prompt=prompt,
                    model=model,
                    replicate=replicate,
                    api_key=api_key,
                )
                for prompt, model, replicate in tasks
            ]
            for future in concurrent.futures.as_completed(futures):
                record = future.result()
                existing[record.key] = record
                persist()
    elif existing:
        persist()

    selected_keys = {
        (prompt.prompt_id, replicate, model)
        for prompt in selected_prompts
        for replicate in range(1, config.replicates + 1)
        for model in (config.source_model, config.target_model)
    }
    selected_records = [record for key, record in existing.items() if key in selected_keys]
    failures = [record for record in selected_records if not record.succeeded]
    return {
        "output": str(destination.relative_to(root)),
        "selected_prompts": len(selected_prompts),
        "expected_responses": len(selected_keys),
        "successful_responses": len(selected_records) - len(failures),
        "failed_responses": len(failures),
        "new_requests": len(tasks),
        "complete_protocol": len(selected_prompts) == len(prompts),
    }


def _embed_batch(
    *,
    client: Any,
    config: ExperimentConfig,
    texts: list[str],
    api_key: str,
) -> Any:
    last_error: Exception | None = None
    for attempt in range(1, config.max_retries + 1):
        try:
            return client.embeddings.create(
                model=config.embedding_model,
                input=texts,
                dimensions=config.embedding_dimensions,
                encoding_format="float",
            )
        except Exception as error:  # provider exceptions vary by SDK version
            last_error = error
            if attempt < config.max_retries:
                time.sleep(min(2 ** (attempt - 1), 20))
    assert last_error is not None
    raise RuntimeError(_redacted_error(last_error, api_key)) from last_error


def embed_responses(
    config_path: str | pathlib.Path,
    *,
    batch_size: int = 64,
) -> dict[str, Any]:
    if batch_size < 1:
        raise ValueError("batch_size must be positive")
    config, root, prompts = load_protocol(config_path)
    response_path = resolve_repo_path(root, config.responses_file)
    records = read_response_records(response_path)
    expected = len(prompts) * config.replicates * 2
    failures = [record for record in records if not record.succeeded]
    if len(records) != expected or failures:
        raise RuntimeError(
            f"response collection is incomplete: {len(records)}/{expected} rows, "
            f"{len(failures)} failures"
        )
    order = _record_order(prompts, config)
    records.sort(key=lambda record: order[record.key])

    api_key = load_local_api_key(root)
    OpenAI = _openai_class()
    client = OpenAI(
        api_key=api_key,
        timeout=config.request_timeout_seconds,
        max_retries=0,
    )
    vectors: list[list[float]] = []
    resolved_embedding_models: set[str] = set()
    total_embedding_tokens = 0
    for start in range(0, len(records), batch_size):
        batch = records[start : start + batch_size]
        response = _embed_batch(
            client=client,
            config=config,
            texts=[record.response_text for record in batch],
            api_key=api_key,
        )
        ordered = sorted(response.data, key=lambda item: item.index)
        if len(ordered) != len(batch):
            raise RuntimeError("embedding API returned an unexpected number of rows")
        vectors.extend(item.embedding for item in ordered)
        resolved_embedding_models.add(str(getattr(response, "model", "") or config.embedding_model))
        total_embedding_tokens += int(
            getattr(getattr(response, "usage", None), "total_tokens", 0) or 0
        )

    matrix = np.asarray(vectors, dtype=np.float64)
    if matrix.shape != (expected, config.embedding_dimensions):
        raise RuntimeError(
            f"unexpected embedding matrix shape {matrix.shape}; "
            f"expected {(expected, config.embedding_dimensions)}"
        )
    if not np.all(np.isfinite(matrix)):
        raise RuntimeError("embedding API returned a non-finite value")

    embedding_records = [
        EmbeddingRecord(
            row_index=index,
            prompt_id=record.prompt_id,
            family=record.family,
            split=record.split,
            replicate=record.replicate,
            requested_model=record.requested_model,
            resolved_model=record.resolved_model,
            response_id=record.response_id,
        )
        for index, record in enumerate(records)
    ]
    index_path = resolve_repo_path(root, config.embedding_index_file)
    write_embedding_index(index_path, embedding_records)

    destination = resolve_repo_path(root, config.embeddings_file)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.stem + ".tmp.npz")
    np.savez_compressed(
        temporary,
        embeddings=matrix,
        requested_embedding_model=np.asarray(config.embedding_model),
        resolved_embedding_models=np.asarray(sorted(resolved_embedding_models)),
        embedding_dimensions=np.asarray(config.embedding_dimensions, dtype=np.int64),
        embedding_total_tokens=np.asarray(total_embedding_tokens, dtype=np.int64),
    )
    temporary.replace(destination)
    return {
        "output": str(destination.relative_to(root)),
        "index": str(index_path.relative_to(root)),
        "rows": matrix.shape[0],
        "dimensions": matrix.shape[1],
        "requested_embedding_model": config.embedding_model,
        "resolved_embedding_models": sorted(resolved_embedding_models),
        "embedding_input_tokens": total_embedding_tokens,
    }
