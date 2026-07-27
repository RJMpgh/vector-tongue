"""Empirical held-out analysis, permutation controls, and honest reporting."""

from __future__ import annotations

import dataclasses
import datetime as dt
import pathlib
import subprocess
from collections import Counter
from collections.abc import Callable
from typing import Any

import numpy as np
from numpy.typing import NDArray

from .data import EmbeddingPair, PairDataset
from .evaluation import row_cosine_distances, row_squared_errors, safe_gain
from .experiment import (
    ExperimentConfig,
    Prompt,
    ResponseRecord,
    load_protocol,
    read_embedding_index,
    read_response_records,
    resolve_repo_path,
    sha256_file,
    write_json_atomic,
)
from .models import (
    IdentityTranslator,
    MeanShiftTranslator,
    OrthogonalTranslator,
    RidgeTranslator,
    TargetMeanTranslator,
    TranslationModel,
)
from .statistics import percentile_bootstrap

FloatArray = NDArray[np.float64]
FloatMatrix = NDArray[np.float64]


@dataclasses.dataclass(frozen=True)
class PairedGainInterval:
    estimate: float | None
    lower: float | None
    upper: float | None
    confidence: float
    resamples: int


@dataclasses.dataclass(frozen=True)
class PermutationControl:
    observed_mse: float
    null_mean_mse: float
    null_lower_mse: float
    null_upper_mse: float
    p_value_lower_tail: float
    permutations: int
    interpretation: str


@dataclasses.dataclass(frozen=True)
class PreparedData:
    all_pairs: PairDataset
    calibration: PairDataset
    heldout: PairDataset


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def paired_bootstrap_gain(
    model_errors: FloatArray,
    baseline_errors: FloatArray,
    *,
    confidence: float,
    resamples: int,
    seed: int,
) -> PairedGainInterval:
    model = np.asarray(model_errors, dtype=np.float64)
    baseline = np.asarray(baseline_errors, dtype=np.float64)
    if model.ndim != 1 or baseline.ndim != 1 or model.shape != baseline.shape:
        raise ValueError("paired error arrays must be equal-length vectors")
    if model.size < 2:
        raise ValueError("at least two paired errors are required")
    estimate = safe_gain(float(np.mean(model)), float(np.mean(baseline)))
    if estimate is None:
        return PairedGainInterval(None, None, None, confidence, resamples)
    rng = np.random.default_rng(seed)
    draws: list[float] = []
    for _ in range(resamples):
        indices = rng.integers(0, model.size, size=model.size)
        gain = safe_gain(
            float(np.mean(model[indices])),
            float(np.mean(baseline[indices])),
        )
        if gain is not None:
            draws.append(gain)
    if not draws:
        return PairedGainInterval(estimate, None, None, confidence, resamples)
    alpha = (1.0 - confidence) / 2.0
    return PairedGainInterval(
        estimate=estimate,
        lower=float(np.quantile(draws, alpha)),
        upper=float(np.quantile(draws, 1.0 - alpha)),
        confidence=confidence,
        resamples=resamples,
    )


def ridge_permutation_control(
    train: PairDataset,
    test: PairDataset,
    *,
    regularization: float,
    confidence: float,
    permutations: int,
    seed: int,
) -> PermutationControl:
    if regularization <= 0.0:
        raise ValueError("permutation control requires positive regularization")
    x_mean = train.source.mean(axis=0)
    y_mean = train.target.mean(axis=0)
    centered_x = train.source - x_mean
    centered_y = train.target - y_mean
    gram = centered_x @ centered_x.T
    system = gram + regularization * np.eye(train.size, dtype=np.float64)
    cross_kernel = (test.source - x_mean) @ centered_x.T
    projection = np.linalg.solve(system, cross_kernel.T).T
    observed_prediction = projection @ centered_y + y_mean
    observed = float(np.mean(row_squared_errors(observed_prediction, test.target)))

    rng = np.random.default_rng(seed)
    null = np.empty(permutations, dtype=np.float64)
    for index in range(permutations):
        shuffled_target = centered_y[rng.permutation(train.size)]
        predicted = projection @ shuffled_target + y_mean
        null[index] = float(np.mean(row_squared_errors(predicted, test.target)))
    alpha = (1.0 - confidence) / 2.0
    p_value = (1.0 + float(np.count_nonzero(null <= observed))) / (permutations + 1.0)
    return PermutationControl(
        observed_mse=observed,
        null_mean_mse=float(np.mean(null)),
        null_lower_mse=float(np.quantile(null, alpha)),
        null_upper_mse=float(np.quantile(null, 1.0 - alpha)),
        p_value_lower_tail=p_value,
        permutations=permutations,
        interpretation=(
            "Lower-tail p-value: the fraction of shuffled calibration fits "
            "with held-out MSE no greater than the correctly paired fit."
        ),
    )


