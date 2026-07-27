import unittest

import numpy as np

from vector_tongue.models import (
    IdentityTranslator,
    MeanShiftTranslator,
    OrthogonalTranslator,
    RidgeTranslator,
    TargetMeanTranslator,
)


class ModelTests(unittest.TestCase):
    def setUp(self):
        self.source = np.array(
            [[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [2.0, -1.0]]
        )
        self.target = self.source @ np.array([[0.0, 1.0], [-1.0, 0.0]]) + [0.2, -0.3]

    def test_identity(self):
        model = IdentityTranslator().fit(self.source, self.target)
        np.testing.assert_allclose(model.predict(self.source), self.source)

    def test_target_mean(self):
        model = TargetMeanTranslator().fit(self.source, self.target)
        prediction = model.predict(self.source[:2])
        np.testing.assert_allclose(prediction[0], self.target.mean(axis=0))
        np.testing.assert_allclose(prediction[0], prediction[1])

    def test_mean_shift(self):
        shifted_target = self.source + [0.4, -0.7]
        model = MeanShiftTranslator().fit(self.source, shifted_target)
        np.testing.assert_allclose(model.predict(self.source), shifted_target)

    def test_ridge_learns_affine_mapping(self):
        model = RidgeTranslator(regularization=0.0).fit(self.source, self.target)
        np.testing.assert_allclose(model.predict(self.source), self.target, atol=1e-10)

    def test_orthogonal_learns_rotation_and_offset(self):
        model = OrthogonalTranslator().fit(self.source, self.target)
        np.testing.assert_allclose(model.predict(self.source), self.target, atol=1e-10)

    def test_predict_before_fit_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "fitted"):
            RidgeTranslator().predict(self.source)

    def test_negative_regularization_rejected(self):
        with self.assertRaisesRegex(ValueError, "non-negative"):
            RidgeTranslator(regularization=-1.0)

    def test_shape_mismatch_rejected(self):
        with self.assertRaisesRegex(ValueError, "shapes differ"):
            RidgeTranslator().fit(self.source, self.target[:, :1])


if __name__ == "__main__":
    unittest.main()
