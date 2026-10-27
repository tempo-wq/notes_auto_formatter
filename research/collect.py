"""Collect revision-attributed CC BY-SA Wikimedia excerpts; no generated gold labels."""
import json, re, urllib.request, urllib.parse, urllib.error, hashlib, random, time
from pathlib import Path
ROOT=Path(__file__).parent
SEED=20261027
TOPICS={
'math':['Производная функции','Интеграл','Матрица (математика)','Теория вероятностей'],
'physics':['Закон сохранения энергии','Электрический ток','Законы Ньютона','Электромагнитное поле'],
'programming':['Алгоритм','Рекурсия','Объектно-ориентированное программирование','Структура данных'],
'biology':['Клетка','Фотосинтез','Естественный отбор'],
'history':['Промышленная революция','Разделение властей','Государство'],
'mixed':['Научный метод','Математическая модель']}
def get(params):
 url='https://ru.wikipedia.org/w/api.php?'+urllib.parse.urlencode({'format':'json',**params})
 request=urllib.request.Request(url,headers={'User-Agent':'SmartNotesResearch/0.1 (open educational benchmark; no private notes)'})
 for attempt in range(4):
  try:
   with urllib.request.urlopen(request,timeout=45) as r:return json.load(r)
  except urllib.error.HTTPError as error:
   if error.code not in [429,503] or attempt==3:raise
   time.sleep(min(30,5*(attempt+1)))
def collect():
 rights=json.loads((ROOT/'datasets/rights.json').read_text()) if (ROOT/'datasets/rights.json').exists() else get({'action':'query','meta':'siteinfo','siprop':'rightsinfo'})['query']['rightsinfo']
 (ROOT/'datasets/rights.json').write_text(json.dumps(rights,ensure_ascii=False,indent=2))
 if 'creativecommons.org/licenses/by-sa/4.0' not in rights.get('url',''):raise ValueError('Review license before collecting')
 sources=[]; rows=[];rng=random.Random(SEED)
 for topic,titles in TOPICS.items():
  # Source document-level split, one test source per topic (6/20 = 30%).
  test=rng.choice(titles)
  for title in titles:
   cache=ROOT/'cache'/('source-'+hashlib.sha256(title.encode()).hexdigest()[:12]+'.json')
   if cache.exists():data=json.loads(cache.read_text())
   else:
    data=get({'action':'query','prop':'extracts|revisions','titles':title,'redirects':1,'explaintext':1,'rvprop':'ids|timestamp'})
    cache.write_text(json.dumps(data,ensure_ascii=False))
   page=next(iter(data['query']['pages'].values()))
   if 'extract' not in page:raise ValueError(title)
   rev=page['revisions'][0];sid='wiki_'+str(page['pageid'])
   sources.append({'id':sid,'title':page['title'],'topic':topic,'url':'https://ru.wikipedia.org/?oldid='+str(rev['revid']),'authors':'Wikipedia contributors; individual authors in linked page history','authors_url':'https://ru.wikipedia.org/w/index.php?title='+urllib.parse.quote(page['title'])+'&action=history','revision':rev['revid'],'revision_timestamp':rev['timestamp'],'license':'CC-BY-SA-4.0','license_url':rights['url'],'license_evidence':'MediaWiki siteinfo rightsinfo; datasets/rights.json','transformations':'plain-text extract; paragraph grouping; U+0301 stress marks removed; no automatic gold labels'})
   paragraphs=[re.sub(r'\s+',' ',p).replace('\u0301','').strip() for p in page['extract'].split('\n') if p.strip() and not p.lstrip().startswith('=')]
   chunks=[];buf=[]
   for p in paragraphs:
    if len(p.split())>230:continue
    buf.append(p)
    if len(' '.join(buf).split())>=110:
     text='\n\n'.join(buf);buf=[]
     if len(text.split())<=230:chunks.append(text)
    if len(chunks)>=5:break
   for i,text in enumerate(chunks):
    rows.append({'id':sid+'_'+str(i+1),'source_id':sid,'topic':topic,'text':text,'annotations':[],'annotation_status':'unverified','split':'test' if title==test else 'development','text_sha256':hashlib.sha256(text.encode()).hexdigest()})
   print(title,len(chunks),flush=True)
 (ROOT/'datasets/sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
 for split in ['development','test']:
  (ROOT/'datasets'/f'{split}.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows if x['split']==split))
 (ROOT/'configs/split.json').write_text(json.dumps({'seed':SEED,'unit':'source_id','test_sources':[s['id'] for s in sources if any(r['source_id']==s['id'] and r['split']=='test' for r in rows)],'target_ratio':[.7,.3]},indent=2))
 print('TOTAL',len(rows),sum(len(r['text'].split()) for r in rows),'words',flush=True)
if __name__=='__main__':collect()
