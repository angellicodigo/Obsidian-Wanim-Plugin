import { EditorView } from '@codemirror/view';

export const wanimEditorTheme = EditorView.theme({
	'&': {
		backgroundColor: 'var(--code-background, var(--background-primary))',
	},
	'.cm-content': {
		caretColor: '#ffffff !important',
	},
	'.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
		backgroundColor: 'var(--wanim-selection-color, var(--text-selection)) !important',
	},
	'.cm-fat-cursor, &:not(.cm-focused) .cm-fat-cursor, &.cm-focused .cm-fat-cursor': {
		position: 'absolute',
		display: 'inline-block !important',
		visibility: 'visible !important',
		background: 'var(--wanim-vim-cursor-color, #f10707) !important',
		backgroundColor: 'var(--wanim-vim-cursor-color, #f10707) !important',
		color: '#ffffff !important',
		minWidth: '0.65em !important',
		border: 'none !important',
		borderLeft: 'none !important',
		outline: 'none !important',
		whiteSpace: 'pre',
		zIndex: '100 !important',
		opacity: '0.75 !important',
		pointerEvents: 'none !important',
	},
	'.cm-scroller:not(.cm-vimMode) .cm-cursorLayer:not(.cm-vimCursorLayer), .cm-scroller:not(.cm-vimMode) > .cm-cursorLayer': {
		display: 'block !important',
		visibility: 'visible !important',
	},
	'.cm-scroller.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer)': {
		display: 'none !important',
	},
	'.cm-cursor:not(.cm-fat-cursor), .cm-dropCursor': {
		display: 'block !important',
		visibility: 'visible !important',
		borderLeft: '2px solid #ffffff !important',
		borderLeftColor: '#ffffff !important',
		borderLeftWidth: '2px !important',
		zIndex: '100 !important',
		opacity: '1 !important',
	},
});

function setVarFromComputed(host: HTMLElement, name: string, element: Element | null, property: string): void {
	if (!(element instanceof HTMLElement)) {
		return;
	}
	const value = getComputedStyle(element).getPropertyValue(property);
	if (value.trim()) {
		host.style.setProperty(name, value);
	}
}

export function syncStylesFromNativeCodeMirror(hostEl: HTMLElement): void {
	// Mirror typography/colors from the currently visible native CM6 editor.
	const nativeContent = document.querySelector('.markdown-source-view.mod-cm6 .cm-editor .cm-content');
	const nativeSelection = document.querySelector('.markdown-source-view.mod-cm6 .cm-editor .cm-selectionBackground');
	const nativeCursor = document.querySelector('.markdown-source-view.mod-cm6 .cm-editor .cm-cursor');

	setVarFromComputed(hostEl, '--wanim-code-color', nativeContent, 'color');
	setVarFromComputed(hostEl, '--wanim-code-font-family', nativeContent, 'font-family');
	setVarFromComputed(hostEl, '--wanim-code-font-size', nativeContent, 'font-size');
	setVarFromComputed(hostEl, '--wanim-code-line-height', nativeContent, 'line-height');
	setVarFromComputed(hostEl, '--wanim-code-letter-spacing', nativeContent, 'letter-spacing');
	setVarFromComputed(hostEl, '--wanim-code-font-weight', nativeContent, 'font-weight');
	setVarFromComputed(hostEl, '--wanim-selection-color', nativeSelection, 'background-color');
	setVarFromComputed(hostEl, '--wanim-caret-color', nativeCursor, 'border-left-color');
}
