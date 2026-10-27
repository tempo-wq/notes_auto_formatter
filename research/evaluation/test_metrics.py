import unittest,json
from pathlib import Path
from .metrics import match,evaluate
R=Path(__file__).resolve().parents[1]
class MetricsTests(unittest.TestCase):
 def test_duplicates_are_not_extra_true_positives(self):
  a={'start':0,'end':5,'label':'KEY_TERM'};self.assertEqual(match([a],[a,a]),{'tp':1,'fp':1,'fn':0})
 def test_overlap_is_one_to_one(self):
  a={'start':0,'end':5,'label':'KEY_TERM'};b={'start':4,'end':8,'label':'KEY_TERM'};self.assertEqual(match([a,b],[a],True)['tp'],1)
 def test_empty_does_not_mean_perfect_f1(self):self.assertIsNone(evaluate([{'annotations':[]}],[[]])['f1'])
 def test_source_disjoint_and_offsets(self):
  dev=[json.loads(x) for x in (R/'datasets/development.jsonl').read_text().splitlines()];test=[json.loads(x) for x in (R/'datasets/test.jsonl').read_text().splitlines()]
  self.assertFalse({r['source_id'] for r in dev}&{r['source_id'] for r in test})
  for file in ['silver.jsonl','challenge.jsonl']:
   for r in map(json.loads,(R/'datasets'/file).read_text().splitlines()):
    for a in r['annotations']:self.assertEqual(r['text'][a['start']:a['end']],a['text'])
 def test_utf16_bridge(self):
  from adapters.baseline import Baseline
  b=Baseline()
  try:
   r=b('Например, 😀 простой пример.');self.assertEqual(r[0]['text'],'Например, 😀 простой пример.')
  finally:b.close()
if __name__=='__main__':unittest.main()
