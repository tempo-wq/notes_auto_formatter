"""Validate submitted human spans. Cannot independently authenticate a reviewer.
Never consumes algorithm predictions or promotes missing labels to NONE.
"""
import argparse,hashlib,json
from datetime import datetime
from pathlib import Path

def import_answers(packet,answers):
 if packet['round_id']!=answers.get('round_id'):raise ValueError('Round mismatch')
 if answers.get('complete') is not True:raise ValueError('Review is incomplete')
 if not answers.get('reviewer_id') or not answers.get('evidence'):raise ValueError('Reviewer and evidence are required')
 try:datetime.fromisoformat(answers['reviewed_at'].replace('Z','+00:00'))
 except (KeyError,ValueError,AttributeError):raise ValueError('Explicit ISO review time required')
 cases={c['id']:c for c in packet['cases']};provided=answers.get('cases',[])
 if len(provided)!=len(cases) or {c['id'] for c in provided}!=set(cases):raise ValueError('Every case exactly once is required')
 out=[]
 for answer in provided:
  case=cases[answer['id']];text=case['text'];digest=hashlib.sha256(text.encode()).hexdigest()
  if digest!=case['text_sha256'] or digest!=answer.get('text_sha256'):raise ValueError('Text changed since review')
  if case['split']!='development':raise ValueError('This calibration round must not consume held-out test data')
  if not isinstance(answer.get('no_highlights'),bool):raise ValueError('Explicit no_highlights boolean required')
  annotations=answer.get('annotations',[])
  if answer['no_highlights']==bool(annotations):raise ValueError('Specify spans OR explicit no-highlights, not both/neither')
  converted=[];seen=set()
  for annotation in annotations:
   label=annotation['label'];phrase=annotation.get('text')
   if label not in case['label_scope']:raise ValueError('Label outside reviewed scope')
   if not isinstance(phrase,str) or not phrase:raise ValueError('Exact nonempty phrase required')
   starts=[i for i in range(len(text)-len(phrase)+1) if text.startswith(phrase,i)]
   if not starts:raise ValueError('Reviewed phrase is not an exact substring')
   occurrence=annotation.get('occurrence')
   if occurrence is None:
    if len(starts)!=1:raise ValueError('Repeated phrase: specify zero-based occurrence')
    occurrence=0
   if type(occurrence) is not int or not 0<=occurrence<len(starts):raise ValueError('Invalid occurrence')
   start=starts[occurrence];end=start+len(phrase);key=(start,end,label)
   if key in seen:raise ValueError('Duplicate annotation')
   seen.add(key);converted.append({'start':start,'end':end,'label':label,'text':phrase})
  out.append({'id':'human_round01_'+case['id'],'source_id':case['source_id'],'parent_id':case['parent_id'],'split':'development','text':text,'label_scope':case['label_scope'],'annotation_status':'human-reviewed-single-reviewer','label_provenance':answers.get('label_provenance','reviewer-supplied labels'),'reviewer_id':answers['reviewer_id'],'reviewed_at':answers['reviewed_at'],'evidence':answers['evidence'],'none_in_scope':answer['no_highlights'],'annotations':sorted(converted,key=lambda c:(c['start'],c['end'],c['label']))})
 return out

def main():
 p=argparse.ArgumentParser();p.add_argument('--packet',type=Path,required=True);p.add_argument('--answers',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():raise SystemExit('Refusing to overwrite existing review output')
 rows=import_answers(json.loads(a.packet.read_text()),json.loads(a.answers.read_text()));a.output.write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows));print('Imported',len(rows),'scoped development references; not a final gold benchmark.')
if __name__=='__main__':main()
