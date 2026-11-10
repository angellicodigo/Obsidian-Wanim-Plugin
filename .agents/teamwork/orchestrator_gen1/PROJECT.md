# Project: Obsidian Wanim Plugin

## Architecture
The Obsidian Wanim Plugin recreates the Obsidian Manim Plugin using Wanim (https://github.com/Acfboy/Wanim) with Python syntax in CodeMirror 6 instead of TypeScript. It runs directly inside Obsidian (desktop and mobile) using an in-browser Python AST-to-JS compiler (RapydScript) and HTML5 Canvas2D rendering.

### Module Boundaries & Directory Layout
Target directory: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`
The reference plugin `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` remains completely untouched.

```
Obsidian Wanim Plugin/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── styles.css
├── src/
│   ├── main.ts                     # Plugin lifecycle, settings registration, vim sync listener
│   ├── settings.ts                 # Settings interface, default values, SettingsTab
│   ├── types.ts                    # Invariant-rich types and domain interfaces
│   ├── editor/
│   │   ├── editorChild.ts          # MarkdownRenderChild hosting CodeMirror 6 Python editor
│   │   ├── editorThemes.ts         # Theme mapping: Obsidian, GitHub Light/Dark, One Dark, Monokai
│   │   ├── editorStyle.ts          # CM6 theme extensions, Vim cursor rules, font sync
│   │   ├── vimIntegration.ts       # Obsidian Vim mode detection, sync, and compartment config
│   │   └── stateStore.ts           # Block state cache (collapse, cursor, scroll) across renders
│   ├── engine/
│   │   ├── wanimBridge.ts          # Bridge to @wanimjs/wanim runPythonOnCanvas
│   │   ├── rapydscriptInit.ts      # Synchronous RapydScript compiler bootstrap
│   │   ├── pausableScheduler.ts    # Frame scheduler supporting play, pause, resume, restart, abort
│   │   └── errorFormatter.ts       # Compilation errors & traceback formatting for red panel
│   ├── ui/
│   │   ├── codeBlockProcessor.ts   # Markdown code block processor for tag 'manim'
│   │   ├── headerControls.ts       # Run/Pause, Restart, Caret toggle, Save status indicator
│   │   └── errorPanel.ts           # Red error panel DOM component
│   └── persistence/
│       ├── sourcePersistence.ts    # Debounced line replacement in vault markdown file
│       └── lineRangeCalculator.ts  # Robust code fence section slicing
└── tests/
    ├── e2e_harness.ts              # E2E test runner for build, engine, editor, persistence
    └── test_scenes.ts              # Tier 1-4 Manim Community test scenes
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Plugin Scaffolding | Complete npm project in target dir, manifest.json, package.json, tsconfig.json | M1 | R1 |
| 2 | Build Tooling & RapydScript Bundling | esbuild config with RapydScript text loader, CommonJS bundle, no external downloads | M1 | R1, Survey 2 |
| 3 | Reference Directory Isolation | Ensure obsidian-manim-plugin is strictly read-only and untouched | M1 | R1 |
| 4 | CSS Styling & Namespace Isolation | styles.css with `.wanim-` prefix for all classes, zero style leakage | M1 | Survey 1, Survey 3 |
| 5 | CM6 Python Editor | CodeMirror 6 configured with @codemirror/lang-python | M2 | R2 |
| 6 | 4-Space Tab Indentation | tabSize: 4, indentUnit: 4 spaces, indentWithTab keymap | M2 | R2 |
| 7 | Dynamic Vim Mode Detection | Multi-tier detection of Obsidian's vimMode setting | M2 | R2, Survey 3 |
| 8 | Dynamic Vim Mode Synchronization | Reconfigures Vim compartment on vault config-changed event | M2 | R2, Survey 3 |
| 9 | Vim Cursor Styling | Exact bright red block cursor (#f10707) in Normal mode, thin white line in Insert mode | M2 | R2 |
| 10 | Editor Themes | Support for Obsidian, GitHub Light, GitHub Dark, One Dark, Monokai | M2 | R4 |
| 11 | Wanim 0.1.3 Integration | Bundle @wanimjs/wanim/bridge and runPythonOnCanvas | M3 | R3 |
| 12 | RapydScript Bootstrap | In-memory synchronous RapydScript initialization | M3 | Survey 2 |
| 13 | 16:9 Responsive Canvas | Responsive HTML5 canvas maintaining 16:9 aspect ratio across resolutions | M3 | R3 |
| 14 | Render Quality Support | Support -ql (480p), -qm (720p default), -qh (1080p), -q4k | M3 | R4 |
| 15 | Pausable Playback Scheduler | Pause and resume animations smoothly without resetting state | M3 | R3, Survey 2 |
| 16 | Markdown Code Block Processor | Register code block processor for tag ```manim | M4 | R2, R3 |
| 17 | Header Controls & Icons | Run/Pause button, Restart button, collapse caret (▾ / ▸), save status indicator | M4 | R3 |
| 18 | Collapse / Expand Toggle | Caret toggles code editor visibility, updates aria-label, triggers measure | M4 | R3, Survey 1 |
| 19 | Red Error Panel | Formats compilation errors (caret pointer) and runtime tracebacks, toggle visibility | M4 | R3 |
| 20 | Plugin Settings Tab | Settings tab with theme, auto-save delay, default collapsed, quality, auto-run | M5 | R4 |
| 21 | Debounced Auto-Save | Debounced auto-save (1-300s, default 60s) with 'Saving...' -> 'Saved' indicator | M5 | R4 |
| 22 | Vault File Splicing | Slices exact fence range via getSectionInfo and modifies markdown cleanly | M5 | R4, Survey 1 |
| 23 | Block State Preservation | Restores collapsed state, cursor position, and scroll offsets across re-renders | M5 | Survey 1, Survey 3 |
| 24 | Architectural Integrity (R5) | Local reasoning, honest functions, 1 level of abstraction, {value}By{key} naming | M1-M6 | R5 |
| 25 | Automated Testing Suite | Test harness verifying build output, transpilation bridge, and file persistence | M6 | R6 |
| 26 | Manim Community Scene Validation | Exercise standard shapes, transforms, and community example scenes | M6 | R6 |
| 27 | Simulated User Interactive Trials | Verify scene execution, pause/restart, settings change, and persistence | M6 | R6 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Plugin Scaffolding & Build Tooling | Directory setup, manifest, package.json, tsconfig, esbuild, styles skeleton, isolated build | none | DONE |
| M2 | CM6 Python Editor & Vim Synchronization | CodeMirror 6 Python editor, 4-space tab indentation, dynamic Vim mode sync, cursor styling | M1 | IN_PROGRESS |
| M3 | Wanim Execution Engine & Canvas Bridge | @wanimjs/wanim bridge, RapydScript bootstrap, canvas 16:9 scaling, pausable scheduler | M1 | PLANNED |
| M4 | UI Header Controls & Error Panel | Markdown code block processor, header controls, Run/Pause/Restart, collapse caret, error panel | M2, M3 | PLANNED |
| M5 | Settings Tab & Vault Source Persistence | SettingsTab (5 options), debounced vault markdown persistence, state preservation | M4 | PLANNED |
| M6 | Automated Testing & Simulated User Validation | Automated test harness, Manim Community scenes, simulated user workflow, bug patching | M5 | PLANNED |

## Interface Contracts
### `WanimPluginSettings`
```ts
export interface WanimPluginSettings {
    editorTheme: 'obsidian' | 'github-light' | 'github-dark' | 'one-dark' | 'monokai';
    autoSaveDelaySeconds: number; // 1-300, default 60
    defaultCollapsed: boolean;     // default false
    renderQuality: '-ql' | '-qm' | '-qh' | '-q4k'; // default '-qm'
    autoRunOnOpen: boolean;       // default true
}
```

### `WanimBlockState`
```ts
export interface WanimBlockState {
    isCollapsed: boolean;
    cursorAnchor: number;
    cursorHead: number;
    scrollTop: number;
    scrollLeft: number;
    hadFocus: boolean;
    timestamp: number;
}
```

### `WanimExecutionController`
```ts
export interface WanimExecutionController {
    play(): Promise<void>;
    pause(): void;
    resume(): void;
    restart(): Promise<void>;
    stop(): void;
    dispose(): void;
    isRunning(): boolean;
    isPaused(): boolean;
}
```

### `WanimRunOptions`
```ts
export interface WanimRunOptions {
    source: string;
    canvas: HTMLCanvasElement;
    quality: string;
    onSceneReady?: (scene: unknown) => void;
    signal?: AbortSignal;
}
```

## Code Layout
- Working Directory: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin`
- Reference Directory (READ-ONLY): `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin`
- Source files under `src/`, styles in `styles.css`, config files at root of `Obsidian Wanim Plugin`.
- Zero files created, modified, or deleted in `obsidian-manim-plugin`.
