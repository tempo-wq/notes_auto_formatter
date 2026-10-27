"""Diagnostic comparison; references and historical baseline predictions stay immutable."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from evaluation.metrics import evaluate

def run():
 out=ROOT/'results/v02';out.mkdir(parents=True,exist_ok=True)
 p=subprocess.Popen([os.environ['NODE_BINARY'],str(ROOT/'cache/v02.cjs')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
 reports={}
 try:
  for split in ['development','test']:
   file=ROOT/f'datasets/expanded/{split}.jsonl';rows=[json.loads(l) for l in file.read_text().splitlines()]
   historical={r['id']:r['annotations'] for r in map(json.loads,(ROOT/'results/expanded-silver/predictions-baseline.jsonl').read_text().splitlines())}
   modes={'v01':[historical[r['id']] for r in rows]}
   for mode in ['rules','automatic']:
    predictions=[]
    for r in rows:
     p.stdin.write(json.dumps({'text':r['text'],'mode':mode},ensure_ascii=False)+'\n');p.stdin.flush()
     spans=json.loads(p.stdout.readline());text=r['text']
     def cp(n):return len(text.encode('utf-16-le')[:n*2].decode('utf-16-le'))
     preds=[{'start':cp(c['from']),'end':cp(c['to']),'label':c['type'].replace('-','_').upper(),'text':text[cp(c['from']):cp(c['to'])]} for c in spans]
     assert all(0<=c['start']<c['end']<=len(text) and text[c['start']:c['end']]==c['text'] for c in preds)
     predictions.append(preds)
    modes[mode]=predictions
    (out/f'{split}-{mode}.jsonl').write_text(''.join(json.dumps({'id':r['id'],'annotations':pred},ensure_ascii=False)+'\n' for r,pred in zip(rows,predictions)))
   reports[split]={'reference_sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'methods':{}}
   for name,predictions in modes.items():
    negatives=[i for i,r in enumerate(rows) if r['none']]
    reports[split]['methods'][name]={'term_exact':evaluate(rows,predictions),'term_overlap':evaluate(rows,predictions,partial=True),'taxonomy_diagnostic':evaluate(rows,predictions,collapse_terms=False),'negative_examples':len(negatives),'negative_spans':sum(len(predictions[i]) for i in negatives)}
  report={'status':'diagnostic silver, not independent gold; old test already observed; no annotation changes','scope':'Balanced, Automatic after idle, full line pass (no UI/viewport scheduling); v01 saved frozen predictions','results':reports}
  (out/'quality.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  for split,r in reports.items():
   for name,q in r['methods'].items():print(split,name,q['term_exact'])
 finally:
  p.terminate();p.wait(timeout=10)
if __name__=='__main__':run()