def _prepare_data(
    config: ExperimentConfig,
    prompts: list[Prompt],
    matrix: FloatMatrix,
    index_records: list[Any],
) -> PreparedData:
    by_key = {record.key: record for record in index_records}
    pairs: list[EmbeddingPair] = []
    splits: list[str] = []
    for prompt in prompts:
        for replicate in range(1, config.replicates + 1):
            source_key = (prompt.prompt_id, replicate, config.source_model)
            target_key = (prompt.prompt_id, replicate, config.target_model)
            if source_key not in by_key or target_key not in by_key:
                raise ValueError(f"missing embedding pair for {prompt.prompt_id}")
            source_record = by_key[source_key]
            target_record = by_key[target_key]
            pair_id = f"{prompt.prompt_id}#r{replicate}"
            pairs.append(
                EmbeddingPair.create(
                    pair_id,
                    matrix[source_record.row_index],
                    matrix[target_record.row_index],
                    category=prompt.family,
                )
            )
            splits.append(prompt.split)
    dataset = PairDataset.from_pairs(pairs)
    calibration_indices = [
        index for index, split in enumerate(splits) if split == config.calibration_label
    ]
    heldout_indices = [index for index, split in enumerate(splits) if split == config.heldout_label]
    return PreparedData(
        all_pairs=dataset,
        calibration=dataset.subset(calibration_indices),
        heldout=dataset.subset(heldout_indices),
    )


def _model_factories(
    regularization: float,
) -> list[tuple[str, Callable[[], TranslationModel]]]:
    return [
        ("identity", IdentityTranslator),
        ("target_mean", TargetMeanTranslator),
        ("mean_shift", MeanShiftTranslator),
        (
            "ridge_affine",
            lambda: RidgeTranslator(regularization=regularization),
        ),
        ("orthogonal_procrustes", OrthogonalTranslator),
    ]


def _interval_dict(
    values: FloatArray,
    *,
    confidence: float,
    resamples: int,
    seed: int,
) -> dict[str, float | int]:
    interval = percentile_bootstrap(
        values,
        confidence=confidence,
        resamples=resamples,
        seed=seed,
    )
    return dataclasses.asdict(interval)


def _evaluate_scope(
    train: PairDataset,
    test: PairDataset,
    *,
    config: ExperimentConfig,
    seed: int,
) -> dict[str, Any]:
    results: dict[str, Any] = {}
    errors: dict[str, FloatArray] = {}
    for offset, (name, factory) in enumerate(_model_factories(config.ridge_regularization)):
        model = factory()
        model.fit(train.source, train.target)
        prediction = model.predict(test.source)
        squared = row_squared_errors(prediction, test.target)
        cosine = row_cosine_distances(prediction, test.target)
        errors[name] = squared
        results[name] = {
            "mse": _interval_dict(
                squared,
                confidence=config.confidence,
                resamples=config.bootstrap_resamples,
                seed=seed + offset * 10,
            ),
            "cosine_distance": _interval_dict(
                cosine,
                confidence=config.confidence,
                resamples=config.bootstrap_resamples,
                seed=seed + offset * 10 + 1,
            ),
            "prompt_errors": [
                {
                    "prompt_id": prompt_id,
                    "family": family,
                    "squared_error": float(mse),
                    "cosine_distance": float(cosine_error),
                }
                for prompt_id, family, mse, cosine_error in zip(
                    test.prompt_ids,
                    test.categories,
                    squared,
                    cosine,
                    strict=True,
                )
            ],
        }

    gains: dict[str, dict[str, Any]] = {}
    baselines = ("identity", "target_mean", "mean_shift")
    for model_offset, model_name in enumerate(("ridge_affine", "orthogonal_procrustes")):
        gains[model_name] = {}
        for baseline_offset, baseline_name in enumerate(baselines):
            interval = paired_bootstrap_gain(
                errors[model_name],
                errors[baseline_name],
                confidence=config.confidence,
                resamples=config.bootstrap_resamples,
                seed=seed + 100 + model_offset * 20 + baseline_offset,
            )
            gains[model_name][baseline_name] = dataclasses.asdict(interval)

    permutation = ridge_permutation_control(
        train,
        test,
        regularization=config.ridge_regularization,
        confidence=config.confidence,
        permutations=config.permutation_resamples,
        seed=seed + 200,
    )
    return {
        "calibration_pairs": train.size,
        "heldout_pairs": test.size,
        "models": results,
        "gain_vs_baseline": gains,
        "ridge_calibration_pair_permutation": dataclasses.asdict(permutation),
    }


