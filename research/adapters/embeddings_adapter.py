from .common import candidates,annotation
class Embeddings:
 def __init__(self,model_path,spacy_adapter=None):
  from sentence_transformers import SentenceTransformer
  import torch
  torch.set_num_threads(1)
  self.model=SentenceTransformer(model_path,device='cpu',local_files_only=True)
  self.model.max_seq_length=128
  self.spacy=spacy_adapter
 def __call__(self,text):
  import numpy as np
  proposals=self.spacy(text) if self.spacy else [annotation(text,a,b) for _,a,b in candidates(text)]
  if not proposals:return []
  # Token-bounded context windows rather than silent whole-note truncation.
  ids=self.model.tokenizer.encode(text,add_special_tokens=False)
  contexts=[self.model.tokenizer.decode(ids[i:i+120]) for i in range(0,len(ids),120)][:256]
  matrix=self.model.encode([text[c['start']:c['end']] for c in proposals]+contexts,normalize_embeddings=True,show_progress_bar=False)
  vectors=matrix[:len(proposals)];center=matrix[len(proposals):].mean(axis=0);center/=max(np.linalg.norm(center),1e-12)
  selected=[];remaining=list(range(len(proposals)))
  while remaining and len(selected)<5:
   def score(i):return .7*float(vectors[i]@center)-(.3*max(float(vectors[i]@vectors[j]) for j in selected) if selected else 0)
   i=max(remaining,key=score);remaining.remove(i);selected.append(i)
  return [annotation(text,proposals[i]['start'],proposals[i]['end'],score=float(vectors[i]@center)) for i in selected]
