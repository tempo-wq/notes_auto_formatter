import json,os,subprocess,shutil
from pathlib import Path
class Baseline:
 def __init__(self):
  node=os.environ.get('NODE_BINARY') or shutil.which('node')
  if not node:raise RuntimeError('Set NODE_BINARY or add Node.js to PATH')
  root=Path(__file__).resolve().parents[2]
  self.process=subprocess.Popen([node,str(root/'research/cache/baseline.cjs')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,cwd=root)
 def __call__(self,text):
  self.process.stdin.write(json.dumps(text,ensure_ascii=False)+'\n');self.process.stdin.flush()
  line=self.process.stdout.readline()
  if not line:raise RuntimeError('baseline worker stopped')
  result=json.loads(line)
  def cp(offset):return len(text.encode('utf-16-le')[:offset*2].decode('utf-16-le'))
  return [{'start':cp(c['from']),'end':cp(c['to']),'label':c['type'].replace('-','_').upper(),'score':c['confidence'],'text':text[cp(c['from']):cp(c['to'])]} for c in result]
 def close(self):
  self.process.terminate();self.process.wait(timeout=10)
  self.process.stdin.close();self.process.stdout.close()
