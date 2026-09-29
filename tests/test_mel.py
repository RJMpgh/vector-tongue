import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from vector_tongue.mel import MELAtom, MELMessage, MELError, compare_mel


class TestMEL(unittest.TestCase):
    def test_round_trip_is_canonical(self):
        message = MELMessage(
            goal=" Explain ",
            atoms=(
                MELAtom(
                    kind="relation",
                    predicate="causes",
                    arguments=("heavy rainfall", "river level increase"),
                    confidence=0.76,
                    epistemic_status="INFERRED",
                ),
                MELAtom(
                    kind="evidence",
                    predicate="observed",
                    arguments=("heavy rainfall",),
                    epistemic_status="known",
                ),
            ),
            constraints=("avoid jargon", "avoid jargon"),
            provenance=("source-b", "source-a"),
        )
        decoded = MELMessage.from_json(message.canonical_json())
        self.assertEqual(message, decoded)
        self.assertEqual(decoded.constraints, ("avoid jargon",))
        self.assertEqual(decoded.provenance, ("source-a", "source-b"))

    def test_identical_packets_have_zero_loss(self):
        message = MELMessage(
            goal="explain",
            atoms=(MELAtom("CLAIM", "STATES", ("x",), epistemic_status="known"),),
        )
        result = compare_mel(message, message)
        self.assertEqual(result.semantic_loss, 0.0)
        self.assertEqual(result.atom_f1, 1.0)
        self.assertTrue(result.goal_match)

    def test_missing_atom_increases_loss(self):
        reference = MELMessage(
            goal="explain",
            atoms=(
                MELAtom("CLAIM", "STATES", ("x",), epistemic_status="known"),
                MELAtom("CLAIM", "STATES", ("y",), epistemic_status="known"),
            ),
            constraints=("short",),
        )
        candidate = MELMessage(
            goal="explain",
            atoms=(MELAtom("CLAIM", "STATES", ("x",), epistemic_status="known"),),
            constraints=("short",),
        )
        result = compare_mel(reference, candidate)
        self.assertGreater(result.semantic_loss, 0.0)
        self.assertLess(result.atom_recall, 1.0)

    def test_confidence_mae_only_when_measured(self):
        reference = MELMessage(
            goal="explain",
            atoms=(MELAtom("CLAIM", "STATES", ("x",), confidence=0.9),),
        )
        no_confidence = MELMessage(
            goal="explain",
            atoms=(MELAtom("CLAIM", "STATES", ("x",)),),
        )
        self.assertIsNone(compare_mel(reference, no_confidence).confidence_mae)

    def test_invalid_relation_rejected(self):
        with self.assertRaises(MELError):
            MELAtom("RELATION", "MAGICALLY_CAUSES", ("a", "b"))


if __name__ == "__main__":
    unittest.main()
