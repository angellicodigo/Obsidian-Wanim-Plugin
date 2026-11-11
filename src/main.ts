import { Plugin } from 'obsidian';
import { registerWanimCodeBlockProcessor } from './wanim/codeBlockProcessor';
import { isVimEnabled } from './wanim/editorChild';
import { DEFAULT_SETTINGS, WanimSettingTab } from './settings';
import type { WanimEditorTheme, WanimPluginSettings, ThemeableEditor } from './types';

export default class WanimPlugin extends Plugin {
	settings: WanimPluginSettings;
	private activeEditors = new Set<ThemeableEditor>();

	registerActiveEditor(editor: ThemeableEditor) {
		this.activeEditors.add(editor);
	}

	unregisterActiveEditor(editor: ThemeableEditor) {
		this.activeEditors.delete(editor);
	}

	updateAllEditorThemes(newTheme: WanimEditorTheme) {
		for (const editor of this.activeEditors) {
			try {
				editor.setEditorTheme(newTheme);
			} catch (err) {
				console.error('Failed to update editor theme', err);
			}
		}
	}

	updateAllEditorVim(enabled: boolean) {
		for (const editor of this.activeEditors) {
			try {
				editor.setVimEnabled?.(enabled);
			} catch (err) {
				console.error('Failed to update editor vim mode', err);
			}
		}
	}

	updateAllEditorFontSizes(fontSize: number) {
		for (const editor of this.activeEditors) {
			try {
				editor.setEditorFontSize(fontSize);
			} catch (err) {
				console.error('Failed to update editor font size', err);
			}
		}
	}

	async onload() {
		await this.loadSettings();

		// Initialize the patched RapydScript compiler lazily on first render
		// to avoid blocking plugin load or breaking Obsidian's settings UI
		this.registerEvent(
			(this.app.vault as any).on('config-changed', () => {
				const isVim = isVimEnabled(this);
				this.updateAllEditorVim(isVim);
			})
		);

		registerWanimCodeBlockProcessor(this);
	}

	onunload() {
		this.activeEditors.clear();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<WanimPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
