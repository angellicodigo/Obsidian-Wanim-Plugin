# Milestone 5 Settings Tab & Configuration Schema: Investigation and Architectural Design Report

## 1. Observation

Direct observations from codebase inspection, reference plugin inspection, and command executions:

1. **Target Plugin Settings & Types State (`src/types.ts`)**:
   - `src/types.ts` lines 7–30 defines `WanimEditorTheme`, `RenderQuality`, `WanimPluginSettings`, and `DEFAULT_SETTINGS`:
     ```ts
     export type WanimEditorTheme = 'obsidian' | 'github-light' | 'github-dark' | 'one-dark' | 'monokai';
     export type RenderQuality = '-ql' | '-qm' | '-qh' | '-q4k';
     export interface WanimPluginSettings {
         readonly editorTheme: WanimEditorTheme;
         readonly autoSaveDelaySeconds: number; // 1-300, default 60
         readonly defaultCollapsed: boolean; // default false
         readonly renderQuality: RenderQuality; // default '-qm'
         readonly autoRunOnOpen: boolean; // default true
     }
     export const DEFAULT_SETTINGS: Readonly<WanimPluginSettings> = Object.freeze({
         editorTheme: 'obsidian',
         autoSaveDelaySeconds: 60,
         defaultCollapsed: false,
         renderQuality: '-qm',
         autoRunOnOpen: true,
     });
     ```
   - `src/types.ts` lines 178–221 contains pure leaf function `resolvePluginSettings(stored: unknown, defaults: Readonly<WanimPluginSettings> = DEFAULT_SETTINGS): WanimPluginSettings` which validates against `VALID_THEMES` and `VALID_QUALITIES` and bounds `autoSaveDelaySeconds` between 1 and 300.
   - `src/settings.ts` does not yet exist in `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\src\`.

2. **Reference Plugin Settings Tab (`obsidian-manim-plugin/src/settings.ts`)**:
   - `obsidian-manim-plugin/src/settings.ts` lines 1–70 imports `{ App, PluginSettingTab, Setting } from "obsidian"`.
   - Lines 30–69 creates setting items in `display()`:
     - `Editor theme` dropdown (`'obsidian'`, `'github-light'`, `'github-dark'`, `'one-dark'`, `'monokai'`) with `onChange` calling `this.plugin.saveSettings()` and `this.plugin.updateAllEditorThemes(value)`.
     - `Auto-save delay` text input with `parseInt(value, 10)` checking `!isNaN(numValue) && numValue >= 1 && numValue <= 300`.
     - `Collapse code by default` toggle with `onChange` updating `defaultCollapsed` and calling `this.plugin.saveSettings()`.
   - Note: The reference plugin lacks the new settings required for Wanim: `renderQuality` (`-ql`, `-qm`, `-qh`, `-q4k`) and `autoRunOnOpen` (boolean).

3. **Theme Management & Dynamic Reconfiguration (`src/editor/editorThemes.ts` & `src/editor/editorChild.ts`)**:
   - `src/editor/editorThemes.ts` lines 17–23 defines `themeExtensionByName` complying with `{value}By{key}` naming:
     ```ts
     export const themeExtensionByName: Readonly<Record<WanimEditorTheme, Extension>> = Object.freeze({
         'obsidian': [],
         'github-light': githubLight,
         'github-dark': githubDark,
         'one-dark': oneDark,
         'monokai': monokai,
     });
     ```
   - In `src/editor/editorChild.ts` lines 140–144 and 269–277:
     ```ts
     private readonly themeCompartment = new Compartment();
     ...
     setEditorTheme(theme: WanimEditorTheme): void {
         if (this.currentTheme === theme && this.editorView) return;
         this.currentTheme = theme;
         this.containerEl.setAttribute('data-wanim-theme', theme);
         if (!this.editorView) return;
         this.editorView.dispatch({
             effects: this.themeCompartment.reconfigure(getEditorThemeExtension(theme)),
         });
     }
     ```
   - In `src/main.ts` lines 21–33 and 94–96:
     ```ts
     export function broadcastEditorThemeChange(
         editors: Iterable<ThemeableEditor>,
         newTheme: WanimEditorTheme,
         logError: (message: string, error: unknown) => void = console.error
     ): void { ... }
     ...
     updateAllEditorThemes(newTheme: WanimEditorTheme): void {
         broadcastEditorThemeChange(this.editorById.values(), newTheme);
     }
     ```
   - Active editors are tracked in `this.editorById: Map<string, ThemeableEditor>` on `ObsidianWanimPlugin`.

4. **Plugin Lifecycle & Settings Integration (`src/main.ts`)**:
   - In `src/main.ts` lines 65–71, `onload()` currently calls:
     ```ts
     await this.initializeSettings();
     this.initializeRapydscript();
     this.registerVaultConfigListener();
     this.registerCodeBlockProcessor();
     this.logPluginLoaded();
     ```
   - `this.addSettingTab(...)` is currently NOT called in `onload()`.
   - `initializeSettings()` currently uses `resolvePluginSettings(rawData, DEFAULT_SETTINGS)`. To conform with Obsidian plugin standards and prompt specifications, `loadSettings()` should be exposed.

5. **Test Harness & Headless Mock State (`tests/mocks/obsidian.ts` & `tests/run_tests.mjs`)**:
   - `tests/run_tests.mjs` aliases `obsidian` to `tests/mocks/obsidian.ts`.
   - `tests/mocks/obsidian.ts` does NOT currently export `PluginSettingTab` or `Setting` classes.
   - Running existing test suite via `npm --prefix "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin" test` passes all tests across Milestones 2, 3, and 4 (including adversarial stress test suites).
   - Running `npm --prefix "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin" run build` exits 0 with zero TypeScript and esbuild errors.

---

## 2. Logic Chain

1. **Schema & Pure Validation (Observation 1)**:
   - The plugin configuration schema requires 5 settings: `editorTheme`, `autoSaveDelaySeconds`, `defaultCollapsed`, `renderQuality`, and `autoRunOnOpen`.
   - Adhering to Rule 1 (Local Reasoning & Honest Functions) and Rule 3 (Parse, Don't Validate), validation must be pure leaf functions without external side-effects:
     - `clampAutoSaveDelay(value: number, min?: number, max?: number): number`
     - `parseAutoSaveDelayString(input: string): number | null`
     - `isSupportedTheme(candidate: unknown): candidate is WanimEditorTheme`
     - `isSupportedRenderQuality(candidate: unknown): candidate is RenderQuality`
     - `resolvePluginSettings(stored: unknown, defaults?: WanimPluginSettings): WanimPluginSettings`
   - Using `{value}By{key}` naming convention:
     - `themeLabelByTheme: Readonly<Record<WanimEditorTheme, string>>`
     - `qualityLabelByQuality: Readonly<Record<RenderQuality, string>>`
     - `themeExtensionByTheme: Readonly<Record<WanimEditorTheme, Extension>>`

2. **Settings Tab UI Architecture (Observation 2)**:
   - `WanimSettingTab` must extend Obsidian's `PluginSettingTab`.
   - Following Rule 2 (One Level of Abstraction / Stacking Bricks), `display()` must not be an un-decomposed block of 100 lines. Instead, `display()` calls discrete private renderers:
     - `renderHeader(containerEl)`
     - `renderThemeSetting(containerEl)`
     - `renderAutoSaveSetting(containerEl)`
     - `renderCollapseSetting(containerEl)`
     - `renderQualitySetting(containerEl)`
     - `renderAutoRunSetting(containerEl)`
   - Each setting cleanly binds to `this.plugin.settings`, persists changes immediately with `await this.plugin.saveSettings()`, and for themes immediately broadcasts to active editors via `this.plugin.updateAllEditorThemes(theme)`.

3. **Dynamic CM6 Compartment Reconfiguration (Observation 3)**:
   - When the user changes `editorTheme` in the Settings tab, existing editor instances must NOT be destroyed or re-created, as destroying them loses unsaved user edits, cursor position, scroll offsets, and undo/redo stacks.
   - `WanimCodeEditorChild` already has a dedicated `themeCompartment: Compartment`.
   - Calling `view.dispatch({ effects: this.themeCompartment.reconfigure(getEditorThemeExtension(theme)) })` swaps the theme extension in the live CodeMirror state in zero ticks without triggering layout disruption.
   - For `'obsidian'`, the extension is `[]`, allowing Obsidian CSS variables to style the editor; for `'github-light'`, `'github-dark'`, `'one-dark'`, and `'monokai'`, official CodeMirror theme extensions provide full token syntax highlighting.

4. **Plugin Lifecycle Integration (Observation 4)**:
   - `src/main.ts` must expose `loadSettings()`:
     ```ts
     async loadSettings(): Promise<void> {
         const rawData = await this.loadData();
         this.settings = resolvePluginSettings(rawData, DEFAULT_SETTINGS);
     }
     ```
   - `onload()` must call `await this.loadSettings()` and `this.registerSettingsTab()`, which calls `this.addSettingTab(new WanimSettingTab(this.app, this))`.
   - Active editor tracking (`this.editorById`) and broadcasting (`broadcastEditorThemeChange`) are already present in `main.ts` and will seamlessly receive the SettingsTab triggers.

5. **Headless Mocking & Verification (Observation 5)**:
   - Headless unit testing of `WanimSettingTab` requires expanding `tests/mocks/obsidian.ts` with lightweight mock classes for `PluginSettingTab`, `Setting`, `DropdownComponentMock`, `TextComponentMock`, and `ToggleComponentMock`.
   - This allows 100% automated test coverage in Node.js without needing an active Obsidian electron window.

---

## 3. Caveats

1. **Auto-Save Text Field Partial Input**:
   - In Obsidian settings text fields, `onChange` fires on every keystroke. When a user deletes a value to re-type, the string may temporarily be empty or out of range. The validation handler must silently ignore invalid intermediate keystrokes without writing corrupt data (e.g. `NaN`) to `plugin.settings`, while accepting valid integers in `[1, 300]`.
2. **Persistence Module Dependency**:
   - Milestone 5 also encompasses debounced vault source file persistence (`src/persistence/`). The settings schema designed here provides `autoSaveDelaySeconds` and `defaultCollapsed` which directly feed into the upcoming persistence layer.
3. **Strict Read-Only Reference Directory**:
   - `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` remained 100% untouched throughout investigation.

---

## 4. Conclusion & Concrete Code Proposals

### A. Concrete TypeScript Definitions & Dictionaries (`src/settings.ts`)

```ts
/**
 * Settings Tab & Configuration Schema for Obsidian Wanim Plugin.
 * Adheres strictly to R5 architectural guidelines:
 * - Honest leaf functions for validation and clamping
 * - One level of abstraction ("stacking bricks") for UI construction
 * - {value}By{key} naming conventions for lookup maps
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import type ObsidianWanimPlugin from './main';
import {
	DEFAULT_SETTINGS,
	RenderQuality,
	resolveEditorTheme,
	resolvePluginSettings,
	WanimEditorTheme,
	WanimPluginSettings,
} from './types';

// ============================================================================
// Domain Constants & Dictionaries ({value}By{key} naming)
// ============================================================================

export const MIN_AUTOSAVE_DELAY_SECONDS = 1;
export const MAX_AUTOSAVE_DELAY_SECONDS = 300;
export const DEFAULT_AUTOSAVE_DELAY_SECONDS = 60;

export const themeLabelByTheme: Readonly<Record<WanimEditorTheme, string>> = Object.freeze({
	'obsidian': 'Obsidian (match current UI)',
	'github-light': 'GitHub Light',
	'github-dark': 'GitHub Dark',
	'one-dark': 'One Dark',
	'monokai': 'Monokai',
});

export const qualityLabelByQuality: Readonly<Record<RenderQuality, string>> = Object.freeze({
	'-ql': 'Low quality (480p, 15fps)',
	'-qm': 'Medium quality (720p, 30fps) - Default',
	'-qh': 'High quality (1080p, 60fps)',
	'-q4k': '4K quality (2160p, 60fps)',
});

// ============================================================================
// Pure / Honest Leaf Functions
// ============================================================================

/**
 * Pure leaf function: Clamps auto-save delay safely between min and max bounds.
 */
