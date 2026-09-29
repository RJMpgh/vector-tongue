import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from vector_tongue.mel import MELAtom, MELMessage
from vector_tongue.mel_policy import MELPolicy, evaluate_mel_policy


class TestMELPolicy(unittest.TestCase):
    def test_allowed_packet(self):
        packet = MELMessage(
            goal="explain",
            atoms=(MELAtom("TOOL", "SEARCH", ("weather",)),),
            provenance=("source-1",),
        )
        policy = MELPolicy(
            allowed_goals=("explain",),
            allowed_tool_predicates=("SEARCH",),
            allowed_action_predicates=("RETURN_RESULT",),
            require_provenance=True,
            max_atoms=10,
        )
        report = evaluate_mel_policy(packet, policy)
        self.assertTrue(report.allowed)
        self.assertEqual(report.violations, ())

    def test_unlisted_tool_is_blocked(self):
        packet = MELMessage(
            goal="explain",
            atoms=(MELAtom("TOOL", "EXECUTE_EXTERNAL", ("target",)),),
            provenance=("source-1",),
        )
        policy = MELPolicy(
            allowed_goals=("explain",),
            allowed_tool_predicates=("SEARCH", "READ"),
            require_provenance=True,
        )
        report = evaluate_mel_policy(packet, policy)
        self.assertFalse(report.allowed)
        self.assertIn("tool_not_allowed:EXECUTE_EXTERNAL", report.violations)

    def test_missing_provenance_is_blocked(self):
        packet = MELMessage(
            goal="analyze",
            atoms=(MELAtom("CLAIM", "STATES", ("x",)),),
        )
        policy = MELPolicy(require_provenance=True)
        report = evaluate_mel_policy(packet, policy)
        self.assertFalse(report.allowed)
        self.assertIn("provenance_required", report.violations)


if __name__ == "__main__":
    unittest.main()
