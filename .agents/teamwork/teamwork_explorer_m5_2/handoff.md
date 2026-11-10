# Milestone 5 Investigation & Architecture Report: Debounced Vault Markdown Source Persistence

**Author**: Explorer 2 (Teamwork Explorer M5-2)  
**Target File**: `src/persistence/sourcePersistence.ts`  
**Integration Points**: `src/ui/codeBlockProcessor.ts`, `src/ui/headerControls.ts`, `src/editor/editorChild.ts`  
**Reference Plugin**: `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` (Read-Only)  
**Date**: 2026-11-09  

---

## 1. Observations

### 1.1 Reference Plugin Persistence (`obsidian-manim-plugin/src/manim/sourcePersistence.ts:1-39`)
Inspection of the read-only reference plugin revealed:
```ts
function buildManimFenceFromSection(sectionText: string, code: string): string {
    const openingFence = sectionText.match(/^```manim[^\n]*/m)?.[0] ?? '```manim';
    return `${openingFence}\n${code}\n\`\`\``;
}

function replaceSectionByLineRange(fullText: string, lineStart: number, lineEnd: number, replacement: string): string {
    const lines = fullText.split('\n');
    const safeStart = Math.max(0, lineStart);
    const safeEnd = Math.max(safeStart, lineEnd);
    lines.splice(safeStart, safeEnd - safeStart + 1, ...replacement.split('\n'));
    return lines.join('\n');
}

export async function persistManimCode(plugin: Plugin, ctx: MarkdownPostProcessorContext, contextEl: HTMLElement, code: string): Promise<void> {
    const sectionInfo = ctx.getSectionInfo(contextEl);
    if (!sectionInfo) return;
    const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof TFile)) return;
    const original = await plugin.app.vault.cachedRead(file);
    const updatedSection = buildManimFenceFromSection(sectionInfo.text, code);
    const updatedDoc = replaceSectionByLineRange(original, sectionInfo.lineStart, sectionInfo.lineEnd, updatedSection);
    if (updatedDoc !== original) {
        await plugin.app.vault.modify(file, updatedDoc);
    }
}
```
**Directly Observed Vulnerabilities & Limitations in Reference Plugin**:
1. **CRLF Line-Ending Corruption**: On Windows systems where vault markdown files contain `\r\n`, splitting with `fullText.split('\n')` leaves trailing `\r` carriage returns on every line. Joining with `\n` results in mixed CRLF/LF line breaks, corrupting vault Git diffs and document formatting.
2. **Blind Line Splicing Without Boundary Verification**: `replaceSectionByLineRange` executes `lines.splice(...)` unconditionally without verifying that `lines[lineStart]` is actually an opening ```` ```manim ```` fence and `lines[lineEnd]` is a closing fence. If another block was edited or lines drifted, it destroys arbitrary markdown text in the note.
3. **No Mutex / Concurrency Lock**: If multiple blocks save or rapid edits occur, concurrent `cachedRead` -> `modify` calls clobber each other in classic read-modify-write race conditions.
4. **Hardcoded In-Editor Debounce Without Dirty State**: In `obsidian-manim-plugin/src/manim/editorChild.ts:200-210`, debounce logic was coupled directly inside the CM6 editor child, hardcoding `Saving...` immediately upon typing (even before save was executed) and lacking an `Unsaved` dirty status.
5. **No Error Recovery**: If `ctx.getSectionInfo` or `getAbstractFileByPath` returned `null`, it silently aborted with zero visual feedback or error reporting.

### 1.2 Target Plugin Architecture (`Obsidian Wanim Plugin`)
1. **`src/types.ts:16-30`**:
   `WanimPluginSettings` defines `autoSaveDelaySeconds: number` (1–300 seconds, default 60).
2. **`src/ui/headerControls.ts:27-32, 107-108, 150-156`**:
   `IndicatorStatus` currently includes `'hidden' | 'running' | 'paused' | 'saving' | 'saved'`.
   `labelByIndicatorStatus` maps these to strings: `saving: 'Saving...'`, `saved: 'Saved'`.
   `HeaderControlsController` defines `showSaving()` and `showSaved()`.
   `showSaved()` automatically schedules a 1000ms timer via `TimerService` to revert the indicator to the active execution state (`hidden`, `running`, or `paused`).