export function clampAutoSaveDelay(
	value: number,
	min: number = MIN_AUTOSAVE_DELAY_SECONDS,
	max: number = MAX_AUTOSAVE_DELAY_SECONDS
): number {
	if (!Number.isFinite(value)) {
		return DEFAULT_AUTOSAVE_DELAY_SECONDS;
	}
	const floored = Math.floor(value);
	return Math.max(min, Math.min(floored, max));
}

/**
 * Pure leaf function: Parses text input from auto-save delay setting.
 * Returns valid integer in range [1, 300], or null if invalid.
 */
export function parseAutoSaveDelayInput(input: string): number | null {
	const trimmed = input.trim();
	if (!/^\d+$/.test(trimmed)) {
		return null;
	}
	const parsed = parseInt(trimmed, 10);
	if (
		Number.isNaN(parsed) ||
		parsed < MIN_AUTOSAVE_DELAY_SECONDS ||
		parsed > MAX_AUTOSAVE_DELAY_SECONDS
	) {
		return null;
	}
	return parsed;
}

/**
 * Pure leaf validator for render quality strings.
 */
export function isSupportedRenderQuality(candidate: unknown): candidate is RenderQuality {
	return (
		typeof candidate === 'string' &&
		Object.prototype.hasOwnProperty.call(qualityLabelByQuality, candidate)
	);
}

