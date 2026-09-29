import unittest

from vector_tongue.benchmark import compare_route_losses, NOT_MEASURED


class TestMELBenchmark(unittest.TestCase):
    def test_win_is_based_on_supplied_paired_losses(self):
        result = compare_route_losses([
            {"direct_semantic_loss": 0.4, "mel_semantic_loss": 0.2},
            {"direct_semantic_loss": 0.2, "mel_semantic_loss": 0.2},
        ])
        self.assertEqual(result["result"], "WIN")
        self.assertEqual(result["case_count"], 2)

    def test_missing_route_is_not_meASURED(self):
        result = compare_route_losses([{"direct_semantic_loss": 0.2}])
        self.assertEqual(result["result"], NOT_MEASURED)


if __name__ == "__main__":
    unittest.main()
