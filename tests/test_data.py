import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from vector_tongue.data import PairedExample, PairedDataset, split_dataset


class TestData(unittest.TestCase):
    def test_paired_example_validation(self):
        ex = PairedExample(
            prompt_id="p1",
            category="factual",
            source_embedding=[0.1, 0.2],
            target_embedding=[0.3, 0.4],
        )
        ex.validate(2, 2)

        with self.assertRaises(ValueError):
            bad_ex = PairedExample(
                prompt_id="p2",
                category="factual",
                source_embedding=[0.1],
                target_embedding=[0.3, 0.4],
            )
            bad_ex.validate(2, 2)

    def test_paired_dataset_and_split(self):
        examples = [
            PairedExample(f"p_{i}", "general", [float(i), 1.0], [float(i) * 2, 2.0])
            for i in range(10)
        ]
        dataset = PairedDataset(examples)
        self.assertEqual(len(dataset), 10)
        self.assertEqual(dataset.source_dim, 2)
        self.assertEqual(dataset.target_dim, 2)

        train, test = split_dataset(dataset, test_fraction=0.3, seed=123)
        self.assertEqual(len(train) + len(test), 10)
        self.assertGreater(len(train), 0)
        self.assertGreater(len(test), 0)

        # Ensure no prompt overlap
        train_prompts = set(train.prompt_ids)
        test_prompts = set(test.prompt_ids)
        self.assertEqual(len(train_prompts.intersection(test_prompts)), 0)


if __name__ == "__main__":
    unittest.main()
