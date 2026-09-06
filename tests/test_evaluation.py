import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from vector_tongue.data import PairedExample, PairedDataset
from vector_tongue.models import AffineRidgeTranslator
from vector_tongue.evaluation import (
    mean_squared_error,
    mean_cosine_distance,
    compute_advantage,
    evaluate_experiment,
)


class TestEvaluation(unittest.TestCase):
    def test_metrics(self):
        preds = [[1.0, 0.0], [0.0, 1.0]]
        targets = [[1.0, 0.0], [0.0, 1.0]]
        self.assertAlmostEqual(mean_squared_error(preds, targets), 0.0)
        self.assertAlmostEqual(mean_cosine_distance(preds, targets), 0.0)

    def test_advantage(self):
        # candidate error 0.5, baseline error 1.0 -> 50% advantage
        adv = compute_advantage(0.5, 1.0)
        self.assertAlmostEqual(adv, 0.5)

    def test_evaluate_experiment(self):
        train = PairedDataset([
            PairedExample(f"p_{i}", "math", [float(i), 1.0], [float(i) + 0.5, 2.0])
            for i in range(8)
        ])
        test = PairedDataset([
            PairedExample(f"pt_{i}", "math", [float(i + 10), 1.0], [float(i + 10) + 0.5, 2.0])
            for i in range(4)
        ])
        model = AffineRidgeTranslator(regularization=0.1)
        results = evaluate_experiment(train, test, model, "test_ridge")

        self.assertIn("candidate", results)
        self.assertIn("baselines", results)
        self.assertIn("held_out_mse", results["candidate"])
        self.assertIn("advantage_over_identity", results["candidate"])


if __name__ == "__main__":
    unittest.main()
