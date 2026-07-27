import unittest

import numpy as np

from vector_tongue.data import EmbeddingPair, PairDataset
from vector_tongue.demo import synthetic_translation_dataset


class DataTests(unittest.TestCase):
    def test_pair_creation_copies_vectors(self):
        source = np.array([1.0, 2.0])
        pair = EmbeddingPair.create("p1", source, [2.0, 3.0])
        source[0] = 99.0
        self.assertEqual(pair.source[0], 1.0)

    def test_blank_identifier_rejected(self):
        with self.assertRaisesRegex(ValueError, "blank"):
            EmbeddingPair.create(" ", [1.0], [2.0])

    def test_dimension_mismatch_rejected(self):
        with self.assertRaisesRegex(ValueError, "dimensions differ"):
            EmbeddingPair.create("p1", [1.0], [1.0, 2.0])

    def test_duplicate_identifier_rejected(self):
        pair = EmbeddingPair.create("p1", [1.0], [2.0])
        with self.assertRaisesRegex(ValueError, "unique"):
            PairDataset.from_pairs([pair, pair])

    def test_split_is_reproducible_and_disjoint(self):
        dataset = synthetic_translation_dataset(samples=20)
        train_a, test_a = dataset.split(seed=5)
        train_b, test_b = dataset.split(seed=5)
        self.assertEqual(train_a.prompt_ids, train_b.prompt_ids)
        self.assertEqual(test_a.prompt_ids, test_b.prompt_ids)
        self.assertFalse(set(train_a.prompt_ids).intersection(test_a.prompt_ids))

    def test_invalid_fraction_rejected(self):
        dataset = synthetic_translation_dataset(samples=8)
        with self.assertRaisesRegex(ValueError, "between"):
            dataset.split(test_fraction=1.0)

    def test_too_small_to_split_rejected(self):
        pairs = [
            EmbeddingPair.create(f"p{i}", [float(i), 1.0], [float(i + 1), 1.0])
            for i in range(3)
        ]
        with self.assertRaisesRegex(ValueError, "at least four"):
            PairDataset.from_pairs(pairs).split()


if __name__ == "__main__":
    unittest.main()
