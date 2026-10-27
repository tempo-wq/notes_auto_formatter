import copy,hashlib,unittest
from .import_answers import import_answers
class ReviewTests(unittest.TestCase):
 def inputs(self,text='😀 Термин — определение.'):
  digest=hashlib.sha256(text.encode()).hexdigest()
  packet={'round_id':'r','cases':[{'id':'A','text':text,'text_sha256':digest,'split':'development','source_id':'s','parent_id':'p','label_scope':['KEY_TERM']}]}
  answers={'round_id':'r','complete':True,'reviewer_id':'fixture-only','reviewed_at':'2026-10-27T00:00:00+03:00','evidence':'unit-test fixture, not real human review','cases':[{'id':'A','text_sha256':digest,'no_highlights':False,'annotations':[{'text':'Термин','label':'KEY_TERM'}]}]}
  return packet,answers
 def test_codepoint_offsets(self):
  p,a=self.inputs();row=import_answers(p,a)[0];self.assertEqual(row['annotations'][0]['start'],2)
 def test_pending_is_not_gold(self):
  p,a=self.inputs();a['complete']=False
  with self.assertRaises(ValueError):import_answers(p,a)
 def test_missing_labels_are_not_none(self):
  p,a=self.inputs();a['cases'][0]['annotations']=[]
  with self.assertRaises(ValueError):import_answers(p,a)
 def test_explicit_negative(self):
  p,a=self.inputs();a['cases'][0].update(annotations=[],no_highlights=True);self.assertTrue(import_answers(p,a)[0]['none_in_scope'])
 def test_repeated_phrase_requires_occurrence(self):
  p,a=self.inputs('Термин и Термин')
  with self.assertRaises(ValueError):import_answers(p,a)
  a['cases'][0]['annotations'][0]['occurrence']=1;self.assertEqual(import_answers(p,a)[0]['annotations'][0]['start'],9)
 def test_changed_text_is_rejected(self):
  p,a=self.inputs();a['cases'][0]['text_sha256']='old'
  with self.assertRaises(ValueError):import_answers(p,a)
 def test_missing_evidence_is_rejected(self):
  p,a=self.inputs();a['evidence']=None
  with self.assertRaises(ValueError):import_answers(p,a)
 def test_test_partition_cannot_be_consumed(self):
  p,a=self.inputs();p['cases'][0]['split']='test'
  with self.assertRaises(ValueError):import_answers(p,a)
