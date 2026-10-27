"""Separate processes, CPU-only, fixed configs; no gold claims for agent silver."""
import argparse,json,os,platform,resource,statistics,subprocess,sys,time,threading,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from adapters.common import merge
from evaluation.metrics import evaluate
NAMES=['baseline','yake3','yake5','textrank2','textrank4','yake_morph','spacy','embeddings','rule_yake','rule_textrank','rule_spacy','rule_embeddings','rule_spacy_embeddings']
def read(name):return [json.loads(s) for s in (ROOT/'datasets'/name).read_text().splitlines()]
def create(name):
 from adapters.baseline import Baseline
 from adapters.yake_adapter import Yake
 from adapters.textrank_adapter import TextRank
 from adapters.spacy_adapter import Spacy
 from adapters.embeddings_adapter import Embeddings
 if name=='baseline':return Baseline()
 if name.startswith('yake'):return Yake(top=3 if name=='yake3' else 5,morph=name=='yake_morph')
 if name.startswith('textrank'):return TextRank(window=int(name[-1]))
 if name=='spacy':return Spacy()
 if name=='embeddings':return Embeddings(str(ROOT/'models/minilm'))
 base=Baseline()
 extra={'rule_yake':lambda:Yake(), 'rule_textrank':lambda:TextRank(), 'rule_spacy':lambda:Spacy(), 'rule_embeddings':lambda:Embeddings(str(ROOT/'models/minilm')), 'rule_spacy_embeddings':lambda:Embeddings(str(ROOT/'models/minilm'),Spacy())}[name]()
 class Hybrid:
  def __call__(self,text):return merge(base(text),extra(text))
  def close(self):base.close()
 return Hybrid()
def rss_tree():
 import psutil
 p=psutil.Process();return p.memory_info().rss+sum(c.memory_info().rss for c in p.children(recursive=True) if c.is_running())
def cpu_tree():
 import psutil
 p=psutil.Process();procs=[p]+p.children(recursive=True);total=0
 for proc in procs:
  try:t=proc.cpu_times();total+=t.user+t.system
  except psutil.Error:pass
 child=resource.getrusage(resource.RUSAGE_CHILDREN);return total+child.ru_utime+child.ru_stime

def worker(name):
 started=time.perf_counter();start_cpu=cpu_tree();running=True;peak=[rss_tree()]
 def monitor():
  while running:
   try:peak[0]=max(peak[0],rss_tree())
   except Exception:pass
   time.sleep(.01)
 thread=threading.Thread(target=monitor,daemon=True);thread.start()
 report={'name':name,'status':'started','quality_policy':'silver diagnostic only; primary gold metrics unavailable'}
 try:
  t=time.perf_counter();adapter=create(name);report['initialization_ms']=(time.perf_counter()-t)*1000;report['rss_after_initialization_bytes']=rss_tree()
  silver=read('silver.jsonl');challenge=read('challenge.jsonl');rows=silver+challenge
  t=time.perf_counter();adapter(rows[0]['text']);report['first_inference_ms']=(time.perf_counter()-t)*1000
  predictions=[adapter(row['text']) for row in rows]
  for row,preds in zip(rows,predictions):
   for c in preds:
    assert row['text'][c['start']:c['end']]==c['text']
  report['quality']={}
  for split in ['development','test','challenge']:
   selected=[(r,p) for r,p in zip(rows,predictions) if r['split']==split];rs=[r for r,p in selected];ps=[p for r,p in selected]
   report['quality'][split]={'term_exact':evaluate(rs,ps),'term_overlap':evaluate(rs,ps,partial=True),'taxonomy_exact':evaluate(rs,ps,collapse_terms=False)}
  (ROOT/'results'/f'predictions-{name}.jsonl').write_text(''.join(json.dumps({'id':r['id'],'source_id':r['source_id'],'annotations':p},ensure_ascii=False)+'\n' for r,p in zip(rows,predictions)))
  words=' '.join(r['text'] for r in read('development.jsonl')).split();report['latency']=[]
  for size in [100,500,2000,10000]:
   text=' '.join((words*((size//len(words))+1))[:size])
   for _ in range(2):adapter(text)
   times=[];cpu=cpu_tree()
   for _ in range(5):
    t=time.perf_counter();adapter(text);times.append((time.perf_counter()-t)*1000)
   times.sort();report['latency'].append({'words':size,'runs':5,'p50_ms':statistics.median(times),'p95_ms':times[-1],'p95_method':'nearest-rank; with n=5 this is max, very uncertain','cpu_seconds':cpu_tree()-cpu,'samples_ms':times})
  report['status']='ok'
  if hasattr(adapter,'close'):adapter.close()
 except Exception as error:
  report.update(status='error',error=repr(error),traceback=traceback.format_exc())
 finally:
  running=False;thread.join(timeout=1)
  report.update(total_worker_seconds=time.perf_counter()-started,cpu_seconds=cpu_tree()-start_cpu,peak_sampled_rss_bytes=peak[0],self_peak_rss_bytes=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
  (ROOT/'results'/f'{name}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  print(name,report['status'],report.get('error',''),flush=True)

def orchestrate(names):
 import psutil,importlib.metadata as metadata
 ROOT.joinpath('results').mkdir(exist_ok=True)
 environment={'platform':platform.platform(),'cpu':subprocess.check_output(['sysctl','-n','machdep.cpu.brand_string'],text=True).strip() if sys.platform=='darwin' else platform.processor(),'ram_bytes':psutil.virtual_memory().total,'python':sys.version,'device':'cpu','threads':1,'seed':20261027,'libraries':{name:metadata.version(name) for name in ['yake','pymorphy3','spacy','sentence-transformers','torch','numpy','psutil']},'rss_note':'10ms sampled RSS sum of worker and child Node baseline; shared pages may double count. self_peak is OS high-water mark; includes init/warmup.','cold_note':'Fresh process, warm OS filesystem caches; initialization excludes interpreter and worker imports; total_process_wall_seconds includes them. Not a disk-cold measurement.'}
 (ROOT/'results/environment.json').write_text(json.dumps(environment,ensure_ascii=False,indent=2)+'\n')
 env={**os.environ,'OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','TOKENIZERS_PARALLELISM':'false','HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1'}
 for name in names:
  start=time.perf_counter();proc=subprocess.run([sys.executable,__file__,'--worker',name],env=env,cwd=ROOT.parent,capture_output=True,text=True,timeout=600)
  path=ROOT/'results'/f'{name}.json'
  if path.exists():
   r=json.loads(path.read_text());r['total_process_wall_seconds']=time.perf_counter()-start;r['stderr']=proc.stderr[-3000:];path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
  else:path.write_text(json.dumps({'name':name,'status':'process_error','returncode':proc.returncode,'stderr':proc.stderr[-5000:]},indent=2))
  print(proc.stdout.strip() or f'{name}: process {proc.returncode}',flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--worker');parser.add_argument('--names',nargs='*',default=NAMES);args=parser.parse_args()
 if args.worker:worker(args.worker)
 else:orchestrate(args.names)
