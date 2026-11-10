# Handoff Report: Build Pipeline & `esbuild.config.mjs` Design for Obsidian Wanim Plugin

## 1. Observation

Direct investigation of the workspace, `@wanimjs/wanim@0.1.3`, reference configurations, and live esbuild test runs established the following concrete technical observations:

### 1.1 Reference Plugin Build Architecture
- Examining `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\esbuild.config.mjs`:
  - Format: `"cjs"`, target: `"es2018"`, entry point: `"src/main.ts"`, outfile: `"main.js"`, bundle: `true`.
  - Externalized packages:
    - `"obsidian"`
    - `"electron"`
    - `@codemirror/*`: `@codemirror/autocomplete`, `@codemirror/collab`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lint`, `@codemirror/search`, `@codemirror/state`, `@codemirror/view`
    - `@lezer/*`: `@lezer/common`, `@lezer/highlight`, `@lezer/lr`
    - `...builtinModules`
  - Non-externalized (bundled) packages in reference plugin:
    - `@replit/codemirror-vim`
    - CM6 theme packages (`@codemirror/theme-one-dark`, `@uiw/codemirror-theme-github`, `@uiw/codemirror-theme-monokai`)
    - `manim-web` and `sucrase`
  - In `obsidian-manim-plugin\package.json`:
    - `"scripts": { "dev": "node esbuild.config.mjs", "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production" }`.

### 1.2 Node Builtin Modules & Prefix Mismatch
- Node.js runtime inspection:
  - `const { builtinModules } = require('node:module');`
  - Evaluated: `builtinModules.includes('node:fs') === false`.
  - The array `builtinModules` contains bare module identifiers (`"fs"`, `"path"`, `"crypto"`), but **not** the modern URI schemes (`"node:fs"`, `"node:fs/promises"`, `"node:path"`).
  - In `numpy-ts@1.7.0` (`dist/numpy-ts.browser.js`), dynamic imports explicitly execute:
    - `import("node:fs")`
    - `import("node:fs/promises")`
  - In esbuild, when `platform: "browser"` is set without explicit `"node:fs"` and `"node:fs/promises"` (or `"node:*"`) in `external`, the build terminates with:
    ```
    X [ERROR] Could not resolve "node:fs"
    X [ERROR] Could not resolve "node:fs/promises"
    ```
  - Direct test verified that defining `external: ['node:*', ...builtinModules, ...builtinModules.map(m => `node:${m}`)]` completely resolves this error.

### 1.3 Font URL Resolution & `import.meta.url` Shim
- In `@wanimjs/wanim@0.1.3`:
  - `dist/mobject/text/pango/svg-renderer.js` executes:
    `new URL("./fonts/DejaVuSans.ttf", import.meta.url)`
  - `browser/wanim-element.browser.js` executes:
    `new URL(n, import.meta.url).href`
  - In CommonJS bundles (`format: "cjs"`), `import.meta.url` is `undefined`.
  - When `new URL(path, undefined)` runs in V8/Chromium, it throws:
    `TypeError: Invalid URL`
  - Adding `define: { "import.meta.url": JSON.stringify("http://localhost/") }` replaces all occurrences of `import.meta.url` at compile time with `"http://localhost/"`.
  - `new URL("./fonts/DejaVuSans.ttf", "http://localhost/")` produces `http://localhost/fonts/DejaVuSans.ttf` without throwing any error in browser, Electron, or headless Node environments.

### 1.4 RapydScript In-Memory Bundling & Synchronous Initialization
- Inspecting `@wanimjs/wanim/browser/rapydscript.js`:
  - Size: 1,486,837 bytes (~1.48 MB).
  - Line 2: `(function(external_namespace) {`
  - Line 469-470:
    ```js
    external_namespace.RapydScript = namespace;
    })(this);
    ```
  - In strict CommonJS / ESM, top-level `this` is `undefined`.
  - If bundled directly as an imported JavaScript module, `(function(external_namespace) { ... })(this)` passes `undefined`, throwing:
    `TypeError: Cannot set properties of undefined (setting 'RapydScript')`
  - `@wanimjs/wanim/py2js` requires `globalThis.RapydScript.compile`.
  - Live execution verified:
    - An esbuild plugin matching `filter: /[/\\]rapydscript\.js$/` with `loader: 'text'` embeds the entire compiler source as a raw JavaScript string literal.
    - Evaluating the string via:
      ```ts
      const init = new Function('external_namespace', rapydscriptSource);
      init.call(globalThis, globalThis);
      ```
      synchronously sets `globalThis.RapydScript` in <15ms.
    - Verified via test run: `typeof globalThis.RapydScript.compile === "function"`.
    - Live minification test (`minify: true`) verified: Because `rapydscriptSource` is embedded as a string literal, esbuild's minifier does **not** alter or mangle internal identifier names inside RapydScript. The minified bundle executed with 0 errors (`bundle-minified-test.js`, file size 7,724,597 bytes).

### 1.5 CodeMirror Packaging in Obsidian
- Obsidian provides CM6 base packages at runtime:
  - `@codemirror/autocomplete`, `@codemirror/collab`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lint`, `@codemirror/search`, `@codemirror/state`, `@codemirror/view`, `@lezer/common`, `@lezer/highlight`, `@lezer/lr`.
  - Marking these `external` delegates their resolution to Obsidian's runtime instances.
- Obsidian does **NOT** provide:
  - `@codemirror/lang-python`: Must be bundled into `main.js`.
  - `@replit/codemirror-vim`: Must be bundled into `main.js`.
  - Theme packages (`@codemirror/theme-one-dark`, `@uiw/codemirror-theme-github`, `@uiw/codemirror-theme-monokai`): Must be bundled into `main.js`.
  - `@wanimjs/wanim`, `mathjax-full`, `numpy-ts`, `opentype.js`: Must be bundled into `main.js`.

---

## 2. Logic Chain

1. **Obsidian Plugin CommonJS Format Requirement**:
   - *Observation*: Obsidian plugin loader expects plugins in CommonJS format (`main.js` with `module.exports = ...`).
   - *Logic*: `esbuild.config.mjs` must specify `format: "cjs"`, `outfile: "main.js"`, and `target: "es2018"`.

2. **Browser Platform Selection for Subpath Exports**:
   - *Observation*: `@wanimjs/wanim` package.json defines conditional exports:
     ```json
     "browser": "./browser/wanim.browser.js",
     "exports": {
       "./bridge": {
         "browser": "./browser/bridge.browser.js",
         "default": "./browser/bridge.browser.js"
       }
     }
     ```
   - *Logic*: Setting `platform: "browser"` in esbuild ensures esbuild selects the browser-compatible entry points of `@wanimjs/wanim` and `numpy-ts`.

3. **Node Externals Resolution Under `platform: "browser"`**:
   - *Observation*: When `platform: "browser"` is set, esbuild rejects Node builtins unless declared external. `numpy-ts` contains dynamic imports of `"node:fs"` and `"node:fs/promises"`. Node's `builtinModules` lacks the `"node:"` prefix.
   - *Logic*: Declaring `external: ['node:*', ...builtinModules, ...builtinModules.map(m => `node:${m}`)]` prevents esbuild from trying to resolve Node filesystem modules while maintaining browser bundling integrity.

4. **Self-Contained Offline RapydScript Initialization**:
   - *Observation*: Loading RapydScript as normal JS fails due to IIFE `this` scoping. The official upstream browser bundle attempts to load RapydScript from an external `<script>` tag pointing to a CDN or file path. Obsidian plugins must work 100% offline and should not inject uncontrolled CDN tags.
   - *Logic*: Intercepting `rapydscript.js` with `loader: 'text'` embeds the compiler directly in `main.js`. Bootstrapping it synchronously via `new Function('external_namespace', code).call(globalThis, globalThis)` registers `globalThis.RapydScript` before any call to `runPythonOnCanvas`. Zero network calls, zero file I/O at runtime.

5. **Font Shim Invariant**:
   - *Observation*: Wanim's SVG renderer constructs a font URL relative to `import.meta.url`. In CommonJS, `import.meta.url` is undefined, throwing `TypeError: Invalid URL`.
   - *Logic*: Replacing `import.meta.url` with `"http://localhost/"` at compile time via `define: { "import.meta.url": JSON.stringify("http://localhost/") }` satisfies `new URL()` without throwing.

6. **Context Lifecycle Discipline**:
   - *Observation*: In modern esbuild (`esbuild.context`), calling `await context.rebuild()` in a production build leaves file watches and event listeners open unless `context.dispose()` is called before `process.exit(0)`.
   - *Logic*: Explicitly calling `await context.dispose()` on production rebuild guarantees clean process termination.

---

## 3. Caveats

1. **Bundle Size**:
   - Bundling `@wanimjs/wanim`, MathJax runtime, NumPy-TS, and inlined RapydScript produces a `main.js` of ~7.5MB unminified and ~2.8MB minified (or ~7.7MB with full MathJax fonts inlined). This is normal and expected for a complete in-browser mathematical animation runtime.
2. **TypeScript Ambient Declaration**:
   - TypeScript compiler (`tsc`) requires an ambient module declaration to recognize `import rapydscriptSource from '@wanimjs/wanim/browser/rapydscript'` or `declare module "*rapydscript.js"`. A declaration file (`src/declarations.d.ts`) must be included in the project `include` paths.
3. **`moduleResolution` in `tsconfig.json`**:
   - Modern package.json subpaths (`@wanimjs/wanim/bridge`) require `moduleResolution: "bundler"` or `"node16"`/`"nodenext"` for `tsc` to find type declarations from subpath exports.

---

## 4. Conclusion & Proposed Specifications

### 4.1 Production `esbuild.config.mjs` Specification
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\esbuild.config.mjs`

```javascript
import esbuild from "esbuild";
import process from "process";
import fs from "node:fs";
import { builtinModules } from "node:module";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
Obsidian Wanim Plugin - In-browser Manim with Python
*/
`;

const prod = process.argv[2] === "production";

// Expand Node builtins to include 'node:' prefix and wildcards
const nodeBuiltins = [
	...builtinModules,
	...builtinModules.map((m) => `node:${m}`),
	"node:*",
];

// esbuild plugin to inline browser/rapydscript.js as text for synchronous in-memory bootstrap
const rapydscriptAsTextPlugin = {
	name: "wanim-rapydscript-loader",
	setup(build) {
		build.onLoad({ filter: /[/\\]rapydscript\.js$/ }, async (args) => {
			const contents = await fs.promises.readFile(args.path, "utf8");
			return {
				contents,
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
		...nodeBuiltins,
	],
	format: "cjs",
	platform: "browser",
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
	await context.dispose();
	process.exit(0);
} else {
	await context.watch();
}
```