3. **`src/editor/editorChild.ts:41, 120-128, 189-195`**:
   `WanimCodeEditorChild` receives `onDocChanged?: (newCode: string) => void` in its options.
   CodeMirror 6 `EditorView.updateListener` correctly fires `onDocChanged(update.state.doc.toString())` whenever the document changes.
4. **`src/ui/codeBlockProcessor.ts:180-245`**:
   `processWanimCodeBlock` orchestrates `buildWanimBlockElements` and `createEditor`.
   Currently, `codeBlockProcessor.ts` does not instantiate or connect a persistence coordinator, leaving `onDocChanged` unconnected.

---

## 2. Logic Chain

### 2.1 Separation of Pure Computation and Boundary Mutations (R5)
- **Premise 1**: Under User Rule 1 ("Local Reasoning & Honest Functions"), core business logic must consist of pure functions reading only declared arguments and returning new values.
- **Premise 2**: Obsidian Vault operations (`vault.read`, `vault.modify`) and DOM updates (`headerControls.showSaving`) are side-effecting boundary operations.
- **Deduction 1**: We must strictly isolate the line replacement algorithm into a pure leaf function:
  `replaceCodeFence(options: ReplaceFenceOptions): ReplaceFenceResult`.
- **Deduction 2**: Line ending detection (`detectLineEnding`), line splitting (`splitLines`), line joining (`joinLines`), and fence boundary parsing (`parseOpeningFence`, `isClosingFence`) must all be pure leaf functions without external dependencies.
- **Deduction 3**: All boundary operations must interact with an explicit interface `VaultIOAdapter` rather than coupling directly to global Obsidian state, allowing 100% headless unit testing.

