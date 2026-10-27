from .common import annotation
class Spacy:
 def __init__(self):
  import spacy
  self.nlp=spacy.load('ru_core_news_sm',disable=['ner'])
 def __call__(self,text):
  doc=self.nlp(text);out=[]
  for token in doc:
   if token.pos_ not in {'NOUN','PROPN'}:continue
   parts=[token]+[c for c in token.children if c.dep_ in {'amod','nmod','compound','flat','flat:name'} and c.pos_ in {'ADJ','NOUN','PROPN'}]
   defining=token.dep_ in {'nsubj','nsubj:pass'} and token.head.pos_ in {'NOUN','PROPN'}
   if len(parts)<2 and not defining:continue
   left=min(p.i for p in parts);right=max(p.i for p in parts)
   if right-left>4 or any(t.is_punct for t in doc[left:right+1]):continue
   score=.95 if defining else .7+len(parts)*.02
   out.append(annotation(text,doc[left].idx,doc[right].idx+len(doc[right]),'DEFINITION_TERM' if defining else 'KEY_TERM',score))
  unique={(c['start'],c['end']):c for c in out}
  return sorted(unique.values(),key=lambda x:(-x['score'],x['start']))[:5]
