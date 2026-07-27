import csv
import json
import pathlib
import tempfile
import unittest

from vector_tongue.experiment import (
    ExperimentConfig,
    load_prompts,
    protocol_summary,
    resolve_repo_path,
)


class ExperimentProtocolTests(unittest.TestCase):
    def setUp(self):
        self.root = pathlib.Path(__file__).parents[1]
        self.config_path = self.root / "experiments" / "real_models" / "config.json"

    def test_frozen_protocol_is_balanced_and_in_cost_guardrail(self):
        summary = protocol_summary(self.config_path)
        self.assertEqual(summary.prompt_count, 180)
        self.assertEqual(summary.calls, 360)
        self.assertEqual(summary.split_counts, {"calibration": 126, "heldout": 54})
        self.assertEqual(set(summary.family_counts.values()), {30})
        self.assertLess(summary.conservative_max_cost_usd, 1.0)
        self.assertEqual(len(summary.prompt_sha256), 64)

    def test_duplicate_prompt_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "prompts.csv"
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(["id", "family", "split", "text"])
                writer.writerows(
                    [
                        ["p1", "one", "calibration", "a"],
                        ["p1", "one", "calibration", "b"],
                        ["p2", "one", "heldout", "c"],
                        ["p3", "one", "heldout", "d"],
                    ]
                )
            with self.assertRaisesRegex(ValueError, "duplicate"):
                load_prompts(
                    path,
                    calibration_label="calibration",
                    heldout_label="heldout",
                )

    def test_repo_paths_cannot_escape(self):
        with self.assertRaisesRegex(ValueError, "escapes"):
            resolve_repo_path(self.root, "../outside.txt")

    def test_config_requires_distinct_models(self):
        payload = json.loads(self.config_path.read_text(encoding="utf-8"))
        payload["target_model"] = payload["source_model"]
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "config.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must differ"):
                ExperimentConfig.load(path)


if __name__ == "__main__":
    unittest.main()
