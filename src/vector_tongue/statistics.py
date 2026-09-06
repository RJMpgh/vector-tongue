"""Statistical uncertainty estimation, bootstrap intervals, and permutation controls."""

import random
from typing import List, Tuple, Dict, Any, Callable
from .data import PairedDataset, PairedExample
from .evaluation import mean_squared_error
from .models import TranslationModel


def bootstrap_confidence_interval(
    values: List[float],
    num_bootstraps: int = 1000,
    confidence_level: float = 0.95,
    seed: int = 42,
) -> Tuple[float, float, float]:
    """Compute mean and bootstrap percentile confidence interval (mean, lower, upper)."""
    if not values:
        return 0.0, 0.0, 0.0
    n = len(values)
    mean_val = sum(values) / n
    if n == 1:
        return mean_val, mean_val, mean_val

    rng = random.Random(seed)
    boot_means = []
    for _ in range(num_bootstraps):
        sample = [values[rng.randint(0, n - 1)] for _ in range(n)]
        boot_means.append(sum(sample) / n)

    boot_means.sort()
    alpha = 1.0 - confidence_level
    lower_idx = max(0, int(round((alpha / 2.0) * (num_bootstraps - 1))))
    upper_idx = min(num_bootstraps - 1, int(round((1.0 - alpha / 2.0) * (num_bootstraps - 1))))

    return mean_val, boot_means[lower_idx], boot_means[upper_idx]


def permutation_control(
    train_data: PairedDataset,
    test_data: PairedDataset,
    model_factory: Callable[[], TranslationModel],
    num_permutations: int = 50,
    seed: int = 42,
) -> Dict[str, Any]:
    """Negative control: Shuffles source-target pairing during training to evaluate null distribution."""
    rng = random.Random(seed)
    null_mses = []

    train_sources = train_data.source_matrix
    train_targets = train_data.target_matrix
    test_sources = test_data.source_matrix
    test_targets = test_data.target_matrix

    for _ in range(num_permutations):
        shuffled_targets = list(train_targets)
        rng.shuffle(shuffled_targets)

        perm_model = model_factory()
        perm_model.fit(train_sources, shuffled_targets)
        perm_preds = perm_model.predict(test_sources)
        perm_mse = mean_squared_error(perm_preds, test_targets)
        null_mses.append(perm_mse)

    null_mses.sort()
    mean_null_mse = sum(null_mses) / len(null_mses)
    return {
        "num_permutations": num_permutations,
        "mean_null_mse": mean_null_mse,
        "min_null_mse": null_mses[0],
        "max_null_mse": null_mses[-1],
    }
