from .common import annotation,spans_for,WORDS
class Yake:
 def __init__(self,top=5,morph=False):
  import yake
  self.extractor=yake.KeywordExtractor(lan='ru',n=3,top=top,dedupLim=.9)
  self.morph=None
  if morph:
   import pymorphy3
   self.morph=pymorphy3.MorphAnalyzer()
 def __call__(self,text):
  if not self.morph:
   out=[]
   for phrase,score in self.extractor.extract_keywords(text):
    matches=spans_for(text,phrase)
    if matches:out.append(annotation(text,matches[0].start(),matches[0].end(),score=1/(1+score)))
   return out
  # Token-aligned lemmatization: retain punctuation to avoid joining sentences.
  import re
  tokens=list(re.finditer(r'[А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z0-9-]*|[^\w\s]',text))
  lemmas=[self.morph.parse(m.group())[0].normal_form if WORDS.fullmatch(m.group()) else m.group() for m in tokens]
  normalized=' '.join(lemmas);offsets=[];pos=0
  for lemma in lemmas:offsets.append((pos,pos+len(lemma)));pos+=len(lemma)+1
  out=[]
  for phrase,score in self.extractor.extract_keywords(normalized):
   matches=spans_for(normalized,phrase)
   if not matches:continue
   m=matches[0];indices=[i for i,(a,b) in enumerate(offsets) if a>=m.start() and b<=m.end()]
   if indices:out.append(annotation(text,tokens[indices[0]].start(),tokens[indices[-1]].end(),score=1/(1+score)))
  return out
