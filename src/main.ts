import { Plugin } from 'obsidian';
import { registerWanimCodeBlockProcessor } from './wanim/codeBlockProcessor';
import { isVimEnabled } from './wanim/editorChild';
import { DEFAULT_SETTINGS, WanimSettingTab } from './settings';
import type { WanimEditorFont, WanimEditorTheme, WanimPluginSettings, ThemeableEditor } from './types';

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

	updateAllEditorFontFamilies(fontFamily: WanimEditorFont) {
		for (const editor of this.activeEditors) {
			try {
				editor.setEditorFontFamily(fontFamily);
			} catch (err) {
				console.error('Failed to update editor font family', err);
			}
		}
	}

	async onload() {
		// Register the tab before doing any asynchronous plugin setup.  This keeps
		// Obsidian's Settings UI available even while a live scene is initializing.
		this.settings = { ...DEFAULT_SETTINGS };
		this.addSettingTab(new WanimSettingTab(this.app, this));
		await this.loadSettings();

		// The compiler itself is initialized lazily by the runtime, so settings
		// never have to wait for a Wanim scene to load.
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
