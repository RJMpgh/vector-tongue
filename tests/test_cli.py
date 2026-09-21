import unittest
import tempfile
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from vector_tongue.cli import main


class TestCLI(unittest.TestCase):
    def test_demo_command(self):
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            out_file = f.name

        try:
            exit_code = main(["demo", "--output", out_file, "--num-prompts", "10", "--dim", "4"])
            self.assertEqual(exit_code, 0)
            self.assertTrue(os.path.exists(out_file))
            self.assertGreater(os.path.getsize(out_file), 10)
        finally:
            if os.path.exists(out_file):
                os.unlink(out_file)

    def test_verify_proof_command(self):
        manifest_path = os.path.join(os.path.dirname(__file__), "..", "provenance", "vector_tongue_priority_manifest.json")
        exit_code = main(["verify-proof", manifest_path])
        self.assertEqual(exit_code, 0)

    def test_evaluate_command(self):
        csv_path = os.path.join(os.path.dirname(__file__), "..", "examples", "paired_embeddings.csv")
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            out_file = f.name

        try:
            exit_code = main(["evaluate", csv_path, "--model", "ridge", "--output", out_file])
            self.assertEqual(exit_code, 0)
            self.assertTrue(os.path.exists(out_file))
        finally:
            if os.path.exists(out_file):
                os.unlink(out_file)

    def test_validate_anchor_registry_command(self):
        registry_path = os.path.join(os.path.dirname(__file__), "..", "anchors", "marlerian-baseline-v0.1.json")
        exit_code = main(["validate-anchors", registry_path])
        self.assertEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