def _subset_family(dataset: PairDataset, family: str) -> PairDataset:
    indices = [index for index, category in enumerate(dataset.categories) if category == family]
    if not indices:
        raise ValueError(f"dataset has no rows for family {family}")
    return dataset.subset(indices)


def _actual_cost(
    config: ExperimentConfig,
    responses: list[ResponseRecord],
    embedding_tokens: int,
) -> dict[str, Any]:
    by_model: dict[str, dict[str, float | int]] = {}
    total_cost = 0.0
    for model in (config.source_model, config.target_model):
        model_rows = [row for row in responses if row.requested_model == model]
        input_tokens = sum(row.input_tokens for row in model_rows)
        cached_tokens = sum(row.cached_input_tokens for row in model_rows)
        output_tokens = sum(row.output_tokens for row in model_rows)
        rates = config.price_usd_per_million_tokens[model]
        cost = 0.0
        for row in model_rows:
            multiplier = 0.5 if row.collection_mode == "batch" else 1.0
            cost += (
                (
                    max(0, row.input_tokens - row.cached_input_tokens) * rates["input"]
                    + row.cached_input_tokens * rates.get("cached_input", rates["input"])
                    + row.output_tokens * rates["output"]
                )
                * multiplier
                / 1_000_000.0
            )
        total_cost += cost
        by_model[model] = {
            "requests": len(model_rows),
            "collection_modes": dict(
                sorted(Counter(row.collection_mode for row in model_rows).items())
            ),
            "input_tokens": input_tokens,
            "cached_input_tokens": cached_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": round(cost, 6),
        }
    embedding_rate = config.price_usd_per_million_tokens[config.embedding_model]["input"]
    embedding_cost = embedding_tokens * embedding_rate / 1_000_000.0
    total_cost += embedding_cost
    return {
        "pricing_source": config.pricing_source,
        "pricing_checked_utc": config.pricing_checked_utc,
        "generation": by_model,
        "embedding": {
            "model": config.embedding_model,
            "input_tokens": embedding_tokens,
            "estimated_cost_usd": round(embedding_cost, 6),
        },
        "estimated_total_cost_usd": round(total_cost, 6),
        "note": (
            "Estimate from recorded token usage and the frozen pricing table; "
            "Batch generation rows receive the documented 50% discount."
        ),
    }


def _criterion(criterion: str, passed: bool, evidence: str) -> dict[str, str | bool]:
    return {"criterion": criterion, "passed": bool(passed), "evidence": evidence}


def _fmt(value: float | None, digits: int = 6) -> str:
    return "NA" if value is None else f"{value:.{digits}f}"


def _gain_cell(gain: dict[str, Any]) -> str:
    return f"{_fmt(gain['estimate'], 3)} [{_fmt(gain['lower'], 3)}, {_fmt(gain['upper'], 3)}]"


