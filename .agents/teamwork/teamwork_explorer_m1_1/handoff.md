# Handoff Report: Milestone 1 Scaffolding & Build Tooling Design

## 1. Observation

Direct investigation of the workspace and reference projects established the following technical facts:

### 1.1 Target vs. Reference Directory
- Target directory: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\` (currently nonexistent, cleanly isolated).
- Reference directory: `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` (remains strictly read-only and untouched; verified via `PROJECT.md:8` and `ORIGINAL_REQUEST.md:19`).
- Node.js runtime: `v24.15.0`; npm: `12.2.1`.

### 1.2 Package Availability & Subpaths
- `@wanimjs/wanim` version `0.1.3` is published on npm (`npm view @wanimjs/wanim version` returned `0.1.3`).
- Subpaths exported by `@wanimjs/wanim`:
  - `"."`: Core canvas animation library.
  - `"./bridge"`: Browser bridge exporting `runPythonOnCanvas(source, canvas, options)`.
  - `"./browser/rapydscript"`: Prebuilt RapydScript compiler (`browser/rapydscript.js`).
- Dependencies required by Wanim:
  - `"mathjax-full": "^3.2.2"`
  - `"numpy-ts": "^1.7.0"`
  - `"opentype.js": "^2.0.0"`
- Python language grammar package: `@codemirror/lang-python` version `6.2.1` (`npm view @codemirror/lang-python version` returned `6.2.1`).

### 1.3 Reference Scaffolding Analysis
- Reference `manifest.json` (`C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\manifest.json`):
  - Defines `id: "manim-plugin"`, `name: "Manim Plugin"`, `version: "1.0.0"`, `minAppVersion: "0.15.0"`, `isDesktopOnly: false`.
- Reference `package.json` (`C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\package.json`):
  - Defines `"type": "module"`, `"main": "main.js"`, `"scripts": { "dev": "node esbuild.config.mjs", "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production" }`.
- Reference `tsconfig.json` (`C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\tsconfig.json`):
  - Configures `"baseUrl": "src"`, `"module": "ESNext"`, `"target": "ES6"`, `"moduleResolution": "node"`, `"isolatedModules": true`, `"strictNullChecks": true`, `"lib": ["DOM", "ES5", "ES6", "ES7"]`.
- Reference `esbuild.config.mjs`:
  - Uses `format: "cjs"`, `target: "es2018"`, `outfile: "main.js"`, `bundle: true`.
  - Externalizes Obsidian runtime packages (`obsidian`, `electron`, `@codemirror/state`, `@codemirror/view`, etc.).

### 1.4 Survey 2 Proven Build Configurations
- Inspecting `C:\Users\angel\AppData\Local\Temp\wanim_inspect\test-plugin-build.js`:
  - `numpy-ts` contains dynamic `import("node:fs")` and `import("node:fs/promises")`; esbuild requires `external: ['node:fs', 'node:fs/promises', ...builtinModules]`.
  - Wanim SVG renderer accesses `import.meta.url` for font resolution; esbuild requires `define: { 'import.meta.url': JSON.stringify('http://localhost/') }`.
  - RapydScript IIFE references `this`; esbuild requires loading `browser/rapydscript.js` as text (`loader: 'text'`) via a custom plugin `rapydscript-as-text`.

---

## 2. Logic Chain

1. **Manifest Specification**:
   - *Observation*: Obsidian requires `id`, `name`, `version`, `minAppVersion`, and `description` in `manifest.json`.
   - *Inference*: Setting `id: "obsidian-wanim-plugin"`, `name: "Obsidian Wanim Plugin"`, `version: "1.0.0"`, `minAppVersion: "0.15.0"`, `description: "Render Python Manim animations inside Obsidian using Wanim"`, and `isDesktopOnly: false` guarantees native Obsidian recognition on desktop and tablet/mobile.

2. **Dependency & Build Script Structure**:
   - *Observation*: The user requires Python syntax highlighting in CodeMirror 6, Wanim 0.1.3 runtime, MathJax math rendering, NumPy arrays in JS, and Vim mode support.
   - *Inference*: In `package.json`:
     - Core runtime dependencies: `@wanimjs/wanim: "0.1.3"`, `numpy-ts: "^1.7.0"`, `opentype.js: "^2.0.0"`, `mathjax-full: "^3.2.2"`.
     - CodeMirror packages: `@codemirror/view: "6.38.6"`, `@codemirror/state: "6.5.0"`, `@codemirror/language: "6.12.2"`, `@codemirror/commands: "6.10.3"`, `@codemirror/autocomplete: "^6.17.0"`, `@codemirror/lang-python: "^6.2.1"`, `@replit/codemirror-vim: "^6.4.0"`, `@codemirror/theme-one-dark: "^6.1.3"`, `@uiw/codemirror-theme-github: "^4.25.8"`, `@uiw/codemirror-theme-monokai: "^4.25.8"`.
     - Dev dependencies: `obsidian: "latest"`, `esbuild: "0.25.5"`, `typescript: "^5.8.3"`, `@types/node: "^16.11.6"`, `tslib: "2.4.0"`.
     - Scripts: `"build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"`, `"dev": "node esbuild.config.mjs"`.

3. **TypeScript Configuration (`tsconfig.json`)**:
   - *Observation*: Obsidian plugins compile via esbuild into CommonJS `main.js`, while `tsc -noEmit -skipLibCheck` performs type verification.
   - *Inference*: Specifying `module: "ESNext"`, `target: "ES6"`, `moduleResolution: "node"`, `lib: ["DOM", "ES5", "ES6", "ES7", "ES2018", "ES2020"]`, `isolatedModules: true`, `strictNullChecks: true`, `allowJs: true`, and `include: ["src/**/*.ts"]` provides complete compatibility with both the Obsidian API types and modern ESNext features used by `@wanimjs/wanim`.

4. **Bundling Tooling (`esbuild.config.mjs`)**:
   - *Observation*: Obsidian does not bundle `@wanimjs/wanim`, `@codemirror/lang-python`, or `@replit/codemirror-vim` globally; only base `@codemirror/view` and `@codemirror/state` are exported.
   - *Inference*: In `esbuild.config.mjs`, all Obsidian native packages and Node builtins are marked `external`. In contrast, `@wanimjs/wanim`, `@codemirror/lang-python`, `@replit/codemirror-vim`, and theme extensions are bundled.
   - *Inference*: Injecting `rapydscript-as-text` plugin and `define: { 'import.meta.url': JSON.stringify('http://localhost/') }` prevents bundler crashes and font loading errors.

5. **Style & Namespace Isolation (`styles.css`)**:
   - *Observation*: The reference plugin uses `.manim-` prefixes.
   - *Inference*: The Wanim plugin must use `.wanim-` prefixes exclusively for all containers, header controls, canvas viewports, and error panels. The Vim cursor rules (`.cm-fat-cursor`, `.cm-vimCursorLayer`, `.cm-cursor`) must be scoped under `.wanim-code-editor` to avoid contaminating other Obsidian views.

---

## 3. Caveats

1. **RapydScript Text Loader Type**:
   - TypeScript's compiler (`tsc`) does not natively recognize importing `.js` files as text strings unless a ambient declaration module is present. A declaration file `src/declarations.d.ts` must be included:
     ```ts
     declare module "*rapydscript.js" {
         const content: string;
         export default content;
     }
     ```
2. **Directory Independence**:
   - All files must be created strictly within `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`. `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` must remain 100% untouched.
3. **No External Network Dependencies at Runtime**:
   - By bundling `@wanimjs/wanim`, NumPy-TS, MathJax, and inlined RapydScript, the generated `main.js` operates completely offline inside Obsidian with zero remote fetches.

---

## 4. Conclusion & Concrete Scaffolding Specifications

The exact file contents for Milestone 1 are specified below:

### 4.1 `manifest.json`
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\manifest.json`
```json
{
	"id": "obsidian-wanim-plugin",
	"name": "Obsidian Wanim Plugin",
	"version": "1.0.0",
	"minAppVersion": "0.15.0",
	"description": "Render Python Manim animations inside Obsidian using Wanim",
	"author": "Obsidian Wanim Team",
	"authorUrl": "https://github.com/Acfboy/Wanim",
	"fundingUrl": {},
	"isDesktopOnly": false
}
```

