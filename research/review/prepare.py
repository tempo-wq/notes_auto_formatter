"""Prepare a prediction-blind development-only review round."""
import hashlib,json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
corpus=[json.loads(s) for s in (R/'datasets/development.jsonl').read_text().splitlines()]
a=next(r for r in corpus if r['id']=='wiki_293181_2')
b=next(r for r in corpus if r['id']=='wiki_29983_2')
text_a='Математическая модель — это приближённое описание какого-либо класса явлений внешнего мира, выраженное математическими символами.'
assert text_a in a['text']
text_b='Электрический ток имеет следующие проявления: нагревание проводников; изменение химического состава проводников; создание магнитного поля.'
cases=[]
for key,row,text,scope,change in [('A',a,text_a,['DEFINITION_TERM','DEFINITION'],'verbatim first sentence'),('B',b,text_b,['KEY_TERM','IMPORTANT'],'adapted excerpt: parenthetical qualifications omitted, line breaks replaced with semicolons; not a verbatim quotation')]:
 cases.append({'id':key,'parent_id':row['id'],'source_id':row['source_id'],'split':'development','text':text,'text_sha256':hashlib.sha256(text.encode()).hexdigest(),'label_scope':scope,'transformations':change,'status':'pending','annotations':[]})
packet={'round_id':'round-01','annotation_status':'awaiting_review','task':'small calibration exercise; not a final benchmark','offsets':'Unicode code points, half-open [start,end)','blind_to_predictions':True,'cases':cases}
(R/'review/round-01.json').write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n')
template={'round_id':'round-01','reviewer_id':None,'reviewed_at':None,'evidence':None,'complete':False,'cases':[{'id':c['id'],'text_sha256':c['text_sha256'],'no_highlights':False,'annotations':[]} for c in cases]}
(R/'review/answers-template.json').write_text(json.dumps(template,ensure_ascii=False,indent=2)+'\n')
print('Prepared two development examples; no predictions or gold labels.')
