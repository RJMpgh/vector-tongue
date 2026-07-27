import json
import pathlib
import tempfile
import unittest

from vector_tongue.cli import main
from vector_tongue.io import load_embedding_pairs_csv


class IoCliTests(unittest.TestCase):
    def test_load_example(self):
        root = pathlib.Path(__file__).parents[1]
        dataset = load_embedding_pairs_csv(root / "examples" / "paired_embeddings.csv")
        self.assertEqual(dataset.size, 8)
        self.assertEqual(dataset.dimension, 3)

    def test_demo_writes_report(self):
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / "demo.json"
            code = main(["demo", "--output", str(output), "--seed", "4"])
            self.assertEqual(code, 0)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertTrue(payload["demonstration"])
            self.assertIn("gain_vs_baseline", payload["report"])

    def test_evaluate_example(self):
        root = pathlib.Path(__file__).parents[1]
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / "evaluation.json"
            code = main(
                [
                    "evaluate",
                    str(root / "examples" / "paired_embeddings.csv"),
                    "--output",
                    str(output),
                    "--seed",
                    "5",
                ]
            )
            self.assertEqual(code, 0)
            self.assertEqual(
                json.loads(output.read_text(encoding="utf-8"))["test_size"],
                2,
            )


if __name__ == "__main__":
    unittest.main()
