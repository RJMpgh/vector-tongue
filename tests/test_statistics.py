import unittest

import numpy as np

from vector_tongue.statistics import (
    paired_target_permutation_test,
    percentile_bootstrap,
)


class StatisticsTests(unittest.TestCase):
    def test_bootstrap_is_reproducible(self):
        first = percentile_bootstrap([1.0, 2.0, 3.0, 4.0], resamples=200, seed=4)
        second = percentile_bootstrap([1.0, 2.0, 3.0, 4.0], resamples=200, seed=4)
        self.assertEqual(first, second)
        self.assertEqual(first.estimate, 2.5)

    def test_bootstrap_requires_two_values(self):
        with self.assertRaisesRegex(ValueError, "at least two"):
            percentile_bootstrap([1.0])

    def test_permutation_detects_matched_pairs(self):
        rng = np.random.default_rng(3)
        source = rng.normal(size=(30, 4))
        target = source + 0.01 * rng.normal(size=(30, 4))

        def score(x, y):
            return float(np.mean(np.square(x - y)))

        result = paired_target_permutation_test(
            source,
            target,
            score=score,
            permutations=300,
            seed=2,
        )
        self.assertLess(result.p_value, 0.02)
        self.assertLess(result.observed, result.null_mean)


if __name__ == "__main__":
    unittest.main()
