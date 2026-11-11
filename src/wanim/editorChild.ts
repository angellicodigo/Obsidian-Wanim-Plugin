import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from '@codemirror/commands';
import { defaultHighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { Compartment, EditorState, Extension } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, keymap } from '@codemirror/view';
import { vim } from '@replit/codemirror-vim';
import { MarkdownPostProcessorContext, MarkdownRenderChild, Plugin } from 'obsidian';
import { wanimEditorTheme } from './editorStyle';
import { getEditorThemeExtension } from './editorThemes';
import { persistWanimCode } from './sourcePersistence';
import type { WanimEditorTheme } from '../types';
import { saveBlockState } from './stateStore';
import type { BlockState } from '../types';

export function isVimEnabled(plugin: Plugin): boolean {
	const app = plugin.app as any;
	if (typeof app?.vault?.getConfig === 'function') {
		const val = app.vault.getConfig('vimMode');
		if (typeof val === 'boolean') {
			return val;
		}
	}
	if (typeof app?.vault?.config?.vimMode === 'boolean') {
		return app.vault.config.vimMode;
	}
	if (typeof app?.isVimEnabled === 'function') {
		return Boolean(app.isVimEnabled());
	}
	if (
		typeof (app as any)?.internalPlugins?.plugins?.['editor']?.instance?.options?.vimMode === 'boolean'
	) {
		return Boolean((app as any).internalPlugins.plugins['editor'].instance.options.vimMode);
	}
	return Boolean((window as any)?.CodeMirrorAdapter?.Vim);
}

export class WanimCodeEditorChild extends MarkdownRenderChild {
	private editorView: EditorView | null = null;
	private saveTimer: number | null = null;
	private hideSavedTimer: number | null = null;
	private themeCompartment = new Compartment();
	private vimCompartment = new Compartment();
	private editorFontSize: number = 14;
	private fontSizeCompartment = new Compartment();

	constructor(
		private readonly plugin: Plugin,
		private readonly ctx: MarkdownPostProcessorContext,
		private readonly contextEl: HTMLElement,
		private readonly editorHostEl: HTMLElement,
		private readonly initialSource: string,
		private readonly saveStateEl: HTMLElement,
		private readonly theme: WanimEditorTheme,
		private readonly savedState?: BlockState,
	) {
		super(editorHostEl);
	}

	onload(): void {
		const vimActive = isVimEnabled(this.plugin);

		const extensions: Extension[] = [
			this.vimCompartment.of(vimActive ? vim() : []),
			history(),
			drawSelection(),
			highlightActiveLine(),
			closeBrackets(),
			wanimEditorTheme,
			this.themeCompartment.of(getEditorThemeExtension(this.theme)),
			this.fontSizeCompartment.of(EditorView.theme({
				'.cm-content': {
					fontSize: `${this.editorFontSize}px`,
				},
			})),
			python(),
			syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
			EditorView.lineWrapping,
			EditorState.tabSize.of(4),
			indentUnit.of('    '),
			keymap.of([indentWithTab, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					this.scheduleSave();
				}
				if (update.selectionSet || update.docChanged) {
					this.recordCurrentState();
				}
			}),
		];

		let initialSelection = undefined;
		if (this.savedState?.cursor) {
			const maxPos = this.initialSource.length;
			const anchor = Math.max(0, Math.min(this.savedState.cursor.anchor, maxPos));
			const head = Math.max(0, Math.min(this.savedState.cursor.head, maxPos));
			initialSelection = { anchor, head };
		}

		const state = EditorState.create({
			doc: this.initialSource,
			selection: initialSelection,
			extensions,
		});

		this.editorView = new EditorView({
			state,
			parent: this.editorHostEl,
		});
		this.editorView.dom.classList.add('cm-s-obsidian');

		// Apply initial font size from settings
		this.editorFontSize = (this.plugin as any).settings.editorFontSize ?? 14;
		this.setEditorFontSize(this.editorFontSize);

		this.editorView.scrollDOM.addEventListener('scroll', () => {
			this.recordCurrentState();
		}, { passive: true });

		if (this.savedState?.scroll) {
			const { top, left } = this.savedState.scroll;
			requestAnimationFrame(() => {
				if (this.editorView) {
					this.editorView.scrollDOM.scrollTop = top;
					this.editorView.scrollDOM.scrollLeft = left;
				}
			});
		}

		if (this.savedState?.hadFocus) {
			requestAnimationFrame(() => {
				if (this.editorView && !this.editorView.hasFocus) {
					this.editorView.focus();
				}
			});
		}