### 2.2 Boundary Verification Invariant
- **Premise 3**: In Obsidian markdown notes, line numbers reported by `ctx.getSectionInfo(contextEl)` can drift if lines are inserted or deleted above the block.
- **Deduction 4**: `replaceCodeFence` must verify:
  1. `lineStart >= 0` and `lineStart < lines.length`.
  2. `lineEnd >= lineStart` and `lineEnd < lines.length`.
  3. `lines[lineStart]` matches `^(\s*)(`{3,}|~{3,})(manim[^\r\n]*)` (valid opening fence).
  4. `lines[lineEnd]` matches closing fence markers.
- **Deduction 5**: If boundary verification fails, `replaceCodeFence` returns an invariant-rich failure `{ success: false, reason: 'INVALID_OPENING_FENCE' | 'INVALID_CLOSING_FENCE' | 'OUT_OF_BOUNDS' }` rather than corrupting user data.

### 2.3 Debounced Auto-Save & Visual Lifecycle Integration
- **Premise 4**: The user requires clear visual indicators for the save lifecycle:
  - User types code -> `showUnsaved()` / dirty state.
  - Debounce timer fires / save triggers -> `showSaving()`.
  - Save completes -> `showSaved()`.
  - Save fails -> `showSaveError()`.
- **Deduction 6**: Extending `IndicatorStatus` in `src/ui/headerControls.ts` with `'unsaved'` and `'save_error'` provides seamless lifecycle tracking.
- **Deduction 7**: Because existing tests in `tests/m4_test_runner.ts` test specific property values rather than `Object.keys` length, adding these two union variants is 100% backward-compatible.

### 2.4 Immediate Save Triggers & Unmount Teardown
- **Premise 5**: Debounce delays (1–300s, default 60s) mean edits spend extended time in memory before writing to disk.
- **Premise 6**: If a user runs the scene, collapses the block, switches notes, or closes the pane while the debounce timer is ticking, edits would be lost or out-of-sync unless immediately flushed.
- **Deduction 8**: We must implement an immediate explicit save trigger `flushPendingSave()` called on:
  1. **Playback action**: User clicks Run or Restart.
  2. **Collapse toggle**: User collapses the block.
  3. **Editor unmount**: `WanimCodeEditorChild.onunload()` / `editorChild.register()` teardown callback.
- **Deduction 9**: `flushPendingSave()` cancels any active timer, immediately serializes the save, and updates status indicators.

### 2.5 Concurrency Safety via Per-File Mutex Queue
- **Premise 7**: When multiple blocks exist in the same note, or when the note is open in multiple panes (e.g., Live Preview and Reading View), simultaneous `vault.modify` operations can interleave and clobber each other.
- **Deduction 10**: We provide an async queue `FileSaveQueue` keyed by `sourcePath` (`queueByFilePath`). All reads, splices, and writes for a given markdown file are strictly serialized FIFO, preventing race conditions.

---

## 3. Caveats

1. **Multi-Block Line Drift**:
   When multiple blocks exist in a note and Block 1 expands, Block 2's line numbers will shift. Explorer 2's `replaceCodeFence` detects boundary mismatches and safely rejects invalid line ranges. The recovery search algorithm (locating the shifted block) is being co-designed by Explorer 3 (`blockSplicer.ts`). Our `persistCodeFenceToVault` accepts an optional `blockSplicer` dependency injection hook to plug in Explorer 3's splicer without architectural modification.
2. **Settings Tab Integration**:
   The delay value `plugin.settings.autoSaveDelaySeconds` is configured in `src/settings.ts`, being designed by Explorer 1. Our coordinator accepts a function `getDelayMs: () => number`, dynamically reading the live setting on each edit.
3. **Live Preview Transclusions & Null SectionInfo**:
   In Obsidian, `ctx.getSectionInfo(contextEl)` returns `null` for blocks embedded inside Obsidian Canvas cards, hover tooltips, or during rapid DOM unmounting. Our coordinator handles `null` gracefully by returning a structured `SECTION_NOT_FOUND` error without throwing or corrupting state.

---

## 4. Conclusion & Concrete Architectural Design

### 4.1 Module Layout
```
src/
└── persistence/
    ├── sourcePersistence.ts    # Debounced line replacement, Vault I/O, coordinator
    └── blockSplicer.ts         # Multi-block coordination & line drift recovery (Explorer 3)
```

### 4.2 Concrete Implementation of `src/persistence/sourcePersistence.ts`

```ts
/**
 * Debounced Vault Markdown Source Persistence Engine.
 * Milestone 5: Obsidian Wanim Plugin.
 *
 * Adheres strictly to Code Generation Guidelines (R5):
 * 1. Local Reasoning & Honest Functions:
 *    - Pure leaf functions at leaves (detectLineEnding, splitLines, joinLines, parseOpeningFence, replaceCodeFence).
 *    - Push side effects (Vault file reading, Vault modification, DOM updates) to boundary functions.
 *    - Explicit dependency injection (VaultIOAdapter, TimerService, PersistenceQueue, SaveStatusNotifier).
 * 2. Single Uniform Level of Abstraction ("Stacking Bricks"):
 *    - Clear separation between string transformation, file transaction, and debounced coordination.
 * 3. Invariant-Rich Signatures:
 *    - Explicit union results (ReplaceFenceResult, PersistenceResult).
 *    - No mystery boolean flags.
 * 4. Dictionary Naming:
 *    - Follows {value}By{key} naming convention (e.g. queueByFilePath).
 */

import { MarkdownPostProcessorContext, TFile } from 'obsidian';
import { TimerService, defaultTimerService } from '../ui/headerControls';

// ============================================================================
// Types & Domain Invariants
// ============================================================================

export type LineEnding = '\r\n' | '\n';

export interface ReplaceFenceOptions {
	readonly fullText: string;
	readonly lineStart: number;
	readonly lineEnd: number;
	readonly newCode: string;
}

export type ReplaceFenceResult =
	| {
			readonly success: true;
			readonly updatedContent: string;
			readonly originalContent: string;
			readonly changed: boolean;
			readonly lineEnding: LineEnding;
	  }
	| {
			readonly success: false;
			readonly reason:
				| 'OUT_OF_BOUNDS'
				| 'INVALID_OPENING_FENCE'
				| 'INVALID_CLOSING_FENCE'
				| 'EMPTY_DOCUMENT';
			readonly details: string;
	  };

