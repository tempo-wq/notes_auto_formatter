import { Plugin, PluginSettingTab, Setting, App, Notice, editorInfoField } from 'obsidian';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { defaults, Settings, Profile, HighlightType } from './analysis/types';
import { editorExtension, resetAnalysis, Diagnostics } from './editor/editorExtension';
export default class SmartNotes extends Plugin {
    settings: Settings = structuredClone(defaults);
    views = new Set<EditorView>();
    stats: Diagnostics = { analyzed: 0, cacheHits: 0, skippedLong: 0, skippedUnparsed: 0 };
    async onload() {
        const saved = await this.loadData();
        if (saved && typeof saved === 'object') {
            if (['economy', 'balanced', 'active'].includes(saved.profile))
                this.settings.profile = saved.profile;
            for (const key of Object.keys(defaults.enabled) as HighlightType[])
                if (typeof saved.enabled?.[key] === 'boolean')
                    this.settings.enabled[key] = saved.enabled[key];
        }
        const views = this.views;
        this.registerEditorExtension([editorExtension(() => this.settings, view => view.state.field(editorInfoField, false)?.file?.path, this.stats), ViewPlugin.fromClass(class {
                constructor(readonly view: EditorView) { views.add(view); }
                destroy() { views.delete(this.view); }
            })]);
        this.addSettingTab(new SmartNotesSettings(this.app, this));
    }
    async save() {
        await this.saveData(this.settings);
        for (const view of this.views)
            resetAnalysis(view);
    }
    onunload() { this.views.clear(); }
}
class SmartNotesSettings extends PluginSettingTab {
    constructor(app: App, readonly plugin: SmartNotes) { super(app, plugin); }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Smart Notes' });
        new Setting(containerEl).setName('Профиль анализа').addDropdown(d => d.addOptions({ economy: 'Economy — 1200 мс', balanced: 'Balanced — 500 мс', active: 'Active — 200 мс' }).setValue(this.plugin.settings.profile).onChange(async (value) => { this.plugin.settings.profile = value as Profile; await this.plugin.save(); }));
        const labels: Record<HighlightType, string> = { 'definition-term': 'Термины определений', important: 'Важные утверждения', example: 'Примеры', 'key-term': 'Явно названные термины' };
        for (const type of Object.keys(labels) as HighlightType[])
            new Setting(containerEl).setName(labels[type]).addToggle(t => t.setValue(this.plugin.settings.enabled[type]).onChange(async (value) => { this.plugin.settings.enabled[type] = value; await this.plugin.save(); }));
        new Setting(containerEl).setName('Диагностика текущего сеанса').addButton(b => b.setButtonText('Показать').onClick(() => { const s = this.plugin.stats; new Notice(`Анализов: ${s.analyzed}; попаданий кэша: ${s.cacheHits}; пропусков длинных строк: ${s.skippedLong}; ожиданий разбора Markdown: ${s.skippedUnparsed}; важных кандидатов: ${s.importantCandidates ?? 0}; принято: ${s.importantAccepted ?? 0}; видимых: ${s.renderedImportant ?? 0}`, 10000); }));
        containerEl.createEl('p', { text: 'Подсветка работает локально и не изменяет Markdown. Неоднозначные и слишком длинные фрагменты могут быть пропущены.' });
    }
}