def _render_results(analysis: dict[str, Any], *, manifest_path: str) -> str:
    overall = analysis["overall"]
    ridge_gains = overall["gain_vs_baseline"]["ridge_affine"]
    permutation = overall["ridge_calibration_pair_permutation"]
    decision = analysis["decision"]
    status = (
        "The preregistered pilot criterion was met."
        if decision["all_criteria_passed"]
        else "The preregistered pilot criterion was not met."
    )
    lines = [
        "# Real-Model Results",
        "",
        f"**Outcome: {status}**",
        "",
        (
            "This is a real, held-out model-to-model pilot. It is not proof of a "
            "universal translation law, private model language, or commercial utility."
        ),
        "",
        "## Frozen design",
        "",
        f"- Experiment: `{analysis['experiment_id']}`",
        (
            "- Collection: "
            + ", ".join(
                f"`{mode}` × {count}" for mode, count in analysis["collection"]["modes"].items()
            )
        ),
        f"- Source: `{analysis['models']['source_requested']}`",
        f"- Target: `{analysis['models']['target_requested']}`",
        (
            f"- Encoder: `{analysis['encoder']['requested_model']}` "
            f"({analysis['encoder']['dimensions']} dimensions)"
        ),
        (
            f"- Prompts: {analysis['dataset']['prompts']} across "
            f"{analysis['dataset']['families']} families; "
            f"{overall['calibration_pairs']} calibration and "
            f"{overall['heldout_pairs']} held out"
        ),
        (
            f"- Primary translator: affine ridge "
            f"(regularization {analysis['settings']['ridge_regularization']})"
        ),
        (
            f"- Uncertainty: {analysis['settings']['confidence']:.0%} paired "
            f"bootstrap intervals with "
            f"{analysis['settings']['bootstrap_resamples']} resamples"
        ),
        "",
        "## Overall held-out performance",
        "",
        "| Method | MSE (95% interval) | Mean cosine distance (95% interval) |",
        "|---|---:|---:|",
    ]
    for model_name in (
        "identity",
        "target_mean",
        "mean_shift",
        "ridge_affine",
        "orthogonal_procrustes",
    ):
        result = overall["models"][model_name]
        mse = result["mse"]
        cosine = result["cosine_distance"]
        lines.append(
            f"| `{model_name}` | {_fmt(mse['estimate'])} "
            f"[{_fmt(mse['lower'])}, {_fmt(mse['upper'])}] | "
            f"{_fmt(cosine['estimate'])} "
            f"[{_fmt(cosine['lower'])}, {_fmt(cosine['upper'])}] |"
        )
    lines.extend(
        [
            "",
            "## Primary ridge advantage",
            "",
            (
                r"\(G(f;g)=1-\mathrm{MSE}(f)/\mathrm{MSE}(g)\). "
                "Positive values favor the learned translator."
            ),
            "",
            "| Baseline | Gain (95% paired-bootstrap interval) |",
            "|---|---:|",
        ]
    )
    for baseline in ("identity", "target_mean", "mean_shift"):
        lines.append(f"| `{baseline}` | {_gain_cell(ridge_gains[baseline])} |")
    lines.extend(
        [
            "",
            "## Calibration-pair permutation control",
            "",
            (
                f"The correctly paired ridge fit had MSE "
                f"**{_fmt(permutation['observed_mse'])}**. Across "
                f"{permutation['permutations']} refits with shuffled calibration "
                f"targets, mean MSE was **{_fmt(permutation['null_mean_mse'])}** "
                f"and the lower-tail p-value was "
                f"**{permutation['p_value_lower_tail']:.4f}**."
            ),
            "",
            "## Prompt-family results",
            "",
            "| Family | Ridge MSE | Gain vs identity | Gain vs mean shift | Permutation p |",
            "|---|---:|---:|---:|---:|",
        ]
    )
    for family, result in analysis["families"].items():
        model = result["models"]["ridge_affine"]["mse"]
        gains = result["gain_vs_baseline"]["ridge_affine"]
        family_permutation = result["ridge_calibration_pair_permutation"]
        lines.append(
            f"| {family} | {_fmt(model['estimate'])} | "
            f"{_gain_cell(gains['identity'])} | "
            f"{_gain_cell(gains['mean_shift'])} | "
            f"{family_permutation['p_value_lower_tail']:.4f} |"
        )
    lines.extend(
        [
            "",
            "## Preregistered decision",
            "",
            "| Criterion | Pass | Evidence |",
            "|---|:---:|---|",
        ]
    )
    for item in decision["criteria"]:
        lines.append(
            f"| {item['criterion']} | {'Yes' if item['passed'] else 'No'} | {item['evidence']} |"
        )
    lines.extend(
        [
            "",
            "## Cost and run integrity",
            "",
            (
                f"Recorded API usage implies an estimated total cost of "
                f"**${analysis['cost']['estimated_total_cost_usd']:.4f}** under "
                "the pricing table frozen in the configuration."
            ),
            "",
            (
                "Exact artifact hashes and the code commit are recorded in "
                f"[`{manifest_path}`]({manifest_path})."
            ),
            "",
            "## Limitations",
            "",
            "- This pilot compares two snapshots from one provider and one model family.",
            "- It uses one generation per prompt, so generation variance is not estimated.",
            "- All geometry depends on one external encoder and its 256-dimensional projection.",
            "- Family-level held-out samples are small and are exploratory.",
            "- Provider infrastructure and nondeterminism prevent bit-for-bit response replay.",
            "- A positive result would establish only predictive advantage in this frozen design.",
            "",
            "Null and negative outcomes are retained exactly as generated.",
        ]
    )
    return "\n".join(lines) + "\n"