### 4.2 `package.json`
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\package.json`
```json
{
	"name": "obsidian-wanim-plugin",
	"version": "1.0.0",
	"description": "Render Python Manim animations inside Obsidian using Wanim",
	"main": "main.js",
	"type": "module",
	"scripts": {
		"dev": "node esbuild.config.mjs",
		"build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
		"version": "node version-bump.mjs && git add manifest.json versions.json"
	},
	"keywords": [
		"obsidian",
		"manim",
		"wanim",
		"python",
		"animation",
		"canvas"
	],
	"license": "MIT",
	"devDependencies": {
		"@types/node": "^16.11.6",
		"esbuild": "0.25.5",
		"obsidian": "latest",
		"tslib": "2.4.0",
		"typescript": "^5.8.3"
	},
	"dependencies": {
		"@codemirror/autocomplete": "^6.17.0",
		"@codemirror/commands": "6.10.3",
		"@codemirror/lang-python": "^6.2.1",
		"@codemirror/language": "6.12.2",
		"@codemirror/state": "6.5.0",
		"@codemirror/theme-one-dark": "^6.1.3",
		"@codemirror/view": "6.38.6",
		"@replit/codemirror-vim": "^6.4.0",
		"@uiw/codemirror-theme-github": "^4.25.8",
		"@uiw/codemirror-theme-monokai": "^4.25.8",
		"@wanimjs/wanim": "0.1.3",
		"mathjax-full": "^3.2.2",
		"numpy-ts": "^1.7.0",
		"opentype.js": "^2.0.0"
	}
}
```

### 4.3 `tsconfig.json`
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\tsconfig.json`
```json
{
	"compilerOptions": {
		"baseUrl": "src",
		"inlineSourceMap": true,
		"inlineSources": true,
		"module": "ESNext",
		"target": "ES6",
		"allowJs": true,
		"noImplicitAny": true,
		"noImplicitThis": true,
		"noImplicitReturns": true,
		"moduleResolution": "node",
		"importHelpers": true,
		"noUncheckedIndexedAccess": true,
		"isolatedModules": true,
		"strictNullChecks": true,
		"strictBindCallApply": true,
		"allowSyntheticDefaultImports": true,
		"useUnknownInCatchVariables": true,
		"lib": [
			"DOM",
			"ES5",
			"ES6",
			"ES7",
			"ES2018",
			"ES2020"
		]
	},
	"include": [
		"src/**/*.ts"
	]
}
```