/**
 * Pure leaf resolver for render quality with fallback.
 */
export function resolveRenderQuality(
	candidate: unknown,
	fallback: RenderQuality = '-qm'
): RenderQuality {
	return isSupportedRenderQuality(candidate) ? candidate : fallback;
}

// ============================================================================
// WanimSettingTab Class (Stacking Bricks)
// ============================================================================

export class WanimSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: ObsidianWanimPlugin
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderHeader(containerEl);
		this.renderThemeSetting(containerEl);
		this.renderAutoSaveSetting(containerEl);
		this.renderCollapseSetting(containerEl);
		this.renderQualitySetting(containerEl);
		this.renderAutoRunSetting(containerEl);
	}

	// ------------------------------------------------------------------------
	// Discrete Stacking Bricks
	// ------------------------------------------------------------------------

	private renderHeader(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Wanim Plugin Settings' });
	}

	private renderThemeSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Editor theme')
			.setDesc('Syntax highlighting theme used in the embedded Python editor.')
			.addDropdown((dropdown) => {
				for (const [themeKey, label] of Object.entries(themeLabelByTheme)) {
					dropdown.addOption(themeKey, label);
				}
				dropdown
					.setValue(this.plugin.settings.editorTheme)
					.onChange(async (value: string) => {
						const theme = resolveEditorTheme(value);
						this.plugin.settings = {
							...this.plugin.settings,
							editorTheme: theme,
						};
						await this.plugin.saveSettings();
						this.plugin.updateAllEditorThemes(theme);
					});
			});
	}

	private renderAutoSaveSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Auto-save delay')
			.setDesc(
				`Seconds to wait after editing stops before auto-saving code to the markdown file. (${MIN_AUTOSAVE_DELAY_SECONDS}-${MAX_AUTOSAVE_DELAY_SECONDS}, default: ${DEFAULT_SETTINGS.autoSaveDelaySeconds})`
			)
			.addText((text) => {
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.autoSaveDelaySeconds))
					.setValue(String(this.plugin.settings.autoSaveDelaySeconds))
					.onChange(async (value: string) => {
						const parsed = parseAutoSaveDelayInput(value);
						if (parsed !== null) {
							this.plugin.settings = {
								...this.plugin.settings,
								autoSaveDelaySeconds: parsed,
							};
							await this.plugin.saveSettings();
						}
					});
			});
	}

	private renderCollapseSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Collapse code by default')
			.setDesc(
				'Choose whether embedded Python code editors should be collapsed by default when opening markdown files.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.defaultCollapsed)
					.onChange(async (value: boolean) => {
						this.plugin.settings = {
							...this.plugin.settings,
							defaultCollapsed: value,
						};
						await this.plugin.saveSettings();
					});
			});
	}

	private renderQualitySetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Render quality')
			.setDesc('Default resolution and frame rate for rendering Manim animations.')
			.addDropdown((dropdown) => {
				for (const [qualityKey, label] of Object.entries(qualityLabelByQuality)) {
					dropdown.addOption(qualityKey, label);
				}
				dropdown
					.setValue(this.plugin.settings.renderQuality)
					.onChange(async (value: string) => {
						const quality = resolveRenderQuality(value);
						this.plugin.settings = {
							...this.plugin.settings,
							renderQuality: quality,
						};
						await this.plugin.saveSettings();
					});
			});
	}

	private renderAutoRunSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Auto-run on open')
			.setDesc('Automatically start executing and rendering Manim scenes when opening a note.')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.autoRunOnOpen)
					.onChange(async (value: boolean) => {
						this.plugin.settings = {
							...this.plugin.settings,
							autoRunOnOpen: value,
						};
						await this.plugin.saveSettings();
					});
			});
	}
}

