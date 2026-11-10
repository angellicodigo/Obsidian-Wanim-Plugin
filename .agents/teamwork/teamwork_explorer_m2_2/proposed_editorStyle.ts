/**
 * CodeMirror 6 base theme styling and dynamic typography synchronization.
 * Scopes custom cursor behaviors and enforces positioning invariants.
 * Adheres to R5 architectural guidelines.
 */

import { EditorView } from '@codemirror/view';

// ============================================================================
// CodeMirror 6 Base Theme Extension (Vim Cursors & Scroller Invariants)
// ============================================================================

export const wanimEditorBaseTheme = EditorView.theme({
	'&': {
		backgroundColor: 'var(--code-background, var(--background-primary))',
		color: 'var(--wanim-code-color, var(--code-normal, var(--text-normal)))',
	},
	'.cm-content': {
		caretColor: '#ffffff !important',
		tabSize: '4 !important',
	},
	'.cm-scroller': {
		position: 'relative !important',
		minHeight: '220px',
		maxHeight: '320px',
		overflow: 'auto',
	},
	'.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
		backgroundColor: 'var(--wanim-selection-color, var(--text-selection)) !important',
	},
	// Normal Mode: Bright Red Block Cursor (#f10707)
	'.cm-fat-cursor, &:not(.cm-focused) .cm-fat-cursor, &.cm-focused .cm-fat-cursor': {
		position: 'absolute !important',
		display: 'inline-block !important',
		visibility: 'visible !important',
		background: 'var(--wanim-vim-cursor-color, #f10707) !important',
		backgroundColor: 'var(--wanim-vim-cursor-color, #f10707) !important',
		color: '#ffffff !important',
		minWidth: '0.65em !important',
		border: 'none !important',
		borderLeft: 'none !important',
		outline: 'none !important',
		whiteSpace: 'pre !important',
		zIndex: '100 !important',
		opacity: '0.75 !important',
		pointerEvents: 'none !important',
	},
	// Insert Mode: Defeat outer Obsidian .cm-vimMode cascade
	'.cm-scroller:not(.cm-vimMode) .cm-cursorLayer:not(.cm-vimCursorLayer), .cm-scroller:not(.cm-vimMode) > .cm-cursorLayer': {
		display: 'block !important',
		visibility: 'visible !important',
		opacity: '1 !important',
	},
	// Suppress standard cursor layer only when in Vim Normal/Visual Mode
	'.cm-scroller.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer)': {
		display: 'none !important',
	},
	// Insert Mode: Thin White Line Cursor
	'.cm-cursor:not(.cm-fat-cursor), .cm-dropCursor': {
		display: 'block !important',
		visibility: 'visible !important',
		borderLeft: '2px solid #ffffff !important',
		borderLeftColor: '#ffffff !important',
		borderLeftWidth: '2px !important',
		width: '0 !important',
		background: 'transparent !important',
		zIndex: '100 !important',
		opacity: '1 !important',
	},
});

// ============================================================================
// Typography Synchronization Helpers (Honest Leaf Functions)
// ============================================================================

export interface TypographyProperties {
	readonly codeColor?: string;
	readonly fontFamily?: string;
	readonly fontSize?: string;
	readonly lineHeight?: string;
	readonly letterSpacing?: string;
	readonly fontWeight?: string;
	readonly selectionColor?: string;
	readonly caretColor?: string;
}

/**
 * Honest leaf function: reads computed style property safely.
 */
export function extractComputedStyleProperty(
	element: Element | null,
	property: string,
	getStyleFn: (el: Element) => CSSStyleDeclaration = getComputedStyle
): string | undefined {
	if (!(element instanceof HTMLElement)) {
		return undefined;
	}
	const value = getStyleFn(element).getPropertyValue(property).trim();
	return value.length > 0 ? value : undefined;
}

/**
 * Honest leaf function: extracts typography tokens from DOM elements.
 */
export function extractTypographyFromElements(
	contentEl: Element | null,
	selectionEl: Element | null,
	cursorEl: Element | null,
	getStyleFn: (el: Element) => CSSStyleDeclaration = getComputedStyle
): TypographyProperties {
	return {
		codeColor: extractComputedStyleProperty(contentEl, 'color', getStyleFn),
		fontFamily: extractComputedStyleProperty(contentEl, 'font-family', getStyleFn),
		fontSize: extractComputedStyleProperty(contentEl, 'font-size', getStyleFn),
		lineHeight: extractComputedStyleProperty(contentEl, 'line-height', getStyleFn),
		letterSpacing: extractComputedStyleProperty(contentEl, 'letter-spacing', getStyleFn),
		fontWeight: extractComputedStyleProperty(contentEl, 'font-weight', getStyleFn),
		selectionColor: extractComputedStyleProperty(selectionEl, 'background-color', getStyleFn),
		caretColor: extractComputedStyleProperty(cursorEl, 'border-left-color', getStyleFn),
	};
}

/**
 * Honest leaf function: maps typography property dictionary to CSS custom variables.
 * Follows {value}By{key} naming convention.
 */
export function createCssVariablesByTypography(
	props: TypographyProperties
): ReadonlyMap<string, string> {
	const variableByPropKey = new Map<string, string>();

	if (props.codeColor) variableByPropKey.set('--wanim-code-color', props.codeColor);
	if (props.fontFamily) variableByPropKey.set('--wanim-code-font-family', props.fontFamily);
	if (props.fontSize) variableByPropKey.set('--wanim-code-font-size', props.fontSize);
	if (props.lineHeight) variableByPropKey.set('--wanim-code-line-height', props.lineHeight);
	if (props.letterSpacing) variableByPropKey.set('--wanim-code-letter-spacing', props.letterSpacing);
	if (props.fontWeight) variableByPropKey.set('--wanim-code-font-weight', props.fontWeight);
	if (props.selectionColor) variableByPropKey.set('--wanim-selection-color', props.selectionColor);
	if (props.caretColor) variableByPropKey.set('--wanim-caret-color', props.caretColor);

	return variableByPropKey;
}

/**
 * Honest leaf function: applies custom properties to host element.
 */
export function applyCssCustomProperties(
	hostEl: HTMLElement,
	propertyByName: Iterable<[string, string]>
): void {
	for (const [name, value] of propertyByName) {
		hostEl.style.setProperty(name, value);
	}
}

/**
 * Imperative boundary function: synchronizes typography tokens from native Obsidian CM6 editor.
 */
export function syncTypographyFromNativeEditor(
	hostEl: HTMLElement,
	rootNode: ParentNode = document
): void {
	const nativeContent = rootNode.querySelector('.markdown-source-view.mod-cm6 .cm-editor .cm-content');
	const nativeSelection = rootNode.querySelector('.markdown-source-view.mod-cm6 .cm-editor .cm-selectionBackground');
	const nativeCursor = rootNode.querySelector('.markdown-source-view.mod-cm6 .cm-editor .cm-cursor');

	const typography = extractTypographyFromElements(nativeContent, nativeSelection, nativeCursor);
	const cssVarByName = createCssVariablesByTypography(typography);
	applyCssCustomProperties(hostEl, cssVarByName.entries());
}
