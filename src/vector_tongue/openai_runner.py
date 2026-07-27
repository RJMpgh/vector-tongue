"""Resumable OpenAI response collection and fixed-encoder embedding."""

from __future__ import annotations

import concurrent.futures
import datetime as dt
import json
import pathlib
import re
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
    write_json_atomic,
    write_response_records,
)
from .io import write_jsonl


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
    message = message.replace(api_key, "[REDACTED_KEY]")
    return re.sub(r"\borg-[A-Za-z0-9]+\b", "[REDACTED_ORG]", message)


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
                collection_mode="synchronous",
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
        collection_mode="synchronous",
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


def _batch_state_path(root: pathlib.Path, config: ExperimentConfig) -> pathlib.Path:
    response_path = resolve_repo_path(root, config.responses_file)
    return response_path.parent / "batch_state.json"


def _batch_custom_id(
    prompt: Prompt,
    replicate: int,
    model: str,
    config: ExperimentConfig,
) -> str:
    side = "source" if model == config.source_model else "target"
    return f"{side}:{prompt.prompt_id}:r{replicate}"


def _batch_request(
    prompt: Prompt,
    replicate: int,
    model: str,
    config: ExperimentConfig,
) -> dict[str, Any]:
    return {
        "custom_id": _batch_custom_id(prompt, replicate, model, config),
        "method": "POST",
        "url": "/v1/responses",
        "body": {
            "model": model,
            "instructions": config.instructions,
            "input": prompt.text,
            "reasoning": {"effort": config.reasoning_effort},
            "max_output_tokens": config.max_output_tokens,
            "store": config.store_responses,
            "metadata": {
                "experiment_id": config.experiment_id,
                "prompt_id": prompt.prompt_id,
                "replicate": str(replicate),
            },
        },
    }


def submit_response_batches(
    config_path: str | pathlib.Path,
) -> dict[str, Any]:
    config, root, prompts = load_protocol(config_path)
    state_path = _batch_state_path(root, config)
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
        if state.get("experiment_id") != config.experiment_id:
            raise ValueError("batch state experiment ID does not match the configuration")
        if state.get("endpoint") != "/v1/responses":
            raise ValueError("batch state endpoint does not match the configuration")
        if not isinstance(state.get("batches"), dict):
            raise ValueError("batch state has no valid batches mapping")
    else:
        state = {
            "schema_version": "1.0.0",
            "experiment_id": config.experiment_id,
            "submitted_at_utc": _utc_now(),
            "endpoint": "/v1/responses",
            "completion_window": "24h",
            "batches": {},
        }

    api_key = load_local_api_key(root)
    OpenAI = _openai_class()
    client = OpenAI(
        api_key=api_key,
        timeout=config.request_timeout_seconds,
        max_retries=2,
    )
    response_path = resolve_repo_path(root, config.responses_file)
    existing = {record.key: record for record in read_response_records(response_path)}
    output_directory = response_path.parent
    output_directory.mkdir(parents=True, exist_ok=True)
    submitted_sides: list[str] = []

    for model in (config.source_model, config.target_model):
        side = "source" if model == config.source_model else "target"
        if side in state["batches"]:
            if state["batches"][side].get("model") != model:
                raise ValueError(f"existing {side} batch model differs from the protocol")
            continue
        requests = [
            _batch_request(prompt, replicate, model, config)
            for prompt in prompts
            for replicate in range(1, config.replicates + 1)
            if not existing.get((prompt.prompt_id, replicate, model))
            or not existing[(prompt.prompt_id, replicate, model)].succeeded
        ]
        if not requests:
            continue
        input_path = output_directory / f"batch_input_{side}.jsonl"
        write_jsonl(input_path, requests)
        with input_path.open("rb") as handle:
            input_file = client.files.create(file=handle, purpose="batch")
        batch = client.batches.create(
            input_file_id=input_file.id,
            endpoint="/v1/responses",
            completion_window="24h",
            metadata={
                "experiment_id": config.experiment_id,
                "model_side": side,
            },
        )
        state["batches"][side] = {
            "model": model,
            "request_count": len(requests),
            "input_path": str(input_path.relative_to(root)),
            "input_file_id": input_file.id,
            "batch_id": batch.id,
            "status": str(batch.status),
            "output_file_id": None,
            "error_file_id": None,
            "imported": False,
        }
        submitted_sides.append(side)
        write_json_atomic(state_path, state)
    if not state["batches"]:
        raise RuntimeError("no incomplete responses remain to submit")
    return {
        "state": str(state_path.relative_to(root)),
        "submitted_sides": submitted_sides,
        "batches": {
            side: {
                "model": details["model"],
                "request_count": details["request_count"],
                "batch_id": details["batch_id"],
                "status": details["status"],
            }
            for side, details in state["batches"].items()
        },
    }