export interface FenceBoundaryAnalysis {
	readonly isValid: boolean;
	readonly indentation: string;
	readonly fenceTag: string;
	readonly fenceMarkers: string;
}

export interface VaultIOAdapter {
	getFileByPath(path: string): TFile | null;
	read(file: TFile): Promise<string>;
	modify(file: TFile, data: string): Promise<void>;
}

export interface SaveStatusNotifier {
	showUnsaved(): void;
	showSaving(): void;
	showSaved(): void;
	showSaveError(errorMessage?: string): void;
}

export interface PersistenceQueue {
	enqueue<T>(filePath: string, operation: () => Promise<T>): Promise<T>;
}

export type PersistenceResult =
	| { readonly status: 'success'; readonly changed: boolean; readonly lineEnding: LineEnding }
	| { readonly status: 'unchanged' }
	| { readonly status: 'error'; readonly error: string; readonly details?: string };

export interface PersistCodeFenceParams {
	readonly ctx: MarkdownPostProcessorContext;
	readonly contextEl: HTMLElement;
	readonly vault: VaultIOAdapter;
	readonly newCode: string;
	readonly blockSplicer?: (
		fullText: string,
		section: { lineStart: number; lineEnd: number },
		newCode: string
	) => ReplaceFenceResult;
}

export interface DebouncedSourcePersistenceOptions {
	readonly ctx: MarkdownPostProcessorContext;
	readonly contextEl: HTMLElement;
	readonly vault: VaultIOAdapter;
	readonly statusNotifier: SaveStatusNotifier;
	readonly getDelayMs: () => number;
	readonly timerService?: TimerService;
	readonly queue?: PersistenceQueue;
	readonly blockSplicer?: PersistCodeFenceParams['blockSplicer'];
	readonly onSaveSuccess?: (result: PersistenceResult) => void;
	readonly onSaveError?: (error: unknown) => void;
}

// ============================================================================
// Pure / Honest Leaf Functions
// ============================================================================

/**
 * Detects whether text utilizes Windows CRLF (\r\n) or standard Unix LF (\n).
 * Pure leaf function.
 */
