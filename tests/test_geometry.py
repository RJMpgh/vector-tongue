import unittest
import math
import sys
import os

# Add src to path for direct testing
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from vector_tongue.geometry import (
    cosine_similarity,
    cosine_distance,
    euclidean_distance,
    norm_shift,
    marler_drift_v1,
    compute_pair_metrics,
)


class TestGeometry(unittest.TestCase):
    def test_orthogonal_vectors(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        self.assertAlmostEqual(cosine_similarity(a, b), 0.0)
        self.assertAlmostEqual(cosine_distance(a, b), 1.0)
        self.assertAlmostEqual(euclidean_distance(a, b), math.sqrt(2.0))
        self.assertAlmostEqual(norm_shift(a, b), 0.0)

    def test_identical_vectors(self):
        a = [3.0, 4.0]
        b = [3.0, 4.0]
        self.assertAlmostEqual(cosine_similarity(a, b), 1.0)
        self.assertAlmostEqual(cosine_distance(a, b), 0.0)
        self.assertAlmostEqual(euclidean_distance(a, b), 0.0)
        self.assertAlmostEqual(norm_shift(a, b), 0.0)
        self.assertAlmostEqual(marler_drift_v1(a, b), 0.0)

    def test_opposite_vectors(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        self.assertAlmostEqual(cosine_similarity(a, b), -1.0)
        self.assertAlmostEqual(cosine_distance(a, b), 2.0)
        self.assertAlmostEqual(euclidean_distance(a, b), 2.0)

    def test_marler_drift_v1(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        expected = 1.0 * math.sqrt(2.0)
        self.assertAlmostEqual(marler_drift_v1(a, b), expected)

    def test_compute_pair_metrics(self):
        metrics = compute_pair_metrics([1.0, 0.0], [1.0, 1.0])
        self.assertIn("cosine_similarity", metrics)
        self.assertIn("cosine_distance", metrics)
        self.assertIn("euclidean_distance", metrics)
        self.assertIn("norm_shift", metrics)
        self.assertIn("marler_drift_v1", metrics)


if __name__ == "__main__":
    unittest.main()
