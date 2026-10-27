"""Resolve the agent's explicit literal selections, not algorithm predictions."""
import hashlib,json
from collections import Counter
from pathlib import Path
from .decisions import REVIEW,NEGATIVE_REASONS,EXTRA_EXCLUSIONS,DERIVED
ROOT=Path(__file__).resolve().parents[1]
LABELS={'DEFINITION_TERM','DEFINITION','IMPORTANT','EXAMPLE','KEY_TERM'}
def resolve(text,selections):
 out=[];seen=set()
 for choice in selections:
  label,start_text,*end_text=choice
  if label not in LABELS:raise ValueError('Unknown label')
  start=text.find(start_text)
  if start<0:raise ValueError('Missing exact phrase: '+start_text)
  end=start+len(start_text)
  if end_text:
   last=text.find(end_text[0],start)
   if last<0:raise ValueError('Missing end phrase: '+end_text[0])
   end=last+len(end_text[0])
  key=(start,end,label)
  if key in seen:raise ValueError('Duplicate annotation')
  seen.add(key);out.append({'start':start,'end':end,'label':label,'text':text[start:end]})
 return sorted(out,key=lambda a:(a['start'],a['end'],a['label']))
def main():
 rows=[json.loads(s) for split in ['development','test'] for s in (ROOT/'datasets'/f'{split}.jsonl').read_text().splitlines()]
 retained=[];excluded=[];decisions=[]
 def record(row,text,selections,suffix='',reason=None):
  annotations=resolve(text,selections)
  if not annotations and not reason:raise ValueError('Explicit NONE reason required')
  retained.append({'id':row['id']+suffix,'parent_id':row['id'],'source_id':row['source_id'],'topic':row['topic'],'split':row['split'],'text':text,'text_sha256':hashlib.sha256(text.encode()).hexdigest(),'annotation_status':'silver-agent-reviewed','reviewer':'coding agent; user delegated annotation; no independent human validation','annotation_policy':'expanded-v1','annotations':annotations,'none':not annotations,'none_reason':reason,'transformations':'verbatim clean prefix before formula-extraction damage' if suffix else 'original committed corpus text unchanged'})
 for row in rows:
  rid=row['id'];text=row['text']
  if '\\displaystyle' in text or rid in EXTRA_EXCLUSIONS:
   reason=EXTRA_EXCLUSIONS.get(rid,'MediaWiki extraction duplicated/rendered math as fragmented symbols plus raw displaystyle; not reliable prose for this comparison')
   excluded.append({'id':rid,'source_id':row['source_id'],'split':row['split'],'reason':reason,'text_sha256':hashlib.sha256(text.encode()).hexdigest()});decisions.append({'id':rid,'decision':'exclude','reason':reason})
   if rid in DERIVED:
    d=DERIVED[rid];end=text.index(d['end'])+len(d['end']);record(row,text[:end],d['selections'],'_clean')
   continue
  if rid not in REVIEW:raise ValueError('Unreviewed fragment: '+rid)
  try:record(row,text,REVIEW[rid],reason=NEGATIVE_REASONS.get(rid))
  except ValueError as e:raise ValueError(rid+': '+str(e)) from e
  decisions.append({'id':rid,'decision':'reviewed-negative' if not REVIEW[rid] else 'annotated'})
 if set(REVIEW)-{r['id'] for r in rows}:raise ValueError('Unknown decisions')
 folder=ROOT/'datasets/expanded';folder.mkdir(exist_ok=True)
 for split in ['development','test']:(folder/f'{split}.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in retained if r['split']==split))
 (folder/'excluded.json').write_text(json.dumps(excluded,ensure_ascii=False,indent=2)+'\n')
 (folder/'decisions.json').write_text(json.dumps(decisions,ensure_ascii=False,indent=2)+'\n')
 counts=Counter(a['label'] for row in retained for a in row['annotations'])
 summary={'original_fragments':len(rows),'decisions':len(decisions),'excluded_original_fragments':len(excluded),'derived_clean_prefixes':sum(r['id'].endswith('_clean') for r in retained),'reviewed_examples':len(retained),'words':sum(len(r['text'].split()) for r in retained),'negative_examples':sum(r['none'] for r in retained),'label_counts':dict(counts),'by_split':dict(Counter(r['split'] for r in retained)),'by_topic':dict(Counter(r['topic'] for r in retained)),'primary_gold_available':False}
 (folder/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