export function detectLineEnding(text: string): LineEnding {
	return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * Splits text into lines, cleanly removing both \r and \n characters.
 * Pure leaf function.
 */
export function splitLines(text: string): string[] {
	return text.split(/\r?\n/);
}

/**
 * Joins lines using the specified line ending token.
 * Pure leaf function.
 */
export function joinLines(lines: readonly string[], newline: LineEnding): string {
	return lines.join(newline);
}

/**
 * Analyzes an opening fence line, extracting indentation, markers, and manim tag.
 * Pure leaf function.
 */
export function parseOpeningFence(line: string): FenceBoundaryAnalysis {
	const match = line.match(/^(\s*)(`{3,}|~{3,})(manim[^\r\n]*)/);
	if (!match) {
		return {
			isValid: false,
			indentation: '',
			fenceTag: '',
			fenceMarkers: '',
		};
	}
	const indentation = match[1] ?? '';
	const fenceMarkers = match[2] ?? '```';
	const tagSuffix = match[3] ?? 'manim';
	return {
		isValid: true,
		indentation,
		fenceTag: `${fenceMarkers}${tagSuffix}`,
		fenceMarkers,
	};
}

/**
 * Checks whether a candidate line is a valid closing fence matching fence markers.
 * Pure leaf function.
 */
export function isClosingFence(line: string, fenceMarkers: string = '```'): boolean {
	const trimmed = line.trim();
	if (!trimmed.startsWith(fenceMarkers)) {
		return false;
	}
	const markerChar = fenceMarkers[0] ?? '`';
	const markerRegex = new RegExp(`^[${markerChar}]{${fenceMarkers.length},}\\s*$`);
	return markerRegex.test(trimmed);
}

/**
 * Pure functional string replacement for a code fence block within markdown text.
 * Preserves line endings (CRLF vs LF), opening fence indentation, and fence tags.
 * Validates boundaries before splicing to guarantee zero data corruption.
 * Pure leaf function.
 */
export function replaceCodeFence(options: ReplaceFenceOptions): ReplaceFenceResult {
	const { fullText, lineStart, lineEnd, newCode } = options;

	if (fullText.length === 0) {
		return {
			success: false,
			reason: 'EMPTY_DOCUMENT',
			details: 'Document text is empty',
		};
	}

	const newline = detectLineEnding(fullText);
	const lines = splitLines(fullText);

	if (lineStart < 0 || lineStart >= lines.length) {
		return {
			success: false,
			reason: 'OUT_OF_BOUNDS',
			details: `lineStart ${lineStart} is out of bounds (document has ${lines.length} lines)`,
		};
	}

	if (lineEnd < lineStart || lineEnd >= lines.length) {
		return {
			success: false,
			reason: 'OUT_OF_BOUNDS',
			details: `lineEnd ${lineEnd} is out of bounds (lineStart=${lineStart}, document has ${lines.length} lines)`,
		};
	}

	const openingLine = lines[lineStart] ?? '';
	const fenceInfo = parseOpeningFence(openingLine);
	if (!fenceInfo.isValid) {
		return {
			success: false,
			reason: 'INVALID_OPENING_FENCE',
			details: `Line ${lineStart} is not a valid manim opening fence: "${openingLine}"`,
		};
	}

	const closingLine = lines[lineEnd] ?? '';
	if (!isClosingFence(closingLine, fenceInfo.fenceMarkers)) {
		return {
			success: false,
			reason: 'INVALID_CLOSING_FENCE',
			details: `Line ${lineEnd} is not a valid closing fence matching "${fenceInfo.fenceMarkers}": "${closingLine}"`,
		};
	}

	const replacementOpening = `${fenceInfo.indentation}${fenceInfo.fenceTag}`;
	const codeLines = newCode.length > 0 ? splitLines(newCode) : [];
	const replacementClosing = `${fenceInfo.indentation}${fenceInfo.fenceMarkers}`;

	const newBlockLines = [replacementOpening, ...codeLines, replacementClosing];

	const updatedLines = [...lines];
	const deleteCount = lineEnd - lineStart + 1;
	updatedLines.splice(lineStart, deleteCount, ...newBlockLines);

	const updatedContent = joinLines(updatedLines, newline);
	const changed = updatedContent !== fullText;

	return {
		success: true,
		updatedContent,
		originalContent: fullText,
		changed,
		lineEnding: newline,
	};
}

// ============================================================================
// Concurrency & Mutex Queue
// ============================================================================

/**
 * Asynchronous per-file serialization queue.
 * Guarantees that concurrent save operations on the same markdown file
 * are processed strictly sequentially FIFO, avoiding clobbering.
 */
export class FileSaveQueue implements PersistenceQueue {
	private readonly queueByFilePath = new Map<string, Promise<unknown>>();

	async enqueue<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
		const previous = this.queueByFilePath.get(filePath) ?? Promise.resolve();
		const current = previous.then(operation, operation);
		this.queueByFilePath.set(filePath, current);

		try {
			return await current;
		} finally {
			if (this.queueByFilePath.get(filePath) === current) {
				this.queueByFilePath.delete(filePath);
			}
		}
	}

	getActiveQueueCount(): number {
		return this.queueByFilePath.size;
	}
}

export const defaultFileSaveQueue = new FileSaveQueue();

// ============================================================================
// Vault I/O Factory Adapter
// ============================================================================

/**
 * Creates an honest VaultIOAdapter wrapping Obsidian's app.vault.
 * Pushes side-effecting vault mutations to the boundary.
 */
export function createVaultIOAdapter(vault: unknown): VaultIOAdapter {
	const v = vault as {
		getAbstractFileByPath?(path: string): unknown;
		read?(file: unknown): Promise<string>;
		modify?(file: unknown, data: string): Promise<void>;
	};

	return {
		getFileByPath: (path: string): TFile | null => {
			if (typeof v?.getAbstractFileByPath === 'function') {
				const abstract = v.getAbstractFileByPath(path);
				if (
					abstract &&
					typeof (abstract as TFile).path === 'string' &&
					(abstract as TFile).stat !== undefined
				) {
					return abstract as TFile;
				}
			}
			return null;
		},
		read: async (file: TFile): Promise<string> => {
			if (typeof v?.read === 'function') {
				return await v.read(file);
			}
			throw new Error('Vault.read is unavailable');
		},
		modify: async (file: TFile, data: string): Promise<void> => {
			if (typeof v?.modify === 'function') {
				await v.modify(file, data);
				return;
			}
			throw new Error('Vault.modify is unavailable');
		},
	};
}

// ============================================================================
// Boundary Persistence Procedure
// ============================================================================

/**
 * Executes a single atomic read-splice-modify persistence transaction.
 * Pure/impure boundary brick.
 */
export async function persistCodeFenceToVault(
	params: PersistCodeFenceParams
): Promise<PersistenceResult> {
	const { ctx, contextEl, vault, newCode, blockSplicer } = params;

	const sectionInfo = ctx.getSectionInfo(contextEl);
	if (!sectionInfo) {
		return {
			status: 'error',
			error: 'SECTION_NOT_FOUND',
			details: 'ctx.getSectionInfo returned null; element may be detached or unmounted',
		};
	}

	const file = vault.getFileByPath(ctx.sourcePath);
	if (!file) {
		return {
			status: 'error',
			error: 'FILE_NOT_FOUND',
			details: `Vault file "${ctx.sourcePath}" does not exist (renamed or deleted)`,
		};
	}

	const originalContent = await vault.read(file);

	const spliceFn =
		blockSplicer ??
		((text, sec, code) =>
			replaceCodeFence({
				fullText: text,
				lineStart: sec.lineStart,
				lineEnd: sec.lineEnd,
				newCode: code,
			}));

	const result = spliceFn(originalContent, sectionInfo, newCode);
	if (!result.success) {
		return {
			status: 'error',
			error: result.reason,
			details: result.details,
		};
	}

	if (!result.changed) {
		return { status: 'unchanged' };
	}

	await vault.modify(file, result.updatedContent);

	return {
		status: 'success',
		changed: true,
		lineEnding: result.lineEnding,
	};
}

// ============================================================================
// Debounced Source Persistence Coordinator
// ============================================================================

/**
 * Coordinates debounce timers, dirty state, visual status lifecycle,
 * and immediate flushes across editor changes.
 */
export class DebouncedSourcePersistence {
	private debounceTimerId: number | null = null;
	private pendingCode: string | null = null;
	private isDirtyState: boolean = false;
	private isSavingState: boolean = false;
	private isDisposedState: boolean = false;

	private readonly timerService: TimerService;
	private readonly queue: PersistenceQueue;

	constructor(private readonly options: DebouncedSourcePersistenceOptions) {
		this.timerService = options.timerService ?? defaultTimerService;
		this.queue = options.queue ?? defaultFileSaveQueue;
	}

	public isDirty(): boolean {
		return this.isDirtyState;
	}

	public isSaving(): boolean {
		return this.isSavingState;
	}

	public getPendingCode(): string | null {
		return this.pendingCode;
	}

	public notifyDocChanged(newCode: string): void {
		if (this.isDisposedState) {
			return;
		}

		this.pendingCode = newCode;
		this.isDirtyState = true;
		this.options.statusNotifier.showUnsaved();

		this.clearDebounceTimer();

		const delayMs = Math.max(1000, this.options.getDelayMs());
		this.debounceTimerId = this.timerService.setTimeout(() => {
			this.debounceTimerId = null;
			void this.executeSave();
		}, delayMs);
	}

	public async flushPendingSave(): Promise<PersistenceResult> {
		this.clearDebounceTimer();

		if (!this.isDirtyState || this.pendingCode === null) {
			return { status: 'unchanged' };
		}

		return await this.executeSave();
	}

	public cancel(): void {
		this.clearDebounceTimer();
	}

	public async dispose(): Promise<void> {
		if (this.isDisposedState) {
			return;
		}
		this.clearDebounceTimer();

		if (this.isDirtyState && this.pendingCode !== null) {
			await this.executeSave();
		}

		this.isDisposedState = true;
	}

	private clearDebounceTimer(): void {
		if (this.debounceTimerId !== null) {
			this.timerService.clearTimeout(this.debounceTimerId);
			this.debounceTimerId = null;
		}
	}

	private async executeSave(): Promise<PersistenceResult> {
		if (this.pendingCode === null) {
			return { status: 'unchanged' };
		}

		const codeToSave = this.pendingCode;
		this.options.statusNotifier.showSaving();
		this.isSavingState = true;

		try {
			const result = await this.queue.enqueue(this.options.ctx.sourcePath, async () => {
				return await persistCodeFenceToVault({
					ctx: this.options.ctx,
					contextEl: this.options.contextEl,
					vault: this.options.vault,
					newCode: codeToSave,
					blockSplicer: this.options.blockSplicer,
				});
			});

			if (result.status === 'success' || result.status === 'unchanged') {
				if (this.pendingCode === codeToSave) {
					this.isDirtyState = false;
					this.pendingCode = null;
				}
				this.options.statusNotifier.showSaved();
				this.options.onSaveSuccess?.(result);
				return result;
			} else {
				this.options.statusNotifier.showSaveError(result.error);
				this.options.onSaveError?.(result.error);
				return result;
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.options.statusNotifier.showSaveError(msg);
			this.options.onSaveError?.(error);
			return { status: 'error', error: msg };
		} finally {
			this.isSavingState = false;
		}
	}
}

/**
 * Convenience factory for creating a DebouncedSourcePersistence coordinator.
 */
export function createSourcePersistenceCoordinator(
	options: DebouncedSourcePersistenceOptions
): DebouncedSourcePersistence {
	return new DebouncedSourcePersistence(options);
}
```

---

### 4.3 Proposed Updates in `src/ui/headerControls.ts`
To satisfy the visual status lifecycle (`unsaved` -> `saving` -> `saved` / `save_error`), update `src/ui/headerControls.ts`:

1. **Extend `IndicatorStatus` union (Line 31)**:
```ts
export type IndicatorStatus =
	| 'hidden'
	| 'running'
	| 'paused'
	| 'unsaved'
	| 'saving'
	| 'saved'
	| 'save_error';
```
2. **Update `labelByIndicatorStatus` (Line 150)**:
```ts
export const labelByIndicatorStatus: Readonly<Record<IndicatorStatus, string>> = Object.freeze({
	hidden: '',
	running: 'Running...',
	paused: 'Paused',
	unsaved: 'Unsaved',
	saving: 'Saving...',
	saved: 'Saved',
	save_error: 'Save Failed',
});
```
3. **Add controller methods to `HeaderControlsController` interface & implementation**:
```ts
showUnsaved(): void;
showSaveError(errorMessage?: string): void;

// In HeaderControlsControllerImpl:
public showUnsaved(): void {
	this.clearHideTimer();
	this.setIndicatorStatus('unsaved');
}

public showSaveError(errorMessage?: string): void {
	this.clearHideTimer();
	this.setIndicatorStatus('save_error');
}
```

---

### 4.4 Proposed Integration in `src/ui/codeBlockProcessor.ts`
Integrate `DebouncedSourcePersistence` into `processWanimCodeBlock`:

```ts
// 1. Instantiate the persistence coordinator
const persistenceCoordinator = createSourcePersistenceCoordinator({
	ctx,
	contextEl: el,
	vault: createVaultIOAdapter(plugin.app.vault),
	statusNotifier: headerController,
	getDelayMs: () => (plugin.settings.autoSaveDelaySeconds ?? 60) * 1000,
	timerService: deps.timerService,
});

// 2. Wire immediate save flushes into header button callbacks
const elements = buildWanimBlockElements(
	el,
	initialCollapsed,
	{
		onToggleCollapse: (isCollapsed: boolean) => {
			saveBlockState(ctx, el, { isCollapsed });
			void persistenceCoordinator.flushPendingSave();
		},
		onRequestMeasure: () => {
			editorChild.requestMeasure();
		},
		onPlay: () => {
			void persistenceCoordinator.flushPendingSave();
			void execute();
		},
		onPause: () => {
			activeController?.pause();
		},
		onResume: () => {
			const currentCode = editorChild.getCode();
			if (activeController?.isPaused() && currentCode === lastRanCode) {
				activeController.resume();
			} else {
				void persistenceCoordinator.flushPendingSave();
				void execute();
			}
		},
		onRestart: () => {
			void persistenceCoordinator.flushPendingSave();
			void execute();
		},
	},
	deps
);

// 3. Pass onDocChanged callback to editorChild
const editorChild = createEditor(editorContainerEl, {
	plugin,
	ctx,
	contextEl: el,
	initialSource: source,
	theme: plugin.settings.editorTheme,
	initialBlockState: persistedState,
	onDocChanged: (newCode) => {
		persistenceCoordinator.notifyDocChanged(newCode);
	},
});

// 4. Register teardown flush to guarantee zero data loss on note switch
editorChild.register(() => {
	isBlockDisposed = true;
	void persistenceCoordinator.flushPendingSave().finally(() => {
		void persistenceCoordinator.dispose();
	});
	if (activeController) {
		activeController.dispose();
		activeController = null;
	}
	headerController.dispose();
	errorPanelController.dispose();
});
```

---

## 5. Verification Method

Automated unit and integration test suite `tests/m5_persistence_test_runner.ts` will verify all persistence guarantees:

### 5.1 Test Suite Structure
```ts
// 1. Pure String Replacement Test Vectors:
runTest('replaceCodeFence replaces code while preserving Unix LF line endings', () => { ... });
runTest('replaceCodeFence replaces code while preserving Windows CRLF line endings', () => { ... });
runTest('replaceCodeFence preserves opening fence tag variations (e.g. ```manim:high)', () => { ... });
runTest('replaceCodeFence preserves indented blocks inside list items', () => { ... });
runTest('replaceCodeFence returns changed=false when replacement code is identical', () => { ... });
runTest('replaceCodeFence safely handles Python code with backticks in docstrings', () => { ... });
runTest('replaceCodeFence rejects out-of-bounds line numbers with OUT_OF_BOUNDS error', () => { ... });
runTest('replaceCodeFence rejects non-manim opening fence with INVALID_OPENING_FENCE error', () => { ... });
runTest('replaceCodeFence rejects mismatched closing fence with INVALID_CLOSING_FENCE error', () => { ... });

// 2. Debounced Pipeline & Virtual Clock Timing:
runTest('DebouncedSourcePersistence triggers showUnsaved immediately upon edit', () => { ... });
runTest('DebouncedSourcePersistence resets timer on rapid typing and writes only once', () => { ... });
runTest('DebouncedSourcePersistence uses dynamic delay from getDelayMs()', () => { ... });
runTest('flushPendingSave cancels active timer and executes immediate persistence', () => { ... });
runTest('dispose flushes dirty edits before unmounting', () => { ... });

// 3. Concurrency & Mutex Safety:
runTest('FileSaveQueue serializes 10 concurrent writes to the same file without interleaving', () => { ... });
runTest('FileSaveQueue allows parallel saves to different file paths', () => { ... });

// 4. Error Diagnostics & Boundary Resilience:
runTest('persistCodeFenceToVault returns SECTION_NOT_FOUND when getSectionInfo is null', () => { ... });
runTest('persistCodeFenceToVault returns FILE_NOT_FOUND when file does not exist', () => { ... });
runTest('Save failure transitions indicator to showSaveError ("Save Failed") and preserves dirty state', () => { ... });
```

### 5.2 Verification Commands
Run inside `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin`:
```powershell
npm test
```
All existing tests across M2, M3, M4 and the new M5 persistence suite must pass with 0 failures.
