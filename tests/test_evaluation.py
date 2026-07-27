import unittest

import numpy as np

from vector_tongue.demo import synthetic_translation_dataset
from vector_tongue.evaluation import (
    cross_validated_errors,
    evaluate_translator,
    row_cosine_distances,
    safe_gain,
)
from vector_tongue.models import RidgeTranslator


class EvaluationTests(unittest.TestCase):
    def test_synthetic_map_beats_identity(self):
        dataset = synthetic_translation_dataset(samples=100, noise=0.01, seed=3)
        train, test = dataset.split(seed=9)
        report = evaluate_translator(
            RidgeTranslator(regularization=0.05), train, test, seed=9
        )
        self.assertGreater(report.gain_vs_baseline["identity"], 0.8)
        self.assertGreater(report.gain_vs_baseline["mean_shift"], 0.8)

    def test_report_contains_heldout_ids(self):
        dataset = synthetic_translation_dataset(samples=20)
        train, test = dataset.split(seed=2)
        report = evaluate_translator(RidgeTranslator(), train, test)
        self.assertEqual(report.prompt_ids, test.prompt_ids)
        self.assertEqual(report.test_size, test.size)

    def test_cosine_rows(self):
        distances = row_cosine_distances(
            [[1.0, 0.0], [0.0, 1.0]],
            [[1.0, 0.0], [1.0, 0.0]],
        )
        np.testing.assert_allclose(distances, [0.0, 1.0])

    def test_zero_baseline_gain_is_none(self):
        self.assertIsNone(safe_gain(0.0, 0.0))

    def test_cross_validation_returns_one_error_per_prompt(self):
        dataset = synthetic_translation_dataset(samples=25)
        errors = cross_validated_errors(
            dataset,
            lambda: RidgeTranslator(regularization=0.1),
            folds=5,
        )
        self.assertEqual(errors.shape, (25,))
        self.assertTrue(np.all(errors >= 0.0))

    def test_invalid_folds_rejected(self):
        dataset = synthetic_translation_dataset(samples=8)
        with self.assertRaisesRegex(ValueError, "folds"):
            cross_validated_errors(dataset, RidgeTranslator, folds=9)


if __name__ == "__main__":
    unittest.main()