def _git_commit(root: pathlib.Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def analyze_experiment(config_path: str | pathlib.Path) -> dict[str, Any]:
    config, root, prompts = load_protocol(config_path)
    response_path = resolve_repo_path(root, config.responses_file)
    embedding_path = resolve_repo_path(root, config.embeddings_file)
    index_path = resolve_repo_path(root, config.embedding_index_file)
    responses = read_response_records(response_path)
    expected_responses = len(prompts) * config.replicates * 2
    if len(responses) != expected_responses or any(
        not response.succeeded for response in responses
    ):
        raise RuntimeError("a complete, failure-free response artifact is required")

    index_records = read_embedding_index(index_path)
    with np.load(embedding_path, allow_pickle=False) as archive:
        matrix = np.asarray(archive["embeddings"], dtype=np.float64)
        requested_embedding_model = str(archive["requested_embedding_model"])
        resolved_embedding_models = [
            str(value) for value in archive["resolved_embedding_models"].tolist()
        ]
        embedding_dimensions = int(archive["embedding_dimensions"])
        embedding_tokens = int(archive["embedding_total_tokens"])
    if matrix.shape != (expected_responses, config.embedding_dimensions):
        raise RuntimeError("embedding artifact shape does not match the protocol")
    if len(index_records) != expected_responses:
        raise RuntimeError("embedding index length does not match the protocol")

    prepared = _prepare_data(config, prompts, matrix, index_records)
    overall = _evaluate_scope(
        prepared.calibration,
        prepared.heldout,
        config=config,
        seed=config.seed,
    )
    families: dict[str, Any] = {}
    family_names = sorted(set(prepared.all_pairs.categories))
    for offset, family in enumerate(family_names, start=1):
        families[family] = _evaluate_scope(
            _subset_family(prepared.calibration, family),
            _subset_family(prepared.heldout, family),
            config=config,
            seed=config.seed + offset * 1_000,
        )

    ridge_gains = overall["gain_vs_baseline"]["ridge_affine"]
    identity_gain = ridge_gains["identity"]
    mean_shift_gain = ridge_gains["mean_shift"]
    permutation = overall["ridge_calibration_pair_permutation"]
    replicated_families = [
        family
        for family, result in families.items()
        if (
            (result["gain_vs_baseline"]["ridge_affine"]["identity"]["estimate"] or 0.0) > 0.0
            and (result["gain_vs_baseline"]["ridge_affine"]["mean_shift"]["estimate"] or 0.0) > 0.0
            and result["ridge_calibration_pair_permutation"]["observed_mse"]
            < result["ridge_calibration_pair_permutation"]["null_mean_mse"]
        )
    ]
    criteria = [
        _criterion(
            "Ridge gain vs identity has a 95% interval above zero",
            identity_gain["lower"] is not None and identity_gain["lower"] > 0.0,
            _gain_cell(identity_gain),
        ),
        _criterion(
            "Ridge gain vs mean shift has a 95% interval above zero",
            mean_shift_gain["lower"] is not None and mean_shift_gain["lower"] > 0.0,
            _gain_cell(mean_shift_gain),
        ),
        _criterion(
            "Correct pairings beat the permutation null at p < 0.05",
            permutation["p_value_lower_tail"] < 0.05
            and permutation["observed_mse"] < permutation["null_mean_mse"],
            (
                f"observed={_fmt(permutation['observed_mse'])}; "
                f"null mean={_fmt(permutation['null_mean_mse'])}; "
                f"p={permutation['p_value_lower_tail']:.4f}"
            ),
        ),
        _criterion(
            "Point-estimate replication in at least two prompt families",
            len(replicated_families) >= 2,
            ", ".join(replicated_families) if replicated_families else "none",
        ),
    ]
    resolved_source = sorted(
        {
            response.resolved_model
            for response in responses
            if response.requested_model == config.source_model
        }
    )
    resolved_target = sorted(
        {
            response.resolved_model
            for response in responses
            if response.requested_model == config.target_model
        }
    )
    analysis: dict[str, Any] = {
        "schema_version": "1.0.0",
        "generated_at_utc": _utc_now(),
        "experiment_id": config.experiment_id,
        "research_status": "empirical_pilot",
        "models": {
            "source_requested": config.source_model,
            "source_resolved": resolved_source,
            "target_requested": config.target_model,
            "target_resolved": resolved_target,
        },
        "encoder": {
            "requested_model": requested_embedding_model,
            "resolved_models": resolved_embedding_models,
            "dimensions": embedding_dimensions,
        },
        "settings": {
            "reasoning_effort": config.reasoning_effort,
            "max_output_tokens": config.max_output_tokens,
            "replicates": config.replicates,
            "ridge_regularization": config.ridge_regularization,
            "confidence": config.confidence,
            "bootstrap_resamples": config.bootstrap_resamples,
            "permutation_resamples": config.permutation_resamples,
            "seed": config.seed,
        },
        "dataset": {
            "prompts": len(prompts),
            "families": len(family_names),
            "family_counts": dict(sorted(Counter(p.family for p in prompts).items())),
            "calibration_prompts": sum(
                prompt.split == config.calibration_label for prompt in prompts
            ),
            "heldout_prompts": sum(prompt.split == config.heldout_label for prompt in prompts),
        },
        "overall": overall,
        "families": families,
        "decision": {
            "all_criteria_passed": all(item["passed"] for item in criteria),
            "criteria": criteria,
            "scope": (
                "A pass supports predictive advantage only for this frozen pilot; "
                "a failure leaves the primary claim unsupported."
            ),
        },
        "collection": {
            "responses": len(responses),
            "failures": 0,
            "modes": dict(
                sorted(Counter(response.collection_mode for response in responses).items())
            ),
            "total_attempts": sum(response.attempts for response in responses),
            "retried_responses": sum(response.attempts > 1 for response in responses),
            "mean_synchronous_latency_seconds": (
                float(
                    np.mean(
                        [
                            response.latency_seconds
                            for response in responses
                            if response.collection_mode == "synchronous"
                        ]
                    )
                )
                if any(response.collection_mode == "synchronous" for response in responses)
                else None
            ),
        },
        "cost": _actual_cost(config, responses, embedding_tokens),
        "limitations": [
            "two model snapshots from one provider and one family",
            "one response replicate per prompt",
            "one external embedding model and dimensional projection",
            "small exploratory per-family held-out samples",
            "no independent replication",
        ],
    }
    analysis_path = resolve_repo_path(root, config.analysis_file)
    write_json_atomic(analysis_path, analysis)

    results_path = resolve_repo_path(root, config.results_markdown_file)
    results_path.write_text(
        _render_results(analysis, manifest_path=config.manifest_file),
        encoding="utf-8",
    )

    manifest_path = resolve_repo_path(root, config.manifest_file)
    artifact_paths = {
        "config": pathlib.Path(config_path).resolve(),
        "prompts": resolve_repo_path(root, config.prompt_file),
        "responses": response_path,
        "embedding_index": index_path,
        "embeddings": embedding_path,
        "analysis": analysis_path,
        "results_markdown": results_path,
    }
    batch_artifacts = sorted(response_path.parent.glob("batch_*.jsonl"))
    batch_state = response_path.parent / "batch_state.json"
    if batch_state.is_file():
        batch_artifacts.append(batch_state)
    for path in batch_artifacts:
        artifact_paths[path.stem] = path
    manifest = {
        "schema_version": "1.0.0",
        "experiment_id": config.experiment_id,
        "generated_at_utc": _utc_now(),
        "code_commit": _git_commit(root),
        "hash_algorithm": "sha256",
        "artifacts": {
            name: {
                "path": str(path.relative_to(root)),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
            for name, path in artifact_paths.items()
        },
    }
    write_json_atomic(manifest_path, manifest)
    return {
        "analysis": str(analysis_path.relative_to(root)),
        "results": str(results_path.relative_to(root)),
        "manifest": str(manifest_path.relative_to(root)),
        "all_criteria_passed": analysis["decision"]["all_criteria_passed"],
        "estimated_total_cost_usd": analysis["cost"]["estimated_total_cost_usd"],
    }
