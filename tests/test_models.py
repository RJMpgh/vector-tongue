import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from vector_tongue.models import (
    IdentityBaseline,
    TargetMeanBaseline,
    MeanShiftBaseline,
    AffineRidgeTranslator,
    OrthogonalTranslator,
)


class TestModels(unittest.TestCase):
    def setUp(self):
        # Calibration vectors: simple linear relation target = 2 * source + [1, 1]
        self.sources = [
            [1.0, 0.0],
            [0.0, 1.0],
            [-1.0, 0.0],
            [0.0, -1.0],
            [2.0, 1.0],
        ]
        self.targets = [
            [3.0, 1.0],
            [1.0, 3.0],
            [-1.0, 1.0],
            [1.0, -1.0],
            [5.0, 3.0],
        ]

    def test_identity_baseline(self):
        model = IdentityBaseline().fit(self.sources, self.targets)
        pred = model.predict_one([1.5, 2.5])
        self.assertEqual(pred, [1.5, 2.5])

    def test_target_mean_baseline(self):
        model = TargetMeanBaseline().fit(self.sources, self.targets)
        pred = model.predict_one([10.0, 10.0])
        # Mean of targets
        expected = [
            sum(t[0] for t in self.targets) / len(self.targets),
            sum(t[1] for t in self.targets) / len(self.targets),
        ]
        self.assertAlmostEqual(pred[0], expected[0])
        self.assertAlmostEqual(pred[1], expected[1])

    def test_mean_shift_baseline(self):
        model = MeanShiftBaseline().fit(self.sources, self.targets)
        pred = model.predict_one([1.0, 1.0])
        # Target should shift source by average delta
        self.assertEqual(len(pred), 2)

    def test_affine_ridge_translator(self):
        # Low regularization to fit well
        model = AffineRidgeTranslator(regularization=0.01).fit(self.sources, self.targets)
        pred = model.predict_one([1.0, 0.0])
        # Target for [1.0, 0.0] was [3.0, 1.0]
        self.assertAlmostEqual(pred[0], 3.0, delta=0.1)
        self.assertAlmostEqual(pred[1], 1.0, delta=0.1)

    def test_orthogonal_translator(self):
        model = OrthogonalTranslator().fit(self.sources, self.targets)
        pred = model.predict_one([1.0, 0.0])
        self.assertEqual(len(pred), 2)


if __name__ == "__main__":
    unittest.main()
