"""Two extra fresh-process probes per adapter; OS caches are not flushed."""
import json,os,subprocess,sys,time
from pathlib import Path
R=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(R))
from evaluation.benchmark import NAMES,create,read
if len(sys.argv)>1:
 name=sys.argv[1];t=time.perf_counter();a=create(name);init=(time.perf_counter()-t)*1000
 t=time.perf_counter();a(read('silver.jsonl')[0]['text']);infer=(time.perf_counter()-t)*1000
 if hasattr(a,'close'):a.close()
 print(json.dumps({'initialization_ms':init,'first_inference_ms':infer}));sys.exit(0)
env={**os.environ,'OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','HF_HUB_OFFLINE':'1','TOKENIZERS_PARALLELISM':'false'}
for name in NAMES:
 path=R/'results'/f'{name}.json';report=json.loads(path.read_text())
 samples=[{'initialization_ms':report.get('initialization_ms'),'first_inference_ms':report.get('first_inference_ms'),'total_process_seconds':report.get('total_process_wall_seconds')}]
 for _ in range(2):
  t=time.perf_counter();r=subprocess.run([sys.executable,__file__,name],capture_output=True,text=True,env=env,timeout=120)
  if r.returncode:samples.append({'error':r.stderr[-1500:]})
  else:
   item=json.loads(r.stdout.strip().splitlines()[-1]);item['total_process_seconds']=time.perf_counter()-t;samples.append(item)
 report['fresh_process_probes']=samples;path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(name,'probes saved',flush=True)
