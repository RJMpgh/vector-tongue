import json
import unittest
from batch_audit import audit_records

class BatchTests(unittest.TestCase):
    def test_redaction_and_unknown_measurements(self):
        row = dict(user_intent='read private example',service='github',action='get_issue',payload=dict(owner='RJMpgh',repo='vector-tongue',issue_number=1))
        report=audit_records([json.dumps(row), '{}', 'not json'])
        self.assertEqual(report['total_records'],3)
        self.assertEqual(report['status_counts']['INVALID_INPUT'],2)
        self.assertEqual(report['semantic_measured_count'],0)
        self.assertNotIn('private example',json.dumps(report))
        self.assertEqual(report['net_savings'],'NOT_MEASURED')
    def test_record_limit(self):
        with self.assertRaises(ValueError): audit_records(['{}','{}'], limit=1)

if __name__ == '__main__': unittest.main()
