"""Append a predeclared KEY_TERM control and calculate ranking/uncertainty.
Does not fit thresholds. Retains the original timing samples unchanged.
"""
import json,math,random,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R))
from evaluation.benchmark import NAMES,create,read
from evaluation.metrics import evaluate
for name in NAMES:
 p=R/'results'/f'{name}.json';report=json.loads(p.read_text())
 rows=read('silver.jsonl')+read('challenge.jsonl')
 predfile=R/'results'/f'predictions-{name}.jsonl';stored=[json.loads(s) for s in predfile.read_text().splitlines()];byid={r['id']:r['annotations'] for r in stored}
 missing=[r for r in rows if r['id'] not in byid]
 if missing:
  adapter=create(name)
  for row in missing:byid[row['id']]=adapter(row['text'])
  if hasattr(adapter,'close'):adapter.close()
 predfile.write_text(''.join(json.dumps({'id':r['id'],'source_id':r['source_id'],'annotations':byid[r['id']]},ensure_ascii=False)+'\n' for r in rows))
 for split in ['development','test','challenge']:
  selected=[r for r in rows if r['split']==split];preds=[byid[r['id']] for r in selected]
  quality={'term_exact':evaluate(selected,preds),'term_overlap':evaluate(selected,preds,partial=True),'taxonomy_exact':evaluate(selected,preds,collapse_terms=False)}
  reciprocals=[];p3=[]
  for row,pred in zip(selected,preds):
   gold=[g for g in row['annotations'] if g['label'] in ['DEFINITION_TERM','KEY_TERM']]
   if not gold:continue
   terms=[p for p in pred if p['label'] in ['DEFINITION_TERM','KEY_TERM']][:5]
   hits=[i+1 for i,c in enumerate(terms) if any(c['start']==g['start'] and c['end']==g['end'] for g in gold)]
   reciprocals.append(1/min(hits) if hits else 0);p3.append(sum(i<=3 for i in hits)/3)
  quality['ranking']={'mrr_at_5':sum(reciprocals)/len(reciprocals) if reciprocals else None,'precision_at_3':sum(p3)/len(p3) if p3 else None,'n':len(reciprocals),'order':'adapter output order; no cross-algorithm score calibration'}
  if split=='test':
   # One silver lead per source: bootstrap resamples source documents.
   rng=random.Random(20261027);samples=[]
   for _ in range(2000):
    indices=[rng.randrange(len(selected)) for _ in selected];q=evaluate([selected[i] for i in indices],[preds[i] for i in indices]);samples.append(q['f1'] or 0)
   samples.sort();quality['source_bootstrap_f1_95']=[samples[50],samples[1949]]
  report['quality'][split]=quality
 report['primary_gold_metrics']=None;report['primary_gold_reason']='No independently human-validated gold; silver diagnostic only.'
 p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(name,'quality updated',flush=True)
