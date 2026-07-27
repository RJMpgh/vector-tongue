import math
import unittest

import numpy as np

from vector_tongue.geometry import (
    cosine_distance,
    cosine_similarity,
    drift_components,
    l2_distance,
    marler_drift_v1,
)


class GeometryTests(unittest.TestCase):
    def test_identical_vectors(self):
        vector = np.array([1.0, 2.0, 3.0])
        self.assertAlmostEqual(cosine_similarity(vector, vector), 1.0)
        self.assertAlmostEqual(cosine_distance(vector, vector), 0.0)
        self.assertAlmostEqual(l2_distance(vector, vector), 0.0)
        self.assertAlmostEqual(marler_drift_v1(vector, vector), 0.0)

    def test_orthogonal_vectors(self):
        left = [1.0, 0.0]
        right = [0.0, 1.0]
        self.assertAlmostEqual(cosine_similarity(left, right), 0.0)
        self.assertAlmostEqual(l2_distance(left, right), math.sqrt(2.0))
        self.assertAlmostEqual(marler_drift_v1(left, right), math.sqrt(2.0))

    def test_components_preserve_signed_norm_shift(self):
        result = drift_components([2.0, 0.0], [1.0, 0.0])
        self.assertAlmostEqual(result.cosine_distance, 0.0)
        self.assertAlmostEqual(result.euclidean_displacement, 1.0)
        self.assertAlmostEqual(result.norm_shift, -1.0)

    def test_zero_vector_rejected(self):
        with self.assertRaisesRegex(ValueError, "near-zero"):
            cosine_similarity([0.0, 0.0], [1.0, 0.0])

    def test_shape_mismatch_rejected(self):
        with self.assertRaisesRegex(ValueError, "equal shape"):
            cosine_similarity([1.0], [1.0, 2.0])

    def test_nonfinite_rejected(self):
        with self.assertRaisesRegex(ValueError, "non-finite"):
            drift_components([1.0, float("nan")], [1.0, 2.0])

    def test_matrix_rejected(self):
        with self.assertRaisesRegex(ValueError, "one-dimensional"):
            cosine_similarity([[1.0, 0.0]], [[1.0, 0.0]])


if __name__ == "__main__":
    unittest.main()
