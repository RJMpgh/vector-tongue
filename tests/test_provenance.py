import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from vector_tongue.provenance import verify_manifest


class TestProvenance(unittest.TestCase):
    def test_verify_manifest_structure(self):
        manifest_path = os.path.join(os.path.dirname(__file__), "..", "provenance", "vector_tongue_priority_manifest.json")
        if os.path.exists(manifest_path):
            report = verify_manifest(manifest_path)
            self.assertTrue(report["is_valid_structure"])
            self.assertEqual(report["project"], "Vector Tongue")
            self.assertEqual(report["recorded_by"], "RJ Marler")
            self.assertGreater(report["summary"]["total_artifacts"], 0)


if __name__ == "__main__":
    unittest.main()
