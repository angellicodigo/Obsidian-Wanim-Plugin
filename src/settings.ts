import { App, PluginSettingTab, Setting } from 'obsidian';
import MyPlugin from './main';
import type { WanimEditorTheme, WanimPluginSettings } from './types';

export const DEFAULT_SETTINGS: WanimPluginSettings = {
	editorTheme: 'obsidian',
	autoSaveDelaySeconds: 5,
	defaultCollapsed: true,
	renderQuality: '-qm',
	autoRunOnOpen: false,
	editorFontSize: 14,
};

export class WanimSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Editor theme')
			.setDesc('Syntax highlighting theme used in the embedded wanim editor.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('obsidian', 'Obsidian (match current UI)')
					.addOption('github-light', 'GitHub Light')
					.addOption('github-dark', 'GitHub Dark')
					.addOption('one-dark', 'One Dark')
					.addOption('monokai', 'Monokai')
					.setValue(this.plugin.settings.editorTheme)
					.onChange(async (value: WanimEditorTheme) => {
						this.plugin.settings.editorTheme = value;
						await this.plugin.saveSettings();
						this.plugin.updateAllEditorThemes(value);
					})
			);

		new Setting(containerEl)
			.setName('Auto-save delay')
			.setDesc('Seconds to wait after editing stops before auto-saving to disk. (1-300, default: 5)')
			.addText((text) =>
				text
					.setPlaceholder('5')
					.setValue(String(this.plugin.settings.autoSaveDelaySeconds))
					.onChange(async (value: string) => {
						const numValue = parseInt(value, 10);
						if (!isNaN(numValue) && numValue >= 1 && numValue <= 300) {
							this.plugin.settings.autoSaveDelaySeconds = numValue;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName('Collapse code by default')
			.setDesc('Choose whether to have the embedded wanim editor expanded or collapsed when opening a .md file.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.defaultCollapsed)
					.onChange(async (value: boolean) => {
						this.plugin.settings.defaultCollapsed = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Render quality')
			.setDesc('Manim render quality preset (-ql, -qm, -qh, -q4k).')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('-ql', 'Low (480p, 15fps)')
					.addOption('-qm', 'Medium (720p, 30fps)')
					.addOption('-qh', 'High (1080p, 60fps)')
					.addOption('-q4k', '4K (2160p, 60fps)')
					.setValue(this.plugin.settings.renderQuality)
					.onChange(async (value: string) => {
						this.plugin.settings.renderQuality = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Auto-run on open')
			.setDesc('Automatically run manim code blocks when opening a note.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoRunOnOpen)
					.onChange(async (value: boolean) => {
						this.plugin.settings.autoRunOnOpen = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Editor font size')
			.setDesc('Font size for the code editor (px). Use Ctrl++/Ctrl-- to zoom Obsidian UI; this value sets the base font size.')
			.addText((text) =>
				text
					.setPlaceholder('14')
					.setValue(String(this.plugin.settings.editorFontSize))
					.onChange(async (value: string) => {
						const numValue = parseInt(value, 10);
						if (!isNaN(numValue) && numValue >= 8 && numValue <= 72) {
							this.plugin.settings.editorFontSize = numValue;
							await this.plugin.saveSettings();
							this.plugin.updateAllEditorFontSizes(numValue);
						}
					})
			);
	}
}
