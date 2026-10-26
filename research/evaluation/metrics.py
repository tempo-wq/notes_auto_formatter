"""One-to-one maximum-cardinality matching; undefined empty-set metrics are null."""
LABELS=['DEFINITION_TERM','DEFINITION','IMPORTANT','EXAMPLE','KEY_TERM']
def match(gold,pred,partial=False,collapse_terms=False):
 def label(x):return 'TERM' if collapse_terms and x['label'] in {'KEY_TERM','DEFINITION_TERM'} else x['label']
 edges=[[j for j,g in enumerate(gold) if label(g)==label(p) and ((max(g['start'],p['start'])<min(g['end'],p['end'])) if partial else (g['start']==p['start'] and g['end']==p['end']))] for p in pred]
 assigned={}
 def visit(i,seen):
  for j in edges[i]:
   if j in seen:continue
   seen.add(j)
   if j not in assigned or visit(assigned[j],seen):assigned[j]=i;return True
  return False
 tp=sum(visit(i,set()) for i in range(len(pred)))
 return {'tp':tp,'fp':len(pred)-tp,'fn':len(gold)-tp}
def summarize(counts):
 tp,fp,fn=(counts[k] for k in ['tp','fp','fn']);p=tp/(tp+fp) if tp+fp else None;r=tp/(tp+fn) if tp+fn else None
 return {**counts,'precision':p,'recall':r,'f1':2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None}
def evaluate(rows,predictions,collapse_terms=True,partial=False):
 counts={'tp':0,'fp':0,'fn':0};per={k:dict(counts) for k in (['TERM'] if collapse_terms else LABELS)}
 for row,preds in zip(rows,predictions):
  gold=[g for g in row['annotations'] if g['label']!='NONE'];preds=[p for p in preds if p['label']!='NONE']
  if collapse_terms:gold=[g for g in gold if g['label'] in {'KEY_TERM','DEFINITION_TERM'}];preds=[p for p in preds if p['label'] in {'KEY_TERM','DEFINITION_TERM'}]
  c=match(gold,preds,partial,collapse_terms)
  for k in counts:counts[k]+=c[k]
  for label in per:
   if label=='TERM':g,p=gold,preds
   else:g=[g for g in gold if g['label']==label];p=[p for p in preds if p['label']==label]
   c=match(g,p,partial,collapse_terms)
   for k in c:per[label][k]+=c[k]
 scores={k:summarize(v) for k,v in per.items()};fs=[x['f1'] for x in scores.values() if x['f1'] is not None]
 return {**summarize(counts),'macro_f1':sum(fs)/len(fs) if fs else None,'per_category':scores,'n':len(rows)}
