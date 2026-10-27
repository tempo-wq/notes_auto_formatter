"""Frozen-parameter comparison on expanded agent-reviewed references."""
import hashlib,json,os,random,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from evaluation.benchmark import NAMES,create
from evaluation.metrics import evaluate
OUT=ROOT/'results/expanded-silver'
def rows(split):return [json.loads(s) for s in (ROOT/f'datasets/expanded/{split}.jsonl').read_text().splitlines()]
def worker(name):
 adapter=create(name);all_predictions=[];report={'name':name,'status':'ok','primary_gold_available':False,'policy':'expanded-v1; single-agent preference annotations, not independent gold; no parameter fitting','reference_sha256':{s:hashlib.sha256((ROOT/f'datasets/expanded/{s}.jsonl').read_bytes()).hexdigest() for s in ['development','test']},'quality':{}}
 try:
  for split in ['development','test']:
   reference=rows(split);predictions=[adapter(r['text']) for r in reference]
   for row,preds in zip(reference,predictions):
    for c in preds:
     assert 0<=c['start']<c['end']<=len(row['text'])
     assert row['text'][c['start']:c['end']]==c['text']
    all_predictions.append({'id':row['id'],'split':split,'source_id':row['source_id'],'annotations':preds})
   q={'term_exact':evaluate(reference,predictions),'term_overlap':evaluate(reference,predictions,partial=True),'taxonomy_diagnostic':evaluate(reference,predictions,collapse_terms=False)}
   negatives=[i for i,r in enumerate(reference) if r['none']]
   q['negatives']={'n':len(negatives),'with_any_highlight':sum(bool(predictions[i]) for i in negatives),'predicted_spans':sum(len(predictions[i]) for i in negatives)}
   q['coverage']={'definition_body':'unsupported by all current adapters; not a competing task','important_example':'only baseline and rule_* hybrids support these categories','common_comparison':'TERM = DEFINITION_TERM + KEY_TERM'}
   if split=='test':
    groups=sorted({r['source_id'] for r in reference});rng=random.Random(20261027);samples=[]
    for _ in range(1000):
     selected=[rng.choice(groups) for _ in groups];indices=[i for group in selected for i,r in enumerate(reference) if r['source_id']==group]
     sample=evaluate([reference[i] for i in indices],[predictions[i] for i in indices]);samples.append(sample['f1'] or 0.)
    samples.sort();q['source_bootstrap_term_f1_95']=[samples[25],samples[974]];q['n_source_documents']=len(groups)
   report['quality'][split]=q
  (OUT/f'{name}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  (OUT/f'predictions-{name}.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in all_predictions))
 finally:
  if hasattr(adapter,'close'):adapter.close()
if __name__=='__main__':
 OUT.mkdir(exist_ok=True,parents=True)
 if len(sys.argv)>1:worker(sys.argv[1])
 else:
  env={**os.environ,'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','TOKENIZERS_PARALLELISM':'false','OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1'}
  for name in NAMES:
   p=subprocess.run([sys.executable,__file__,name],capture_output=True,text=True,env=env,timeout=600)
   if p.returncode:raise RuntimeError(name+': '+p.stderr[-3000:])
   print(name,'expanded references evaluated',flush=True)
