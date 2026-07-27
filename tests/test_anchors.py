import copy
import json
import pathlib
import tempfile
import unittest

import numpy as np

from vector_tongue.anchors import (
    AnchorRegistry,
    AnchorRegistryError,
    AnchorSpaceCalibrator,
    load_anchor_registry,
)


class AnchorRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = pathlib.Path(__file__).parents[1]
        cls.registry_path = (
            cls.root / "anchors" / "marlerian-baseline-v0.1.json"
        )
        cls.payload = json.loads(cls.registry_path.read_text(encoding="utf-8"))

    def test_example_registry_loads(self):
        registry = load_anchor_registry(self.registry_path)
        self.assertEqual(registry.registry_id, "marlerian-baseline")
        self.assertEqual(registry.anchor_count, 4)
        self.assertEqual(registry.path_stage_count, 12)
        self.assertEqual(registry.evaluation_prompt_count, 4)
        self.assertRegex(registry.source_sha256, r"^[0-9a-f]{64}$")

    def test_summary_is_machine_readable(self):
        summary = load_anchor_registry(self.registry_path).summary()
        self.assertEqual(summary["status"], "illustrative-draft")
        self.assertEqual(summary["steward"], "RJ Marler")

    def test_duplicate_anchor_rejected(self):
        payload = copy.deepcopy(self.payload)
        payload["anchors"].append(copy.deepcopy(payload["anchors"][0]))
        with self.assertRaisesRegex(AnchorRegistryError, "anchor_id values"):
            AnchorRegistry.from_dict(payload)

    def test_path_must_begin_at_zero(self):
        payload = copy.deepcopy(self.payload)
        payload["anchors"][0]["path"][0]["position"] = 0.1
        with self.assertRaisesRegex(AnchorRegistryError, "begin at 0.0"):
            AnchorRegistry.from_dict(payload)

    def test_path_positions_must_increase(self):
        payload = copy.deepcopy(self.payload)
        payload["anchors"][0]["path"][1]["position"] = 1.0
        with self.assertRaisesRegex(AnchorRegistryError, "strictly increasing"):
            AnchorRegistry.from_dict(payload)

    def test_invalid_version_rejected(self):
        payload = copy.deepcopy(self.payload)
        payload["version"] = "draft"
        with self.assertRaisesRegex(AnchorRegistryError, "semantic versioning"):
            AnchorRegistry.from_dict(payload)

    def test_loader_rejects_non_object_root(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "bad.json"
            path.write_text("[]", encoding="utf-8")
            with self.assertRaisesRegex(AnchorRegistryError, "root"):
                load_anchor_registry(path)


class AnchorCalibrationTests(unittest.TestCase):
    def test_calibrator_maps_model_anchors_to_reference(self):
        rng = np.random.default_rng(7)
        model_vectors = rng.normal(size=(20, 4))
        weights = np.array(
            [
                [0.8, 0.1, 0.0, 0.0],
                [0.0, 0.9, 0.2, 0.0],
                [0.1, 0.0, 1.1, 0.1],
                [0.0, 0.1, 0.0, 0.7],
            ]
        )
        reference = model_vectors @ weights + [0.2, -0.1, 0.05, 0.3]
        calibrator = AnchorSpaceCalibrator(regularization=0.0)
        report = calibrator.fit("example-model", model_vectors, reference)
        self.assertLess(report.mean_squared_error, 1e-20)
        np.testing.assert_allclose(
            calibrator.transform(model_vectors),
            reference,
            atol=1e-10,
        )

    def test_calibrator_rejects_shape_mismatch(self):
        with self.assertRaisesRegex(ValueError, "equal shape"):
            AnchorSpaceCalibrator().fit(
                "model",
                [[1.0, 2.0], [2.0, 3.0]],
                [[1.0], [2.0]],
            )

    def test_transform_before_fit_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "fitted"):
            AnchorSpaceCalibrator().transform([[1.0, 2.0]])


if __name__ == "__main__":
    unittest.main()