### 4.4 `esbuild.config.mjs`
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\esbuild.config.mjs`
```javascript
import esbuild from "esbuild";
import process from "process";
import fs from "node:fs";
import { builtinModules } from "node:module";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === "production";

// esbuild plugin to inline RapydScript JS bundle as text for synchronous in-memory bootstrap
const rapydscriptAsTextPlugin = {
	name: "rapydscript-as-text",
	setup(build) {
		build.onLoad({ filter: /rapydscript\.js$/ }, async (args) => {
			const text = await fs.promises.readFile(args.path, "utf8");
			return {
				contents: text,
				loader: "text",
			};
		});
	},
};

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		"node:fs",
		"node:fs/promises",
		...builtinModules,
	],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	minify: prod,
	define: {
		"import.meta.url": JSON.stringify("http://localhost/"),
	},
	plugins: [rapydscriptAsTextPlugin],
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
```

### 4.5 `versions.json`
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\versions.json`
```json
{
	"1.0.0": "0.15.0"
}
```

### 4.6 `src/declarations.d.ts`
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\src\declarations.d.ts`
```typescript
declare module "*rapydscript.js" {
	const content: string;
	export default content;
}
```

### 4.7 Minimal Starter `src/main.ts` (For Milestone 1 Build Validation)
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\src\main.ts`
```typescript
import { Plugin } from "obsidian";

export default class ObsidianWanimPlugin extends Plugin {
	async onload(): Promise<void> {
		console.log("Loading Obsidian Wanim Plugin...");
	}

	onunload(): void {
		console.log("Unloading Obsidian Wanim Plugin...");
	}
}
```

### 4.8 `styles.css` (Namespaced Skeleton)
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\styles.css`
```css
/* ==========================================================================
   Obsidian Wanim Plugin Styles
   ========================================================================== */

.wanim-block {
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	margin: 1em 0;
	overflow: hidden;
	background-color: var(--background-primary);
	font-family: var(--font-interface);
	position: relative;
}

.wanim-block-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 6px 12px;
	background-color: var(--background-secondary);
	border-bottom: 1px solid var(--background-modifier-border);
	user-select: none;
	cursor: pointer;
}

.wanim-collapse-caret {
	display: inline-block;
	font-size: 14px;
	line-height: 1;
	cursor: pointer;
	margin-right: 8px;
	color: var(--text-muted);
}

.wanim-block-controls {
	display: flex;
	align-items: center;
	gap: 6px;
}

