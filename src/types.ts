export type WanimEditorTheme = 'obsidian' | 'github-light' | 'github-dark' | 'one-dark' | 'monokai';

export interface WanimPluginSettings {
	editorTheme: WanimEditorTheme;
	autoSaveDelaySeconds: number;
	defaultCollapsed: boolean;
	renderQuality: string;
	autoRunOnOpen: boolean;
	editorFontSize: number;
}

export interface SceneStateChange {
	isRunning: boolean;
	isPaused: boolean;
	isFinished?: boolean;
}

export interface ConstructableScene {
	construct?: () => Promise<void> | void;
	play?: (...args: any[]) => Promise<void>;
	playAll?: (...args: any[]) => Promise<void>;
	wait?: (duration?: number) => Promise<void>;
	pause?: () => void;
	resume?: () => void;
	stop?: () => void;
	dispose?: () => void;
	isPlaying?: boolean;
	isPaused?: boolean;
	onStateChange?: (listener: (state: SceneStateChange) => void) => () => void;
}

export interface ThemeableEditor {
	setEditorTheme(newTheme: WanimEditorTheme): void;
	setVimEnabled?(enabled: boolean): void;
	setEditorFontSize(fontSize: number): void;
}

export interface BlockState {
	isCollapsed: boolean;
	cursor?: { anchor: number; head: number };
	scroll?: { top: number; left: number };
	hadFocus?: boolean;
	timestamp: number;
}
