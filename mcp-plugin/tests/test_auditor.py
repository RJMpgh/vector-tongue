import math
import unittest
from auditor import Auditor, squared_unit_distance

class AuditorTests(unittest.TestCase):
    def test_schema_first(self):
        def forbidden(_): raise AssertionError('Encoder should not run')
        a = Auditor(forbidden, 'fixture')
        base = {'customer_id':'x','status':'active','discount_tier':1}
        for patch in [{'discount_tier':'1'}, {'discount_tier':True}, {'discount_tier':-1}, {'discount_tier':4}, {'extra':1}, {'customer_id':' '}]:
            self.assertEqual(a.audit('update','crm','crm_update',dict(base,**patch))['status'], 'FAIL_SCHEMA')
        self.assertEqual(a.audit('update','other','crm_update',base)['status'],'FAIL_SCHEMA')

    def test_geometry(self):
        self.assertAlmostEqual(squared_unit_distance([2,0], [8,0]), 0)
        self.assertAlmostEqual(squared_unit_distance([1,0], [-1,0]), 4)
    def test_invalid_embeddings(self):
        for a,b in [([],[]),([0],[1]),([1],[1,2]),([math.nan],[1])]:
            with self.assertRaises(ValueError): squared_unit_distance(a,b)
    def test_no_default_pass(self):
        r = Auditor(lambda _: [[1,0],[1,0]], 'fixture').audit('read issue','crm','crm_update',{'customer_id':'x','status':'active','discount_tier':1})
        self.assertEqual(r['status'], 'UNCALIBRATED')
        self.assertEqual(r['execution'], 'DISABLED')
    def test_boundary(self):
        r = Auditor(lambda _: [[1,0],[0,1]], 'fixture', 2).audit('read','crm','crm_update',{'customer_id':'x','status':'active','discount_tier':1})
        self.assertEqual(r['status'], 'REVIEW_REQUIRED')
    def test_failure_is_not_zero(self):
        def fail(_): raise RuntimeError('secret')
        r = Auditor(fail,'fixture').audit('read','crm','crm_update',{'customer_id':'x','status':'active','discount_tier':1})
        self.assertIsNone(r['g'])
        self.assertNotIn('secret',str(r))
    def test_limits_and_non_json(self):
        a = Auditor(lambda _: [[1],[1]], 'fixture')
        self.assertEqual(a.audit('x'*17000,'crm','crm_update',{'customer_id':'x','status':'active','discount_tier':1})['status'], 'INPUT_TOO_LARGE')
        self.assertEqual(a.audit('x','g','a',{'x':math.nan})['status'], 'FAIL_SCHEMA')
    def test_canonical_payload(self):
        seen=[]
        def encode(texts): seen.append(texts[1]); return [[1],[1]]
        a=Auditor(encode,'fixture')
        a.audit('read','crm','crm_update',{'customer_id':'x','status':'active','discount_tier':1})
        a.audit('read','crm','crm_update',{'discount_tier':1,'status':'active','customer_id':'x'})
        self.assertEqual(*seen)

if __name__ == '__main__': unittest.main()
