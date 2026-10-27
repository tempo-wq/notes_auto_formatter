from .common import WORDS,STOP,annotation
class TextRank:
 def __init__(self,window=4):self.window=window
 def __call__(self,text):
  import networkx as nx
  words=[m for m in WORDS.finditer(text) if len(m.group())>=3 and m.group().lower() not in STOP]
  graph=nx.Graph()
  for i,m in enumerate(words):
   a=m.group().lower();graph.add_node(a)
   for other in words[i+1:i+self.window]:
    b=other.group().lower()
    if a!=b:graph.add_edge(a,b,weight=graph.get_edge_data(a,b,{}).get('weight',0)+1)
  if not graph:return []
  ranks=nx.pagerank(graph,alpha=.85,max_iter=200,tol=1e-6)
  phrases=[]
  for i,m in enumerate(words):
   group=[m]
   for other in words[i+1:i+3]:
    if text[group[-1].end():other.start()].strip():break
    group.append(other)
   score=sum(ranks[x.group().lower()] for x in group)/len(group)
   phrases.append((score,m.start(),group[-1].end()))
  out=[];seen=set()
  for score,a,b in sorted(phrases,reverse=True):
   key=text[a:b].lower()
   if key not in seen:out.append(annotation(text,a,b,score=score));seen.add(key)
   if len(out)==5:break
  return out