		this.plugin.registerDomEvent(this.editorHostEl, 'pointerdown', () => {
			if (this.editorView && !this.editorView.hasFocus) {
				this.editorView.focus();
			}
			this.recordCurrentState();
		});

		// FIX: Ctrl+/ (Mod-/) commenting bug.
		// Obsidian listens at the document/window level for Mod+/ and inserts its
		// own %% comment syntax, which prevents CodeMirror from handling the event.
		// Strategy: capture-phase listener on the editor host AND document runs before
		// Obsidian's handler. We manually invoke CM's toggleComment command
		// on the view, then preventDefault + stopPropagation to fully consume the event.
		const handleCommentShortcut = (evt: KeyboardEvent) => {
			const isMod = evt.ctrlKey || evt.metaKey;
			if (!isMod || evt.key !== '/') return;
			if (!this.editorView) return;
			evt.preventDefault();
			evt.stopPropagation();
			// Dispatch the toggle-comment command directly on the editor view.
			// toggleComment is part of defaultKeymap (Mod-/); calling it here ensures
			// Python # line comments are used even when Obsidian intercepts first.
			(toggleComment as any)(this.editorView);
		};
		this.editorHostEl.addEventListener('keydown', handleCommentShortcut, true);
		// Document-level fallback: Obsidian may intercept Mod+/ at document level
		// before the event reaches editorHostEl.
		document.addEventListener('keydown', handleCommentShortcut, true);
		this.register(() => {
			this.editorHostEl.removeEventListener('keydown', handleCommentShortcut, true);
			document.removeEventListener('keydown', handleCommentShortcut, true);
		});

		(this.plugin as any).registerActiveEditor?.(this);
	}

	onunload(): void {
		this.recordCurrentState();
		(this.plugin as any).unregisterActiveEditor?.(this);
		if (this.saveTimer !== null) {
			window.clearTimeout(this.saveTimer);
		}
		if (this.hideSavedTimer !== null) {
			window.clearTimeout(this.hideSavedTimer);
		}
		this.editorView?.destroy();
		this.editorView = null;
	}

	recordCurrentState(forceCollapsed?: boolean): void {
		if (!this.editorView) return;
		const sel = this.editorView.state.selection.main;
		const scroll = {
			top: this.editorView.scrollDOM.scrollTop,
			left: this.editorView.scrollDOM.scrollLeft,
		};
		const hadFocus = this.editorView.hasFocus;
		saveBlockState(this.ctx, this.contextEl, {
			cursor: { anchor: sel.anchor, head: sel.head },
			scroll,
			hadFocus,
			...(forceCollapsed !== undefined ? { isCollapsed: forceCollapsed } : {}),
		});
	}

	setEditorTheme(newTheme: WanimEditorTheme): void {
		if (this.editorView) {
			this.editorView.dispatch({
				effects: this.themeCompartment.reconfigure(getEditorThemeExtension(newTheme)),
			});
		}
	}

	setVimEnabled(enabled: boolean): void {
		if (this.editorView) {
			this.editorView.dispatch({
				effects: this.vimCompartment.reconfigure(enabled ? vim() : []),
			});
		}
	}

	setEditorFontSize(fontSize: number): void {
		if (this.editorView) {
			this.editorFontSize = fontSize;
			this.editorView.dispatch({
				effects: this.fontSizeCompartment.reconfigure(EditorView.theme({
					'.cm-content': {
						fontSize: `${fontSize}px`,
					},
				})),
			});
		}
	}

	getCode(): string {
		return this.editorView?.state.doc.toString() ?? this.initialSource;
	}

	requestMeasure(): void {
		this.editorView?.requestMeasure();
	}

	async flushPendingSave(): Promise<void> {
		if (this.saveTimer !== null) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		await this.persistChanges();
	}

	private setSaveState(text: string): void {
		this.saveStateEl.textContent = text;
		this.saveStateEl.style.display = text ? 'inline-block' : 'none';
	}

	private scheduleSave(): void {
		this.setSaveState('Saving...');
		if (this.saveTimer !== null) {
			window.clearTimeout(this.saveTimer);
		}
		const delayMs = ((this.plugin as any).settings.autoSaveDelaySeconds ?? 60) * 1000;
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.persistChanges();
		}, delayMs);
	}

	private async persistChanges(): Promise<void> {
		this.recordCurrentState();
		await persistWanimCode(this.plugin, this.ctx, this.contextEl, this.getCode());
		this.setSaveState('Saved');
		if (this.hideSavedTimer !== null) {
			window.clearTimeout(this.hideSavedTimer);
		}
		this.hideSavedTimer = window.setTimeout(() => {
			this.hideSavedTimer = null;
			this.setSaveState('');
		}, 1000);
	}
}