def _batch_counts(batch: Any) -> dict[str, int]:
    counts = getattr(batch, "request_counts", None)
    return {
        "total": int(getattr(counts, "total", 0) or 0),
        "completed": int(getattr(counts, "completed", 0) or 0),
        "failed": int(getattr(counts, "failed", 0) or 0),
    }


def _batch_file_text(client: Any, file_id: str) -> str:
    response = client.files.content(file_id)
    value = response.text
    return value() if callable(value) else str(value)


def _text_from_response_body(body: dict[str, Any]) -> str:
    parts: list[str] = []
    for item in body.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                parts.append(str(content["text"]))
            elif content.get("type") == "refusal" and content.get("refusal"):
                parts.append(str(content["refusal"]))
    return "\n".join(parts).strip()


def _batch_response_record(
    *,
    custom_id: str,
    body: dict[str, Any] | None,
    error: Any,
    prompt_map: dict[str, tuple[Prompt, int, str]],
) -> ResponseRecord:
    if custom_id not in prompt_map:
        raise ValueError(f"unknown batch custom_id: {custom_id}")
    prompt, replicate, model = prompt_map[custom_id]
    if body is None:
        return ResponseRecord(
            prompt_id=prompt.prompt_id,
            family=prompt.family,
            split=prompt.split,
            replicate=replicate,
            requested_model=model,
            resolved_model="",
            response_id="",
            collection_mode="batch",
            response_status="failed",
            incomplete_reason="",
            response_text="",
            input_tokens=0,
            cached_input_tokens=0,
            output_tokens=0,
            total_tokens=0,
            created_at_utc=_utc_now(),
            latency_seconds=0.0,
            attempts=1,
            error=f"BatchError: {error}",
        )
    usage = body.get("usage") or {}
    input_details = usage.get("input_tokens_details") or {}
    incomplete_details = body.get("incomplete_details") or {}
    status = str(body.get("status") or "")
    text = _text_from_response_body(body)
    incomplete_reason = str(incomplete_details.get("reason") or "")
    error_message = ""
    if status and status != "completed":
        error_message = (
            f"BatchResponseStatus: {status}: {incomplete_reason or 'unspecified reason'}"
        )
    elif not text:
        error_message = "BatchResponseError: response contained no output text"
    created = body.get("created_at")
    created_at = (
        dt.datetime.fromtimestamp(float(created), tz=dt.timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
        if created
        else _utc_now()
    )
    return ResponseRecord(
        prompt_id=prompt.prompt_id,
        family=prompt.family,
        split=prompt.split,
        replicate=replicate,
        requested_model=model,
        resolved_model=str(body.get("model") or model),
        response_id=str(body.get("id") or ""),
        collection_mode="batch",
        response_status=status or ("completed" if text else "failed"),
        incomplete_reason=incomplete_reason,
        response_text=text if not error_message else "",
        input_tokens=int(usage.get("input_tokens") or 0),
        cached_input_tokens=int(input_details.get("cached_tokens") or 0),
        output_tokens=int(usage.get("output_tokens") or 0),
        total_tokens=int(usage.get("total_tokens") or 0),
        created_at_utc=created_at,
        latency_seconds=0.0,
        attempts=1,
        error=error_message,
    )


def sync_response_batches(
    config_path: str | pathlib.Path,
) -> dict[str, Any]:
    config, root, prompts = load_protocol(config_path)
    state_path = _batch_state_path(root, config)
    if not state_path.is_file():
        raise RuntimeError("no batch state exists; submit batches first")
    state = json.loads(state_path.read_text(encoding="utf-8"))
    if state.get("experiment_id") != config.experiment_id:
        raise ValueError("batch state experiment ID does not match the configuration")

    api_key = load_local_api_key(root)
    OpenAI = _openai_class()
    client = OpenAI(
        api_key=api_key,
        timeout=config.request_timeout_seconds,
        max_retries=2,
    )
    prompt_map = {
        _batch_custom_id(prompt, replicate, model, config): (
            prompt,
            replicate,
            model,
        )
        for prompt in prompts
        for replicate in range(1, config.replicates + 1)
        for model in (config.source_model, config.target_model)
    }
    response_path = resolve_repo_path(root, config.responses_file)
    existing = {record.key: record for record in read_response_records(response_path)}
    order = _record_order(prompts, config)
    statuses: dict[str, Any] = {}

    for side, details in state["batches"].items():
        batch = client.batches.retrieve(details["batch_id"])
        status = str(batch.status)
        details["status"] = status
        details["output_file_id"] = getattr(batch, "output_file_id", None)
        details["error_file_id"] = getattr(batch, "error_file_id", None)
        details["request_counts"] = _batch_counts(batch)
        statuses[side] = {
            "batch_id": details["batch_id"],
            "status": status,
            "request_counts": details["request_counts"],
        }
        if status == "completed" and not details.get("imported"):
            output_file_id = details.get("output_file_id")
            if output_file_id:
                output_text = _batch_file_text(client, output_file_id)
                output_path = response_path.parent / f"batch_output_{side}.jsonl"
                output_path.write_text(output_text, encoding="utf-8")
                for raw_line in output_text.splitlines():
                    if not raw_line.strip():
                        continue
                    line = json.loads(raw_line)
                    response_data = line.get("response") or {}
                    body = (
                        response_data.get("body")
                        if response_data.get("status_code") == 200
                        else None
                    )
                    record = _batch_response_record(
                        custom_id=line["custom_id"],
                        body=body,
                        error=line.get("error") or response_data,
                        prompt_map=prompt_map,
                    )
                    existing[record.key] = record
            error_file_id = details.get("error_file_id")
            if error_file_id:
                error_text = _batch_file_text(client, error_file_id)
                error_path = response_path.parent / f"batch_errors_{side}.jsonl"
                error_path.write_text(error_text, encoding="utf-8")
                for raw_line in error_text.splitlines():
                    if not raw_line.strip():
                        continue
                    line = json.loads(raw_line)
                    record = _batch_response_record(
                        custom_id=line["custom_id"],
                        body=None,
                        error=line.get("error"),
                        prompt_map=prompt_map,
                    )
                    existing[record.key] = record
            details["imported"] = True
            details["imported_at_utc"] = _utc_now()

    if existing:
        records = sorted(existing.values(), key=lambda record: order[record.key])
        write_response_records(response_path, records)
    write_json_atomic(state_path, state)
    expected = len(prompts) * config.replicates * 2
    successes = sum(record.succeeded for record in existing.values())
    failures = sum(not record.succeeded for record in existing.values())
    terminal = {"completed", "failed", "expired", "cancelled"}
    all_terminal = all(details["status"] in terminal for details in state["batches"].values())
    expected_sides = {"source", "target"}
    present_sides = set(state["batches"])
    return {
        "state": str(state_path.relative_to(root)),
        "batches": statuses,
        "responses": {
            "expected": expected,
            "successful": successes,
            "failed": failures,
        },
        "all_terminal": all_terminal and present_sides == expected_sides,
        "complete": (present_sides == expected_sides and successes == expected and failures == 0),
    }