### 4.2 RapydScript Synchronous Bootstrap Module (`src/engine/rapydscriptInit.ts`)
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\src\engine\rapydscriptInit.ts`

```typescript
import rapydscriptSource from '@wanimjs/wanim/browser/rapydscript';

/**
 * Synchronously initializes RapydScript into globalThis if not already present.
 * Uses the inlined text bundle to evaluate without CDN requests or external scripts.
 */
export function ensureRapydscriptInitialized(): void {
	if (typeof (globalThis as any).RapydScript === 'undefined') {
		const init = new Function('external_namespace', rapydscriptSource);
		init.call(globalThis, globalThis);
	}
}
```

### 4.3 TypeScript Ambient Declaration (`src/declarations.d.ts`)
**Target Path**: `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\src\declarations.d.ts`

```typescript
declare module '@wanimjs/wanim/browser/rapydscript' {
	const content: string;
	export default content;
}

declare module '*rapydscript.js' {
	const content: string;
	export default content;
}
```

### 4.4 Build Pipeline & Scripts Summary

| Command | Action | Output |
| :--- | :--- | :--- |
| `npm run build` | `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` | Generates production `main.js` (minified, bundled, sourcemap disabled) |
| `npm run dev` | `node esbuild.config.mjs` | Runs continuous watch mode, emitting unminified `main.js` with inline sourcemaps |

---

## 5. Verification Method

Once implemented by the builder agent, the build pipeline can be independently verified via the following steps:

1. **Verify esbuild Configuration & Plugin Syntax**:
   Run node syntax check on the config file:
   ```powershell
   node -c "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\esbuild.config.mjs"
   ```
   *Expected result*: Exit code 0, no syntax errors.

2. **Verify TypeScript Typechecking**:
   Run inside the target directory:
   ```powershell
   cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   npx tsc --noEmit --skipLibCheck
   ```
   *Expected result*: Exit code 0, zero compilation errors.

3. **Verify Production Bundle Compilation**:
   Run inside the target directory:
   ```powershell
   cd "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
   node esbuild.config.mjs production
   ```
   *Expected result*:
   - Clean exit code 0.
   - `main.js` is created at root of target directory.
   - `(Get-Item main.js).Length` is > 1,000,000 bytes.
   - File contains the banner `Obsidian Wanim Plugin - In-browser Manim with Python`.

4. **Verify Offline In-Memory RapydScript Initialization in Generated Bundle**:
   Execute a headless evaluation test against the output `main.js`:
   ```powershell
   node -e "
     // Mock Obsidian Plugin base class for headless load
     global.Plugin = class {};
     const plugin = require('./main.js');
     console.log('Bundle loaded successfully, export type:', typeof plugin.default);
   "
   ```
   *Expected result*: `Bundle loaded successfully, export type: function`.

5. **Invalidation Conditions**:
   - Build fails if `node:fs` or `node:fs/promises` is not in `external`.
   - Build fails or crashes at runtime if `import.meta.url` define is omitted.
   - RapydScript fails to compile if `rapydscriptAsTextPlugin` is omitted.
