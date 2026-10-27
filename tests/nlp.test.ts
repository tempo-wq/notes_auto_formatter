import { expect, it, vi } from 'vitest';
import { AdvancedEngine } from '../src/analysis/AdvancedEngine';
import { NLPManager, fastAnalysis } from '../src/analysis/NLPManager';
import { resolve } from '../src/analysis/HighlightResolver';
import { defaults } from '../src/analysis/types';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { protectedRanges } from '../src/editor/MarkdownContext';

it.each([
    ['Градиентный спуск — это алгоритм оптимизации.', 'Градиентный спуск'],
    ['Функция потерь определяется как мера ошибки.', 'Функция потерь'],
    ['Под коэффициентом обучения понимают размер шага.', 'коэффициентом обучения'],
    ['Нейронная сеть представляет собой вычислительную модель.', 'Нейронная сеть'],
    ['Производная функции называется скоростью изменения.', 'Производная функции'],
    ['Кинетическая энергия является разновидностью энергии.', 'Кинетическая энергия'],
    ['Закон сохранения импульса — фундаментальный закон механики.', 'Закон сохранения импульса'],
    ['😀 Пояснение. Рекурсия — определение через самого себя.', 'Рекурсия'],
    ['## Математическая модель — приближённое описание явления.', 'Математическая модель']
])('uses precise local UTF-16 boundaries: %s', async (text, term) => {
    const out = await new AdvancedEngine().analyze({text, documentVersion: 0});
    expect(out.map(c => text.slice(c.from,c.to))).toEqual([term]);
});
it.each(['Обсудим это после занятия.', 'Завтра — пойдем гулять.', 'Это — не определение.', 'Мы — это команда.', 'Проверим это позже.', 'Обычная строка без маркеров.', 'Число — 42.', 'Термин — это.'])('rejects ambiguous prose: %s', async text => {
    expect(await new AdvancedEngine().analyze({text, documentVersion:0})).toEqual([]);
    expect(fastAnalysis(text,2000).filter(c=>c.type==='definition-term')).toEqual([]);
});
it('uses a nearby explicit definition for a repeated multiword term', async () => {
    const engine = new AdvancedEngine(), text = 'Градиентный спуск изменяет параметры модели.';
    expect(await engine.analyze({text, context:'Градиентный спуск — алгоритм оптимизации.', documentVersion:2})).toMatchObject([{from:0,to:17,type:'key-term'}]);
    expect(await engine.analyze({text, context:'Обычное пояснение.', documentVersion:3})).toEqual([]);
});
it('bounds enumeration density and excludes unanchored noun phrases', async () => {
    const engine = new AdvancedEngine(), text = 'Электрический ток имеет следующие проявления: нагревание проводников; изменение химического состава; создание магнитного поля; четвертый элемент.';
    const out = await engine.analyze({text, documentVersion:0});
    expect(out).toHaveLength(3);
    expect(out.map(c=>text.slice(c.from,c.to))).toEqual(['нагревание проводников','изменение химического состава','создание магнитного поля']);
    expect(await engine.analyze({text:'Функция потерь связана с нейронной сетью.',documentVersion:0})).toEqual([]);
});
it.each(['`Термин — понятие.`', '```\nТермин — понятие.\n```', '$Термин — понятие.$', '$$\nТермин — понятие.\n$$', '---\nТермин: понятие\n---', '**Термин — понятие.**', '[Термин — понятие.](url)'])('preserves protected Markdown: %s', async text => {
    const state=EditorState.create({doc:text,extensions:[markdown()]});
    ensureSyntaxTree(state,text.length,100);
    const blocked=protectedRanges(state,0,text.length)!;
    const result=await new NLPManager().advanced({text,blocked,documentVersion:0});
    expect(resolve(result,text.length,blocked,defaults)).toEqual([]);
    expect(state.doc.toString()).toBe(text);
});
it('cancels before and during initialization, and after disposal', async () => {
    const e=new AdvancedEngine(), a=new AbortController(), request={text:'Термин — понятие.',documentVersion:0};
    a.abort(); expect(await e.analyze(request,a.signal)).toEqual([]);
    const b=new AbortController(), pending=e.analyze(request,b.signal); b.abort();
    expect(await pending).toEqual([]);
    await e.dispose(); expect(await e.analyze(request)).toEqual([]);
});
it('initializes only when called, shares one engine and disposes it', async () => {
    const engine={initialize:vi.fn(async()=>{}),analyze:vi.fn(async()=>[]),dispose:vi.fn(async()=>{})}, create=vi.fn(()=>engine);
    const manager=new NLPManager(create); expect(create).not.toHaveBeenCalled();
    await Promise.all([manager.advanced({text:'a',documentVersion:0}),manager.advanced({text:'b',documentVersion:1})]);
    expect(create).toHaveBeenCalledTimes(1); await manager.dispose();
    expect(engine.dispose).toHaveBeenCalledTimes(1);
    expect(await manager.advanced({text:'a',documentVersion:2})).toEqual([]);
});
it('falls back to rules when an engine fails', async () => {
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const m=new NLPManager(()=>({initialize:async()=>{},analyze:async()=>{throw Error('failure');},dispose:async()=>{}}));
    expect(await m.advanced({text:'Интеграл это сумма.',documentVersion:0})).toEqual([]);
    expect(fastAnalysis('Интеграл это сумма.',2000)).toHaveLength(1);
    warn.mockRestore();
});
it('bounds huge input and recognizes a conditional example', async () => {
    expect(await new AdvancedEngine().analyze({text:'а'.repeat(100000),documentVersion:0})).toEqual([]);
    expect(fastAnalysis('Допустим, что скорость постоянна.',2000)[0].type).toBe('example');
});
