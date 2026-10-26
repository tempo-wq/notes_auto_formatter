import re
from collections import Counter
WORDS=re.compile(r"[А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z0-9-]*")
STOP=set('и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только её мне было вот от меня ещё нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы неё сейчас были куда зачем сказать всех никогда сегодня можно при такие также это который которая которые данной более после между'.split())
def annotation(text,start,end,label='KEY_TERM',score=1.):
 assert 0<=start<end<=len(text)
 return {'start':start,'end':end,'label':label,'score':float(score),'text':text[start:end]}
def spans_for(text,phrase):
 return list(re.finditer(r'(?<!\w)'+re.escape(phrase)+r'(?!\w)',text,re.I))
def candidates(text,limit=64):
 words=list(WORDS.finditer(text));counts=Counter(m.group().lower() for m in words);out=[]
 for i,m in enumerate(words):
  if m.group().lower() in STOP:continue
  for n in range(1,4):
   group=words[i:i+n]
   if len(group)<n or group[-1].group().lower() in STOP:continue
   start,end=m.start(),group[-1].end();phrase=text[start:end]
   if re.search(r'[.!?\n:;]',phrase) or any(x.group().lower() in STOP for x in group):continue
   out.append((sum(counts[x.group().lower()] for x in group)/n+n*.1,start,end))
 unique={text[a:b].lower():(score,a,b) for score,a,b in out}
 return sorted(unique.values(),key=lambda x:(-x[0],x[1],x[2]))[:limit]
def merge(base,extra):
 out=list(base)
 for c in extra:
  if not any(c['start']<b['end'] and c['end']>b['start'] for b in out):out.append(c)
 return sorted(out,key=lambda x:(x['start'],x['end'],x['label']))
