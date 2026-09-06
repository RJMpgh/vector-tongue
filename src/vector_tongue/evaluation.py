"""Held-out evaluation metrics, baseline advantages, and experiment runners."""

import math
from typing import List, Dict, Any, Optional
from .data import PairedDataset
from .geometry import cosine_distance
from .models import (
    TranslationModel,
    IdentityBaseline,
    TargetMeanBaseline,
    MeanShiftBaseline,
)


def per_dimension_mse(predicted: List[float], target: List[float]) -> float:
    """Per-dimension mean squared error for a single vector pair."""
    d = len(target)
    if d == 0:
        return 0.0
    return sum((p - t) ** 2 for p, t in zip(predicted, target)) / d


def mean_squared_error(predictions: List[List[float]], targets: List[List[float]]) -> float:
    """Mean per-dimension squared error across a set of vector pairs."""
    if not predictions:
        return 0.0
    return sum(per_dimension_mse(p, t) for p, t in zip(predictions, targets)) / len(predictions)


def mean_cosine_distance(predictions: List[List[float]], targets: List[List[float]]) -> float:
    """Mean cosine distance across a set of vector pairs."""
    if not predictions:
        return 0.0
    return sum(cosine_distance(p, t) for p, t in zip(predictions, targets)) / len(predictions)


def compute_advantage(candidate_mse: float, baseline_mse: float) -> float:
    """Compute relative MSE advantage G(f; g) = 1 - MSE(f) / MSE(g)."""
    if baseline_mse <= 1e-12:
        return 0.0 if candidate_mse <= 1e-12 else -float("inf")
    return 1.0 - (candidate_mse / baseline_mse)


def evaluate_experiment(
    train_data: PairedDataset,
    test_data: PairedDataset,
    candidate_model: TranslationModel,
    candidate_name: str = "candidate_model",
) -> Dict[str, Any]:
    """Train candidate and standard baselines on train_data and evaluate on test_data."""
    # Baseline models
    baselines: Dict[str, TranslationModel] = {
        "identity": IdentityBaseline(),
        "target_mean": TargetMeanBaseline(),
        "mean_shift": MeanShiftBaseline(),
    }

    train_sources = train_data.source_matrix
    train_targets = train_data.target_matrix
    test_sources = test_data.source_matrix
    test_targets = test_data.target_matrix

    # Fit baselines
    for b_model in baselines.values():
        b_model.fit(train_sources, train_targets)

    # Fit candidate
    candidate_model.fit(train_sources, train_targets)

    # Evaluate baselines on held-out test
    baseline_results = {}
    for name, b_model in baselines.items():
        preds = b_model.predict(test_sources)
        mse = mean_squared_error(preds, test_targets)
        cos_d = mean_cosine_distance(preds, test_targets)
        baseline_results[name] = {
            "held_out_mse": mse,
            "held_out_cosine_distance": cos_d,
        }

    # Evaluate candidate
    cand_preds = candidate_model.predict(test_sources)
    cand_mse = mean_squared_error(cand_preds, test_targets)
    cand_cos_d = mean_cosine_distance(cand_preds, test_targets)

    # Compute advantages over baselines
    advantages = {
        f"advantage_over_{name}": compute_advantage(cand_mse, res["held_out_mse"])
        for name, res in baseline_results.items()
    }

    # Per-category error breakdown
    categories = sorted(list(set(test_data.categories)))
    category_breakdown = {}
    for cat in categories:
        cat_indices = [i for i, ex in enumerate(test_data) if ex.category == cat]
        if cat_indices:
            cat_cand_preds = [cand_preds[i] for i in cat_indices]
            cat_targets = [test_targets[i] for i in cat_indices]
            cat_mse = mean_squared_error(cat_cand_preds, cat_targets)
            cat_cos_d = mean_cosine_distance(cat_cand_preds, cat_targets)
            category_breakdown[cat] = {
                "count": len(cat_indices),
                "held_out_mse": cat_mse,
                "held_out_cosine_distance": cat_cos_d,
            }

    # Individual prompt paired error list for downstream bootstrapping
    prompt_errors = [
        {
            "prompt_id": ex.prompt_id,
            "category": ex.category,
            "per_dimension_mse": per_dimension_mse(cand_preds[i], test_targets[i]),
            "cosine_distance": cosine_distance(cand_preds[i], test_targets[i]),
        }
        for i, ex in enumerate(test_data)
    ]

    return {
        "candidate": {
            "name": candidate_name,
            "held_out_mse": cand_mse,
            "held_out_cosine_distance": cand_cos_d,
            **advantages,
        },
        "baselines": baseline_results,
        "sample_counts": {
            "calibration_samples": len(train_data),
            "held_out_test_samples": len(test_data),
        },
        "category_breakdown": category_breakdown,
        "prompt_errors": prompt_errors,
    }
