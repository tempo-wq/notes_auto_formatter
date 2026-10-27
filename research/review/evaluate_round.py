"""New inferences only. Does not rerun performance or tune on held-out data."""
import json,os,subprocess,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R))
from evaluation.benchmark import NAMES,create
from evaluation.metrics import evaluate
OUT=R/'results/human-round-01'
def references():return [json.loads(s) for s in (R/'review/human-round-01.jsonl').read_text().splitlines()]
if len(sys.argv)>1:
 name=sys.argv[1];adapter=create(name);rows=references()
 try:
  predictions=[adapter(r['text']) for r in rows]
  for row,preds in zip(rows,predictions):
   for a in preds:assert row['text'][a['start']:a['end']]==a['text']
  result={'name':name,'status':'ok','n':len(rows),'split':'development','reference_policy':'Human selected spans; agent inferred category assignment from prompt scope. Not adjudicated final gold.','term_exact':evaluate(rows,predictions),'term_overlap':evaluate(rows,predictions,partial=True),'predictions':[{'id':r['id'],'annotations':p} for r,p in zip(rows,predictions)]}
  (OUT/f'{name}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 finally:
  if hasattr(adapter,'close'):adapter.close()
else:
 OUT.mkdir(exist_ok=True,parents=True)
 env={**os.environ,'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','TOKENIZERS_PARALLELISM':'false'}
 for name in NAMES:
  p=subprocess.run([sys.executable,__file__,name],env=env,capture_output=True,text=True,timeout=120)
  if p.returncode:raise RuntimeError(f'{name}: '+p.stderr[-2000:])
  print(name,'review evaluated',flush=True)