// Re-export core types and schemas for downstream module convenience
export {
	WanimPluginSettings,
	DEFAULT_SETTINGS,
	resolvePluginSettings,
	WanimEditorTheme,
	RenderQuality,
};
```

---

### B. Integration Proposal for `src/main.ts`

Diff patch proposal for `src/main.ts`:

```diff
--- a/src/main.ts
+++ b/src/main.ts
@@ -8,2 +8,3 @@
 } from './types';
+import { WanimSettingTab } from './settings';
 import { ensureRapydscriptInitialized, isRapydscriptAvailable } from './engine/rapydscriptInit';
@@ -66,3 +67,4 @@
 	async onload(): Promise<void> {
-		await this.initializeSettings();
+		await this.loadSettings();
+		this.registerSettingsTab();
 		this.initializeRapydscript();
@@ -106,4 +108,8 @@
-	private async initializeSettings(): Promise<void> {
+	async loadSettings(): Promise<void> {
 		const rawData = await this.loadData();
 		this.settings = resolvePluginSettings(rawData, DEFAULT_SETTINGS);
+	}
+
+	private registerSettingsTab(): void {
+		this.addSettingTab(new WanimSettingTab(this.app, this));
 	}
```

---

### C. Mock Extensions Proposal for `tests/mocks/obsidian.ts`

Add mock implementations of `PluginSettingTab` and `Setting` to `tests/mocks/obsidian.ts` so the automated test suite can execute headlessly:

```ts
export class PluginSettingTab {
	containerEl: HTMLElement;
	constructor(public app: unknown, public plugin: unknown) {
		this.containerEl = document.createElement('div');
	}
	display(): void {}
	hide(): void {}
}

export class Setting {
	settingEl: HTMLElement;
	infoEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;

	constructor(public containerEl: HTMLElement) {
		const doc = containerEl.ownerDocument ?? document;
		this.settingEl = doc.createElement('div');
		this.settingEl.className = 'setting-item';
		this.infoEl = doc.createElement('div');
		this.infoEl.className = 'setting-item-info';
		this.nameEl = doc.createElement('div');
		this.nameEl.className = 'setting-item-name';
		this.descEl = doc.createElement('div');
		this.descEl.className = 'setting-item-description';
		this.controlEl = doc.createElement('div');
		this.controlEl.className = 'setting-item-control';

		this.infoEl.appendChild(this.nameEl);
		this.infoEl.appendChild(this.descEl);
		this.settingEl.appendChild(this.infoEl);
		this.settingEl.appendChild(this.controlEl);
		containerEl.appendChild(this.settingEl);
	}

	setName(name: string): this {
		this.nameEl.textContent = name;
		return this;
	}

	setDesc(desc: string): this {
		this.descEl.textContent = desc;
		return this;
	}

	addDropdown(cb: (dropdown: DropdownComponentMock) => void): this {
		const dropdown = new DropdownComponentMock(this.controlEl);
		cb(dropdown);
		return this;
	}

	addText(cb: (text: TextComponentMock) => void): this {
		const text = new TextComponentMock(this.controlEl);
		cb(text);
		return this;
	}

	addToggle(cb: (toggle: ToggleComponentMock) => void): this {
		const toggle = new ToggleComponentMock(this.controlEl);
		cb(toggle);
		return this;
	}
}

export class DropdownComponentMock {
	selectEl: HTMLSelectElement;
	private changeHandler?: (value: string) => void;

	constructor(containerEl: HTMLElement) {
		const doc = containerEl.ownerDocument ?? document;
		this.selectEl = doc.createElement('select');
		containerEl.appendChild(this.selectEl);
	}

	addOption(value: string, display: string): this {
		const doc = this.selectEl.ownerDocument ?? document;
		const option = doc.createElement('option');
		option.value = value;
		option.textContent = display;
		this.selectEl.appendChild(option);
		return this;
	}

	setValue(value: string): this {
		this.selectEl.value = value;
		return this;
	}

	getValue(): string {
		return this.selectEl.value;
	}

	onChange(callback: (value: string) => void): this {
		this.changeHandler = callback;
		return this;
	}

	triggerChange(value: string): void {
		this.selectEl.value = value;
		this.changeHandler?.(value);
	}
}

export class TextComponentMock {
	inputEl: HTMLInputElement;
	private changeHandler?: (value: string) => void;

	constructor(containerEl: HTMLElement) {
		const doc = containerEl.ownerDocument ?? document;
		this.inputEl = doc.createElement('input');
		this.inputEl.type = 'text';
		containerEl.appendChild(this.inputEl);
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	getValue(): string {
		return this.inputEl.value;
	}

	onChange(callback: (value: string) => void): this {
		this.changeHandler = callback;
		return this;
	}

	triggerChange(value: string): void {
		this.inputEl.value = value;
		this.changeHandler?.(value);
	}
}

export class ToggleComponentMock {
	toggleEl: HTMLElement;
	private value = false;
	private changeHandler?: (value: boolean) => void;

	constructor(containerEl: HTMLElement) {
		const doc = containerEl.ownerDocument ?? document;
		this.toggleEl = doc.createElement('div');
		this.toggleEl.className = 'checkbox-container';
		containerEl.appendChild(this.toggleEl);
	}

	setValue(value: boolean): this {
		this.value = value;
		if (value) {
			this.toggleEl.classList.add('is-enabled');
		} else {
			this.toggleEl.classList.remove('is-enabled');
		}
		return this;
	}

	getValue(): boolean {
		return this.value;
	}

	onChange(callback: (value: boolean) => void): this {
		this.changeHandler = callback;
		return this;
	}

	triggerChange(value: boolean): void {
		this.setValue(value);
		this.changeHandler?.(value);
	}
}
```

---

## 5. Verification Method

### Concrete Verification Commands

1. **Production Build Compilation Verification**:
   ```powershell
   npm --prefix "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin" run build
   ```
   **Pass Condition**: Command exits with code 0 and zero compilation errors, generating valid `main.js`.

2. **Automated Test Suite Verification**:
   ```powershell
   npm --prefix "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin" test
   ```
   **Pass Condition**: All existing test bundles (M2, M3, M4) plus new M5 test runner exit with code 0 and 100% test assertions pass.

3. **Reference Plugin Untouched Invariant**:
   ```powershell
   git -C "C:\Users\angel\Notes" status "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin"
   ```
   **Pass Condition**: Zero modifications, deletions, or untracked files in `obsidian-manim-plugin`.

### Invalidation Conditions
- Any runtime exception or silent failure when setting invalid auto-save delay strings (e.g. `'0'`, `'999'`, `'abc'`).
- Failure of active CodeMirror 6 editor instances to update theme dynamically without losing document state or cursor position.
- Any direct mutation of reference directory `obsidian-manim-plugin`.
