import copy
import json
import os
import unittest
from vector_tongue.anchors import AnchorRegistry, AnchorRegistryError, AnchorSpaceCalibrator, load_anchor_registry

class TestAnchorRegistry(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = os.path.join(os.path.dirname(__file__), "..", "anchors", "marlerian-baseline-v0.1.json")
        with open(cls.path, "r", encoding="utf-8") as f:
            cls.payload = json.load(f)

    def test_registry_loads(self):
        summary = load_anchor_registry(self.path).summary()
        self.assertEqual(summary["anchor_count"], 4)
        self.assertEqual(summary["path_stage_count"], 12)
        self.assertEqual(summary["evaluation_prompt_count"], 4)
        self.assertRegex(summary["source_sha256"], r"^[0-9a-f]{64}$")

    def test_duplicate_anchor_rejected(self):
        payload = copy.deepcopy(self.payload)
        payload["anchors"].append(copy.deepcopy(payload["anchors"][0]))
        with self.assertRaisesRegex(AnchorRegistryError, "unique"):
            AnchorRegistry.from_dict(payload)

    def test_path_order_rejected(self):
        payload = copy.deepcopy(self.payload)
        payload["anchors"][0]["path"][1]["position"] = 1.0
        with self.assertRaisesRegex(AnchorRegistryError, "strictly increasing"):
            AnchorRegistry.from_dict(payload)

    def test_calibrator(self):
        source = [[0,0],[1,0],[0,1],[1,1],[2,1],[1,2]]
        target = [[1,2],[3,2],[1,5],[3,5],[5,5],[3,8]]
        calibrator = AnchorSpaceCalibrator(regularization=0.0)
        report = calibrator.fit("test-model", source, target)
        self.assertLess(report.mean_squared_error, 1e-8)
        predicted = calibrator.transform([[2,2],[3,3]])[0]
        self.assertAlmostEqual(predicted[0], 5.0, places=5)
        self.assertAlmostEqual(predicted[1], 8.0, places=5)

    def test_transform_requires_fit(self):
        with self.assertRaisesRegex(RuntimeError, "fitted"):
            AnchorSpaceCalibrator().transform([[1,2],[2,3]])

if __name__ == "__main__":
    unittest.main()
