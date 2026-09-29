import unittest

from vector_tongue.migration import NOT_MEASURED, MigrationRecord, audit_migration, audit_from_json


class TestMigrationAudit(unittest.TestCase):
    def test_missing_embeddings_are_not_measured(self):
        result = audit_migration(
            [MigrationRecord("p1", "factual", "same", "same")],
            source_model="a",
            target_model="b",
        )
        self.assertEqual(result["measurements"]["semantic_drift"]["mean_embedding_mse"], NOT_MEASURED)
        self.assertEqual(result["release_gate"]["status"], "INSUFFICIENT_DATA")

    def test_constraint_violation_fails_configured_gate(self):
        result = audit_migration(
            [MigrationRecord("p1", "instruction-following", "one sentence", "two sentences", ("one sentence",))],
            source_model="a",
            target_model="b",
        )
        self.assertEqual(result["measurements"]["constraint_violations"]["count"], 1)
        self.assertEqual(result["release_gate"]["status"], "FAIL")

    def test_embeddings_are_computed_only_when_supplied(self):
        result = audit_migration(
            [MigrationRecord("p1", "factual", "a", "b", source_embedding=(0.0, 0.0), target_embedding=(1.0, 0.0))],
            source_model="a",
            target_model="b",
            semantic_drift_threshold=0.25,
        )
        self.assertEqual(result["measurements"]["semantic_drift"]["mean_embedding_mse"], 0.5)
        self.assertEqual(result["release_gate"]["status"], "FAIL")

    def test_duplicate_prompt_ids_rejected(self):
        records = [
            MigrationRecord("p1", "factual", "a", "a"),
            MigrationRecord("p1", "factual", "b", "b"),
        ]
        with self.assertRaises(ValueError):
            audit_migration(records, source_model="a", target_model="b")

    def test_json_fixture_has_no_fabricated_semantic_measurement(self):
        result = audit_from_json({"records": [{"prompt_id": "p1", "prompt_family": "factual", "source_output": "a", "target_output": "a"}]})
        self.assertEqual(result["measurements"]["semantic_drift"]["status"], "NOT_MEASURED")


if __name__ == "__main__":
    unittest.main()