.wanim-control-button {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 8px;
	border-radius: 4px;
	border: 1px solid var(--background-modifier-border);
	background-color: var(--interactive-normal);
	color: var(--text-normal);
	cursor: pointer;
	font-size: var(--font-ui-smaller);
	line-height: 1.2;
}

.wanim-control-button:hover {
	background-color: var(--interactive-hover);
}

.wanim-save-state {
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	margin-left: 8px;
}

/* CodeMirror 6 Editor Container */
.wanim-code-editor {
	position: relative;
	width: 100%;
}

.wanim-code-editor .cm-scroller {
	position: relative !important;
	min-height: 220px;
	max-height: 320px;
	overflow: auto;
}

.wanim-code-editor .cm-content {
	tab-size: 4 !important;
	font-family: var(--font-monospace);
}

/* Normal Mode Bright Red Block Cursor */
.cm-fat-cursor,
.wanim-code-editor .cm-fat-cursor,
.wanim-code-editor .cm-editor .cm-fat-cursor {
	display: inline-block !important;
	visibility: visible !important;
	position: absolute !important;
	background: #f10707 !important;
	background-color: #f10707 !important;
	color: #ffffff !important;
	min-width: 0.65em !important;
	border: none !important;
	outline: none !important;
	white-space: pre !important;
	z-index: 100 !important;
	opacity: 0.75 !important;
	pointer-events: none !important;
}

.wanim-code-editor .cm-vimCursorLayer {
	display: block !important;
	visibility: visible !important;
	position: absolute !important;
	top: 0 !important;
	left: 0 !important;
	z-index: 100 !important;
	pointer-events: none !important;
}

/* Insert Mode Thin White Line Cursor */
.wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer {
	display: block !important;
	visibility: visible !important;
	opacity: 1 !important;
}

.wanim-code-editor .cm-scroller.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer) {
	display: none !important;
}

.wanim-code-editor .cm-cursor:not(.cm-fat-cursor) {
	display: block !important;
	visibility: visible !important;
	border-left: 2px solid #ffffff !important;
	border-left-width: 2px !important;
	border-left-color: #ffffff !important;
	width: 0 !important;
	background: transparent !important;
	z-index: 100 !important;
	opacity: 1 !important;
}

.wanim-code-editor .cm-selectionBackground {
	background-color: var(--text-selection) !important;
}

/* 16:9 Canvas Viewport */
.wanim-canvas-container {
	width: 100%;
	aspect-ratio: 16 / 9;
	display: flex;
	justify-content: center;
	align-items: center;
	background-color: #000000;
	overflow: hidden;
	border-radius: 0 0 4px 4px;
}

.wanim-canvas {
	width: 100%;
	height: 100%;
	object-fit: contain;
	display: block;
}

/* Red Error Panel */
.wanim-error-panel {
	margin: 0;
	padding: 8px 12px;
	background: color-mix(in srgb, var(--color-red) 12%, var(--background-primary));
	border-top: 1px solid var(--color-red);
	color: var(--text-error, var(--color-red));
	font-family: var(--font-monospace);
	font-size: var(--font-ui-smaller);
	white-space: pre-wrap;
	max-height: 220px;
	overflow: auto;
	display: none;
}
```

---

## 5. Verification Method

Once implemented by the builder agent, Milestone 1 can be independently verified via the following steps:

1. **Scaffolding Creation Verification**:
   - Check directory existence:
     ```powershell
     Test-Path "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
     ```
   - Verify `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `versions.json`, and `styles.css` exist in the target folder.

2. **Reference Isolation Verification**:
   - Verify zero modifications to the reference plugin:
     ```powershell
     Get-ChildItem -Path "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin" -Recurse | Select-Object FullName, LastWriteTime
     ```

3. **Dependency Installation Verification**:
   - Run inside target directory:
     ```powershell
     cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
     npm install
     ```
   - Verify exit code 0 and presence of `node_modules/@wanimjs/wanim` and `node_modules/@codemirror/lang-python`.

4. **Production Build Compilation**:
   - Run inside target directory:
     ```powershell
     cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
     npm run build
     ```
   - Verify `main.js` is generated without error.
   - Verify `main.js` is non-empty and contains the esbuild banner.

5. **Invalidation Conditions**:
   - Build fails if `node:fs` is not marked external.
   - Build fails if `import.meta.url` is not defined.
   - Any modification or deletion of files inside `obsidian-manim-plugin` constitutes immediate failure.
