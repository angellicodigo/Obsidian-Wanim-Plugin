import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { oneDark } from '@codemirror/theme-one-dark';
import { Extension } from '@codemirror/state';
import type { WanimEditorTheme } from '../types';

export function getEditorThemeExtension(theme: WanimEditorTheme): Extension {
	switch (theme) {
		case 'github-light':
			return githubLight;
		case 'github-dark':
			return githubDark;
		case 'one-dark':
			return oneDark;
		case 'monokai':
			return monokai;
		case 'obsidian':
		default:
			return [];
	}
}
