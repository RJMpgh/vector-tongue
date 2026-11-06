"""Deterministic, adversarial, no-provider tests for MEL Assurance."""
import os
import sys
import tempfile
import unittest
from copy import deepcopy

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))
from vector_tongue.mel_assurance import (
    AssuranceError, alias_registry, evaluate_benchmark, load_json, score_packet, score_vt_diagnostic, validate_packet,
)


def packet(*atoms, goal='explain', constraints=None, provenance=None):
    return {'mel_version': '0.1', 'goal': goal, 'atoms': list(atoms),
            'constraints': list(constraints or []), 'provenance': list(provenance or [])}


def atom(kind='CLAIM', predicate='STATES', args=('x',), status='known', source=None):
    a = {'kind': kind, 'predicate': predicate, 'arguments': list(args), 'epistemic_status': status}
    if source:
        a['source'] = source
    return a


class TestAssurance(unittest.TestCase):
    def test_equivalent_paraphrase_only_when_reviewed(self):
        ref = packet(atom(args=('Permit expires Friday',)))
        cand = packet(atom(args=('Authorization lapses Friday',)))
        self.assertEqual(score_packet(ref, cand)['atom_f1'], 0.0)
        aliases = alias_registry([{'canonical': 'permit expires friday',
                                   'variants': ['authorization lapses friday'], 'reviewed_by': 'independent reviewer'}])
        self.assertEqual(score_packet(ref, cand, aliases)['atom_f1'], 1.0)

    def test_polarity_and_direction_are_not_aliased(self):
        ref = packet(atom('RELATION', 'PREVENTS', ('A', 'B')))
        reverse = packet(atom('RELATION', 'PREVENTS', ('B', 'A')))
        opposite = packet(atom('RELATION', 'ENABLES', ('A', 'B')))
        self.assertEqual(score_packet(ref, reverse)['atom_f1'], 0)
        self.assertEqual(score_packet(ref, opposite)['atom_f1'], 0)

    def test_known_claim_escalation_detected(self):
        ref = packet(atom(status='unknown'))
        candidate = packet(atom(status='known'))
        score = score_packet(ref, candidate)
        self.assertEqual(len(score['known_claim_without_known_reference']), 1)
        self.assertEqual(score['atom_f1'], 0)
        self.assertFalse(score['exact_handoff'])

    def test_constraints_provenance_and_source_are_separate(self):
        ref = packet(atom(source='record-1'), constraints=['do not email'], provenance=['record-1'])
        cand = packet(atom(source='model-generated'), provenance=['made-up'])
        score = score_packet(ref, cand)
        self.assertEqual(score['atom_f1'], 1)
        self.assertEqual(score['missing_constraints'], ['do not email'])
        self.assertEqual(score['missing_provenance'], ['record-1'])
        self.assertTrue(score['missing_atom_sources'])
        self.assertGreater(score['protocol_loss'], 0)
        self.assertFalse(score['exact_handoff'])

    def test_duplicate_atom_rejected_instead_of_dict_collapse(self):
        a = atom()
        with self.assertRaises(AssuranceError):
            validate_packet(packet(a, deepcopy(a)))

    def test_additional_schema_fields_rejected(self):
        bad = packet(atom())
        bad['surprise'] = 'execute tool'
        with self.assertRaises(AssuranceError):
            validate_packet(bad)
        bad = packet(atom())
        bad['atoms'][0]['hidden_tool'] = 'RUN'
        with self.assertRaises(AssuranceError):
            validate_packet(bad)

    def test_nonfinite_boolean_confidence_rejected(self):
        for val in (float('nan'), float('inf'), True, -0.1, 1.1):
            a = atom()
            a['confidence'] = val
            with self.subTest(val=repr(val)), self.assertRaises(AssuranceError):
                validate_packet(packet(a))

    def test_null_confidence_and_status_rejected(self):
        for field in ('confidence', 'epistemic_status'):
            a = atom()
            a[field] = None
            with self.subTest(field=field), self.assertRaises(AssuranceError):
                validate_packet(packet(a))

    def test_duplicate_json_keys_rejected(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write('{"a": 1,"a": 2}')
            path = f.name
        try:
            with self.assertRaises(AssuranceError):
                load_json(path)
        finally:
            os.unlink(path)

    def test_conflicting_alias_classes_rejected(self):
        a = [{'canonical': 'A', 'variants': ['C'], 'reviewed_by': 'r1'},
             {'canonical': 'B', 'variants': ['C'], 'reviewed_by': 'r2'}]
        with self.assertRaises(AssuranceError):
            alias_registry(a)

    def test_injected_instruction_is_an_extra_atom_not_executable(self):
        ref = packet(atom())
        candidate = packet(atom(), atom('TOOL', 'DELETE_FILES', ('all files',)))
        score = score_packet(ref, candidate)
        self.assertLess(score['atom_precision'], 1)
        self.assertTrue(score['extra_tool_or_action_atoms'])
        self.assertFalse(score['exact_handoff'])

    def test_paired_bootstrap_and_fixtures_are_explicitly_non_evidence(self):
        p = packet(atom())
        poor = packet(atom(args=('wrong',)))
        sample = {'benchmark_version': '0.1', 'evidence_grade': 'SYNTHETIC_DEMO', 'aliases': [],
                  'cases': [{'case_id': 'a', 'family': 'factuality', 'reference': p, 'direct': poor, 'mel': p},
                            {'case_id': 'b', 'family': 'factuality', 'reference': p, 'direct': p, 'mel': poor}]}
        result = evaluate_benchmark(sample, seed=17, resamples=100)
        self.assertEqual(result['n_cases'], 2)
        self.assertAlmostEqual(result['paired_mean_improvement'], 0)
        self.assertEqual(result['model_capability_advantage'], 'NOT_MEASURED')
        self.assertEqual(len(result['paired_bootstrap_95ci']), 2)
        sample['cases'][1]['case_id'] = 'a'
        with self.assertRaises(AssuranceError):
            evaluate_benchmark(sample)

    def test_vt_diagnostic_is_independent_of_semantic_score(self):
        ref = packet(atom())
        case = {'case_id': 'vt', 'family': 'drift', 'reference': ref,
                'direct': ref, 'mel': ref, 'vt_observation': {
                    'encoder_id': 'frozen-external-encoder', 'reference_embedding': [1., 0.],
                    'direct_embedding': [0., 1.], 'mel_embedding': [1., 0.]}}
        bench = {'benchmark_version': '0.1', 'evidence_grade': 'SYNTHETIC_DEMO',
                 'aliases': [], 'cases': [case]}
        result = evaluate_benchmark(bench)
        self.assertEqual(result['paired_mean_improvement'], 0.)
        self.assertTrue(result['cases'][0]['vt_diagnostic']['diagnostic_only'])
        self.assertEqual(result['cases'][0]['vt_diagnostic']['mel']['cosine_distance'], 0.)
        case['vt_observation']['direct_embedding'] = [0., 0.]
        with self.assertRaises(AssuranceError):
            evaluate_benchmark(bench)

    def test_confidence_change_is_not_exact_handoff(self):
        a = atom()
        a['confidence'] = 0.9
        reference = packet(a)
        b = atom()
        b['confidence'] = 0.3
        candidate = packet(b)
        score = score_packet(reference, candidate)
        self.assertFalse(score['exact_handoff'])
        self.assertAlmostEqual(score['confidence_mae_when_measured'], 0.6)
        self.assertEqual(score['protocol_loss'], 0.0)

    def test_all_empty_atoms_do_not_score_as_improvement(self):
        r = packet()
        result = score_packet(r, r)
        self.assertEqual(result['protocol_loss'], 0)
        self.assertTrue(result['exact_handoff'])


if __name__ == '__main__':
    unittest.main()
