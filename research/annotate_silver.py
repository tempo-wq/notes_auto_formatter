"""Apply explicit, agent-reviewed reference spans, never algorithm predictions.
These annotations are NOT human-validated gold. No exhaustive body KEY_TERM labels.
"""
import json
from pathlib import Path
R=Path(__file__).parent
REVIEW=[
('Производная функции','Производная функции','в данной точке.'),
('Интеграл','Интеграл','неопределённый интеграл).'),
('Матрица (математика)','Матрица','его элементы.'),
('Теория вероятностей','Теория вероятностей','операции над ними.'),
('Закон сохранения энергии','Закон сохранения энергии','сохраняется с течением времени.'),
('Электрический ток','Электрический ток','носителей электрического заряда.'),
('Законы Ньютона','Законы Ньютона','на составляющие её тела.'),
('Электромагнитное поле','Электромагнитное поле','электрические и магнитные моменты.'),
('Алгоритм','Алгоритм','определённой задачи.'),
('Рекурсия','Рекурсия','частью самого себя.'),
('Объектно-ориентированное программирование','Объектно-ориентированное программирование','иерархию наследования.'),
('Структура данных','Структура данных','логически связанные данные.'),
('Клетка','Клетка','самовоспроизведению и развитию.'),
('Фотосинтез','Фотосинтез','у архей).'),
('Естественный отбор','Естественный отбор','неблагоприятными признаками уменьшается.'),
('Промышленная революция','Промышленная революция','1760-е — 1840-е годы.'),
('Разделение властей','Разделение властей','законодательной, исполнительной и судебной.'),
('Государство','Государство','окружающим миром.'),
('Научный метод','Научный метод','конкретный специалист.'),
('Математическая модель','Математическая модель','некоторой другой системе.')]
def main():
 sources=json.loads((R/'datasets/sources.json').read_text());source_by_title={s['title']:s for s in sources}
 rows=[json.loads(x) for split in ['development','test'] for x in (R/'datasets'/f'{split}.jsonl').read_text().splitlines()]
 refs=[]
 for title,term,ending in REVIEW:
  sid=source_by_title[title]['id'];parent=next(r for r in rows if r['source_id']==sid and r['id'].endswith('_1'))
  start=parent['text'].index(term);end=parent['text'].index(ending,start)+len(ending);text=parent['text'][start:end]
  refs.append({'id':sid+'_lead','source_id':sid,'parent_id':parent['id'],'topic':parent['topic'],'split':parent['split'],'text':text,'annotation_status':'silver','reviewer':'coding agent; no independent human validation','task':'lead definition term, not exhaustive keyphrase extraction','annotations':[{'start':0,'end':len(term),'label':'DEFINITION_TERM','text':term},{'start':0,'end':len(text),'label':'DEFINITION','text':text}]})
 (R/'datasets/silver.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in refs))
 controls=[
 ('Интеграл это обобщение суммы.',[(0,8,'DEFINITION_TERM')]),
 ('Градиентный спуск представляет собой алгоритм оптимизации.',[(0,len('Градиентный спуск'),'DEFINITION_TERM')]),
 ('Важно: сохранить исходный текст.',[(0,31,'IMPORTANT')]),
 ('Например, производная постоянной равна нулю.',[(0,44,'EXAMPLE')]),
 ('После перерыва мы продолжили читать конспект.',[]),
 ('В этой строке просто сообщается о переходе к следующему разделу.',[]),
 ('`Интеграл это обобщение суммы.`',[]),
 ('$$\nf(x)=x^2\n$$',[]),
 ('Обсудим это после занятия.',[]),
 ('Следует помнить: деление на ноль не определено.',[(0,46,'IMPORTANT')]),
 ('Рассмотрим пример: число два является чётным.',[(0,44,'EXAMPLE')]),
 ('Мы встретились у входа и открыли тетради.',[])]
 controls.append(('Будем использовать термин «электрический ток».',[(len('Будем использовать термин «'),len('Будем использовать термин «')+len('электрический ток'),'KEY_TERM')]))
 out=[]
 for i,(text,annotations) in enumerate(controls):
  # Full-sentence boundaries are explicitly selected by the reviewer.
  a=[{'start':start,'end':len(text) if label in ['IMPORTANT','EXAMPLE'] else end,'label':label,'text':text[start:len(text) if label in ['IMPORTANT','EXAMPLE'] else end]} for start,end,label in annotations]
  out.append({'id':f'control_{i:02d}','source_id':'authored_controls','split':'challenge','text':text,'annotation_status':'silver','reviewer':'coding agent; no independent human validation','annotations':a,'none':not a})
 (R/'datasets/challenge.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in out))
 print('Silver:',len(refs),'Challenge:',len(out))
if __name__=='__main__':main()
