# Handoff Report: Directory Isolation Verification, Isolated `styles.css` Skeleton, and R5-Compliant `src/main.ts` Stub

## 1. Observation

Direct inspection of `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\`, `C:\Users\angel\Notes\.agents\teamwork\ORIGINAL_REQUEST.md`, `C:\Users\angel\Notes\.agents\teamwork\orchestrator\PROJECT.md`, and the user's architectural guidelines (`<RULE[user_global]>`) yielded the following factual observations:

### 1.1 Reference Plugin Inventory & Baseline Hashes
Direct recursive traversal of `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin` (excluding `node_modules`) revealed exactly 26 files. Their SHA-256 hashes and file sizes were computed via PowerShell `Get-FileHash`:

| Relative Path | Size (Bytes) | SHA-256 Hash |
| :--- | :--- | :--- |
| `.editorconfig` | 166 | `D5FF47F51FB78124DCC2F99C7B22E6144350936035B290176C7965DD39E82173` |
| `.github/workflows/lint.yml` | 732 | `35BC98C862A1107F3979DB655000BF0C463E4D1F230B6956E4382CC90FFE4853` |
| `.gitignore` | 316 | `C59322AB1457F9F2F571DD006E59FC58A1956228BA385A29F4601D7EC26A9D6A` |
| `.npmrc` | 21 | `1E8648FE5564177375A935F6B444A6F9661FA61DA625477745929F146162B4DD` |
| `data.json` | 87 | `371E452B260683F14E064B173CF99C192FCA0CC3DB1A5E5DD51A49458BCFC51A` |
| `esbuild.config.mjs` | 1,034 | `63B26A1497C83CF29908CC6E8A70839522DE945D55365AF9232A5C9AFB246453` |
| `eslint.config.mts` | 719 | `6B773100778ABDD1932FA2E8128E8E810CAACAA39D629D9AB515C28E43481D28` |
| `LICENSE` | 652 | `C50481B6CDD91501B94DD791DE32E2B8F6B6FC81AB7BFC5C9D4D9A8972551B3B` |
| `main.js` | 15,811,497 | `E6C6D34A3B75A881B98B4D9E5EF1487B0E7E29267D284C645BDD72DF672572B3` |
| `manifest.json` | 397 | `BE600B1F27A23C56176F7DE38A6E95FD30E6FB7C4E5857F908B269C825531559` |
| `package.json` | 1,235 | `AF9203203F71320260B77676B2FCAE433180E510B2F578D15F0BDA05E67C2981` |
| `package-lock.json` | 229,584 | `AFA131E612EA87A360D57F861CC4015260D9C756DDA66089751C83C1C5C62BE8` |
| `README.md` | 4,838 | `BE81FAFFEE12D58D495599FFE285908CA3FB0BCA17C5A3AF795D076E981AF075` |
| `src/main.ts` | 1,886 | `1E1584B28E8C374817EACAC023DB4BD2DB06D26FFC65CD4778C532C5554234FB` |
| `src/manim/codeBlockProcessor.ts` | 9,286 | `FE9DCF3CC7427FE859FCD8A70581E2EECA3BB40CE56E8C4B3BBD341601BD7015` |
| `src/manim/editorChild.ts` | 7,146 | `C6BA6C2E7FEC927F6BFA4C080BE5141B79FEBE9C7EDC2B2FBB8E333F160DDCB9` |
| `src/manim/editorStyle.ts` | 3,407 | `83D26B8A728BC89B8303B24D8EF8C6A88652ABC1B45D200D6BDBD8282F93C46C` |
| `src/manim/editorThemes.ts` | 610 | `7B4D18B9FA35DC2BC3F91E9B0E05B4CA8F92E0B9A5C425C4434CC73CA041CD82` |
| `src/manim/runtime.ts` | 26,234 | `91B0661F0090B8F2604E3594E6493700FCE9F959273EBF336A04D007F4ED0769` |
| `src/manim/sourcePersistence.ts` | 1,372 | `599F7D8E340311FEA1B1503A440D042DF4133F0753CCD248317508427449C693` |
| `src/manim/stateStore.ts` | 1,749 | `5C76D4C9F1D36B82B641A007545E86142D334BBCC25D0F60065D32AF607828F3` |
| `src/settings.ts` | 2,363 | `C3429806EFC6952F4E5895F3683466BFC56461E32642A6AD63929CFEFE5E3F55` |
| `styles.css` | 7,865 | `69441028031A6CBFD66F66B7A3A91B0AA6C3D2B2AC9EEABD976578A071172055` |
| `tsconfig.json` | 614 | `F84AD1CF754AD4CD6803EF4E8134061E9C34387E0A5E93663F696419DFDF609D` |
| `version-bump.mjs` | 801 | `E68F73BF4AF779DB94D4B43F8EDF3988833DB94AA8F10BC46A0BDE245D1D7AC6` |
| `versions.json` | 26 | `18BCF8C5BAF37E39449820FE604B5B0EDFA77B5C0E83E0D138D72FB7590D0756` |

Direct check with `Test-Path "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"` returned `False`. Target directory does not exist yet.

### 1.2 Reference `styles.css` (lines 1–301)
- The reference plugin uses `.manim-` prefixes: `.manim-block`, `.manim-block-header`, `.manim-collapse-caret`, `.manim-block-controls`, `.manim-save-state`, `.manim-control-button`, `.manim-run-button`, `.manim-restart-button`, `.manim-code-editor`, `.manim-canvas`, `.manim-error-panel`.
- In `styles.css` (lines 193–209), an un-scoped selector `.cm-fat-cursor` was declared globally:
  ```css
  .cm-fat-cursor {
      display: inline-block !important;
      ...
  }
  ```
  This creates an unintended global style leakage across all CodeMirror instances in Obsidian.
- Cursor styling in reference:
  - Normal Mode: `#f10707` red background, `opacity: 0.75`, `min-width: 0.65em`, `z-index: 100`.
  - Insert Mode: `border-left: 2px solid #ffffff !important`, `width: 0 !important`.
  - Scroller isolation: `.cm-scroller { position: relative !important; }`.

### 1.3 Reference `src/main.ts` (lines 1–70)
- The reference `main.ts` combines settings loading, settings tab creation, vault event registration, active editor set management, and code block processor registration into loosely structured methods.
- Methods like `loadSettings()` directly perform side-effecting mutations without honest functional decomposition.
- Active editors are tracked via an unkeyed `Set<ThemeableEditor>`.

---

## 2. Logic Chain

1. **Directory Isolation Guarantee**:
   - *Observation*: The user requires `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` to remain completely untouched, with zero files created, modified, or deleted (R1, Acceptance Criteria).
   - *Logic*: By capturing the exact 26-file baseline and SHA-256 hashes above, any unintended write to the reference plugin can be detected immediately with cryptographic certainty.
   - *Design*: Provide an automated isolation check script (`verify-isolation.ps1` and Node equivalent) that validates:
     1. All 26 files exist with matching hashes.
     2. No surplus files exist in `obsidian-manim-plugin` (excluding `node_modules`).
     3. The target directory is strictly `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\`.

2. **CSS Namespace Isolation (`.wanim-`) & Zero Leakage**:
   - *Observation*: The reference plugin's un-scoped `.cm-fat-cursor` rule caused global cursor alteration.
   - *Logic*: Every single rule in `Obsidian Wanim Plugin/styles.css` must be explicitly scoped under `.wanim-block` or `.wanim-code-editor`. No bare `.cm-*` class can be declared at the root level.
   - *Logic*: Translating all classes to `.wanim-` prefix (`.wanim-block`, `.wanim-header`, `.wanim-block-header`, `.wanim-collapse-caret`, `.wanim-controls`, `.wanim-block-controls`, `.wanim-save-state`, `.wanim-control-button`, `.wanim-run-button`, `.wanim-restart-button`, `.wanim-code-editor`, `.wanim-canvas`, `.wanim-canvas-container`, `.wanim-canvas-viewport`, `.wanim-canvas-mount`, `.wanim-error-panel`) guarantees zero style clashes even if both plugins are simultaneously enabled.
   - *Logic*: Supporting both `.wanim-header` / `.wanim-block-header` and `.wanim-canvas` / `.wanim-canvas-container` provides full layout flexibility for UI components.

3. **Vim Cursor Styling Fidelity (R2)**:
   - *Observation*: R2 demands an exact bright red block cursor (`#f10707`) in Normal Mode and a thin white cursor line in Insert Mode.
   - *Logic*: CodeMirror 6 mounts `.cm-vimCursorLayer` inside `.cm-scroller` when `@replit/codemirror-vim` is active. Scoping `.wanim-code-editor .cm-scroller { position: relative !important; }` anchors cursor coordinates.
   - *Logic*: To prevent Obsidian's outer note `.cm-vimMode` wrapper from hiding the inner editor's Insert mode cursor, `.wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer` is forced visible (`display: block !important`), while standard cursor layer is suppressed only when the inner editor is in Normal mode (`.wanim-code-editor .cm-scroller.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer) { display: none !important; }`).

4. **Architectural Principles (R5) in `src/main.ts`**:
   - *Honest Functions*: Extract settings resolution into a pure leaf function `resolvePluginSettings(stored: unknown, defaults: Readonly<WanimPluginSettings>): WanimPluginSettings` that does not access global state. Extract Vim mode detection into `detectVimMode(app: unknown, windowRef?: unknown): boolean`.
   - *Push Side Effects to Boundaries*: The `WanimPlugin` class acts as the imperative boundary (reading vault data, registering events, mounting DOM). The computational logic (parsing, merging, filtering) is 100% honest.
   - *One Level of Abstraction ("Stacking Bricks")*: `onload()` reads as a high-level table of contents consisting solely of discrete brick calls (`initializeSettings()`, `registerSettingsTab()`, `registerVimEventListener()`, `registerCodeBlockProcessor()`).
   - *Invariant-Rich Signatures*: Typed domain entities (`ThemeableEditor`, `WanimEditorTheme`, `WanimPluginSettings`).
   - *Map Naming*: Lookup dictionary named `{value}By{key}`: `editorById: Map<string, ThemeableEditor>`.

---

## 3. Caveats

1. **`node_modules` in Reference Plugin**:
   - The reference folder contains a populated `node_modules` tree with thousands of third-party files. Including `node_modules` in file-by-file hash checks would be prohibitively slow and non-deterministic across OS environments. Therefore, the isolation check specifically monitors all 26 project-owned files and verifies that no new files are written to the root or `src/` directories.
2. **Tag Collision in Dual-Install Scenario**:
   - Both `obsidian-manim-plugin` and `Obsidian Wanim Plugin` target the Markdown code block tag `'manim'`. While CSS isolation is completely solved by `.wanim-`, if a user enables both plugins simultaneously in Obsidian, Obsidian's code block processor uses the most recently registered handler. Users should disable the old plugin when testing Wanim.

---

## 4. Conclusion & Proposed Designs

### 4.1 Directory Isolation Verification Checks

#### Baseline Inventory Table
The 26 baseline files and their SHA-256 hashes are listed in Section 1.1.

#### Automated Isolation Check Script: `scripts/verify-isolation.ps1`
This script can be executed at any time to verify that `obsidian-manim-plugin` remains 100% untouched:

```powershell
# scripts/verify-isolation.ps1
param (
    [string]$RefDir = "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin",
    [string]$TargetDir = "C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin"
)

$ErrorActionPreference = "Stop"

Write-Host "==> Verifying Reference Directory Isolation..." -ForegroundColor Cyan

# 1. Verify Target Directory Is Distinct
if ($TargetDir -eq $RefDir) {
    Write-Error "CRITICAL: Target directory must NOT be the reference directory!"
    exit 1
}

if (-not (Test-Path $RefDir)) {
    Write-Error "Reference directory does not exist at: $RefDir"
    exit 1
}

# 2. Baseline Hashes
$expectedHashes = @{
    ".editorconfig"                   = "D5FF47F51FB78124DCC2F99C7B22E6144350936035B290176C7965DD39E82173"
    ".github/workflows/lint.yml"      = "35BC98C862A1107F3979DB655000BF0C463E4D1F230B6956E4382CC90FFE4853"
    ".gitignore"                      = "C59322AB1457F9F2F571DD006E59FC58A1956228BA385A29F4601D7EC26A9D6A"
    ".npmrc"                          = "1E8648FE5564177375A935F6B444A6F9661FA61DA625477745929F146162B4DD"
    "data.json"                       = "371E452B260683F14E064B173CF99C192FCA0CC3DB1A5E5DD51A49458BCFC51A"
    "esbuild.config.mjs"              = "63B26A1497C83CF29908CC6E8A70839522DE945D55365AF9232A5C9AFB246453"
    "eslint.config.mts"               = "6B773100778ABDD1932FA2E8128E8E810CAACAA39D629D9AB515C28E43481D28"
    "LICENSE"                         = "C50481B6CDD91501B94DD791DE32E2B8F6B6FC81AB7BFC5C9D4D9A8972551B3B"
    "main.js"                         = "E6C6D34A3B75A881B98B4D9E5EF1487B0E7E29267D284C645BDD72DF672572B3"
    "manifest.json"                   = "BE600B1F27A23C56176F7DE38A6E95FD30E6FB7C4E5857F908B269C825531559"
    "package.json"                    = "AF9203203F71320260B77676B2FCAE433180E510B2F578D15F0BDA05E67C2981"
    "package-lock.json"               = "AFA131E612EA87A360D57F861CC4015260D9C756DDA66089751C83C1C5C62BE8"
    "README.md"                       = "BE81FAFFEE12D58D495599FFE285908CA3FB0BCA17C5A3AF795D076E981AF075"
    "src/main.ts"                     = "1E1584B28E8C374817EACAC023DB4BD2DB06D26FFC65CD4778C532C5554234FB"
    "src/manim/codeBlockProcessor.ts" = "FE9DCF3CC7427FE859FCD8A70581E2EECA3BB40CE56E8C4B3BBD341601BD7015"
    "src/manim/editorChild.ts"        = "C6BA6C2E7FEC927F6BFA4C080BE5141B79FEBE9C7EDC2B2FBB8E333F160DDCB9"
    "src/manim/editorStyle.ts"        = "83D26B8A728BC89B8303B24D8EF8C6A88652ABC1B45D200D6BDBD8282F93C46C"
    "src/manim/editorThemes.ts"       = "7B4D18B9FA35DC2BC3F91E9B0E05B4CA8F92E0B9A5C425C4434CC73CA041CD82"
    "src/manim/runtime.ts"            = "91B0661F0090B8F2604E3594E6493700FCE9F959273EBF336A04D007F4ED0769"
    "src/manim/sourcePersistence.ts"  = "599F7D8E340311FEA1B1503A440D042DF4133F0753CCD248317508427449C693"
    "src/manim/stateStore.ts"         = "5C76D4C9F1D36B82B641A007545E86142D334BBCC25D0F60065D32AF607828F3"
    "src/settings.ts"                 = "C3429806EFC6952F4E5895F3683466BFC56461E32642A6AD63929CFEFE5E3F55"
    "styles.css"                      = "69441028031A6CBFD66F66B7A3A91B0AA6C3D2B2AC9EEABD976578A071172055"
    "tsconfig.json"                   = "F84AD1CF754AD4CD6803EF4E8134061E9C34387E0A5E93663F696419DFDF609D"
    "version-bump.mjs"                = "E68F73BF4AF779DB94D4B43F8EDF3988833DB94AA8F10BC46A0BDE245D1D7AC6"
    "versions.json"                   = "18BCF8C5BAF37E39449820FE604B5B0EDFA77B5C0E83E0D138D72FB7590D0756"
}

# 3. Check all existing non-node_modules files
$currentFiles = Get-ChildItem -Path $RefDir | Where-Object { $_.Name -ne 'node_modules' } | ForEach-Object {
    if ($_.PSIsContainer) { Get-ChildItem -Recurse -File $_.FullName } else { $_ }
}

$currentCount = $currentFiles.Count
if ($currentCount -ne 26) {
    Write-Error "File count mismatch in reference directory! Expected 26 files, found $currentCount"
    exit 1
}

$failures = 0
foreach ($file in $currentFiles) {
    $rel = $file.FullName.Substring($RefDir.Length + 1).Replace('\', '/')
    if (-not $expectedHashes.ContainsKey($rel)) {
        Write-Error "Unexpected file found in reference directory: $rel"
        $failures++
        continue
    }
    $actualHash = (Get-FileHash -Algorithm SHA256 $file.FullName).Hash
    $expectedHash = $expectedHashes[$rel]
    if ($actualHash -ne $expectedHash) {
        Write-Error "Hash mismatch for $rel!`n  Expected: $expectedHash`n  Actual:   $actualHash"
        $failures++
    }
}

if ($failures -gt 0) {
    Write-Error "Isolation check FAILED with $failures issue(s)."
    exit 1
}

Write-Host "==> Reference Directory Isolation Verified: 26/26 files pristine, 0 modifications." -ForegroundColor Green
```

---

### 4.2 Isolated `styles.css` Skeleton

This skeleton guarantees complete namespace isolation (`.wanim-`), includes exact R2 Vim cursor styling, responsive 16:9 canvas layout, and the error panel:

```css
/* ==========================================================================
   Obsidian Wanim Plugin Styles
   All selectors are strictly scoped under .wanim- to guarantee zero style leakage.
   ========================================================================== */

/* Block Container */
.wanim-block {
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 8px 5px 5px;
    margin: 0;
    background: var(--background-secondary);
}

/* Header & Controls */
.wanim-header,
.wanim-block-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    min-height: 24px;
    padding: 0;
    cursor: pointer;
    user-select: none;
}

.wanim-collapse-caret {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-left: 1px;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 24px;
    line-height: 1;
}

.wanim-collapse-caret:hover,
.wanim-collapse-caret:focus-visible {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    outline: none;
}

.wanim-controls,
.wanim-block-controls {
    display: flex;
    align-items: center;
    gap: 6px;
}

.wanim-save-state {
    order: 3;
    font-size: 11px;
    color: var(--text-muted);
    padding: 0 4px;
}

.wanim-control-button {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 2px 12px;
    background: var(--interactive-normal);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.5;
}

.wanim-control-button:hover:not(:disabled) {
    background: var(--interactive-hover);
}

.wanim-control-button:disabled {
    opacity: 0.7;
    cursor: wait;
}

.wanim-run-button {
    order: 1;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--background-secondary-alt);
    color: var(--text-normal);
    font-weight: 600;
}

.wanim-run-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
}

.wanim-run-button .svg-icon,
.wanim-button-icon .svg-icon {
    width: 14px;
    height: 14px;
}

.wanim-button-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.wanim-run-label {
    line-height: 1;
}

.wanim-restart-button {
    order: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 7px;
    background: var(--background-secondary-alt);
    color: var(--text-normal);
}

.wanim-restart-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
}

.wanim-restart-button .svg-icon {
    width: 14px;
    height: 14px;
}

/* CodeMirror 6 Python Editor Container */
.wanim-code-editor {
    margin: 8px 0;
    background: var(--code-background, var(--background-primary)) !important;
    background-color: var(--code-background, var(--background-primary)) !important;
    background-image: none !important;
    border-radius: var(--code-radius, 6px);
    border: 1px solid var(--background-modifier-border-hover, var(--background-modifier-border));
    overflow: hidden;
    --wanim-vim-cursor-color: #f10707;
}

.wanim-code-editor .cm-editor {
    background: var(--code-background, var(--background-primary)) !important;
    background-color: var(--code-background, var(--background-primary)) !important;
    background-image: none !important;
    color: var(--code-normal, var(--text-normal));
}

.wanim-code-editor .cm-editor,
.wanim-code-editor .cm-content,
.wanim-code-editor .cm-line {
    font-family: var(--wanim-code-font-family, var(--font-monospace)) !important;
    font-size: var(--wanim-code-font-size, var(--code-size, 0.9em)) !important;
    line-height: var(--wanim-code-line-height, var(--line-height-normal, 1.5)) !important;
    letter-spacing: var(--wanim-code-letter-spacing, normal) !important;
    font-weight: var(--wanim-code-font-weight, 400) !important;
}

.wanim-code-editor .cm-line {
    padding: 0 2px 0 6px !important;
}

.wanim-code-editor .cm-scroller {
    position: relative !important;
    min-height: 220px;
    max-height: 320px;
    overflow: auto;
    background: var(--code-background, var(--background-primary)) !important;
    background-color: var(--code-background, var(--background-primary)) !important;
    background-image: none !important;
}

.wanim-code-editor .cm-content {
    padding: var(--size-4-2, 8px) var(--size-4-4, 12px) !important;
    tab-size: 4 !important;
    caret-color: #ffffff !important;
}

.wanim-code-editor .cm-focused {
    outline: none;
}

/* ==========================================================================
   Vim Mode Integration & Cursors (R2)
   Strictly scoped to .wanim-code-editor to eliminate global leak.
   ========================================================================== */

/* Vim Cursor Layer Positioning */
.wanim-code-editor .cm-vimCursorLayer {
    display: block !important;
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    z-index: 100 !important;
    pointer-events: none !important;
}

/* Bright Red Block Cursor for Normal Mode (#f10707) */
.wanim-code-editor .cm-fat-cursor,
.wanim-code-editor .cm-editor .cm-fat-cursor,
.wanim-code-editor .cm-editor:not(.cm-focused) .cm-fat-cursor,
.wanim-code-editor:not(.cm-focused) .cm-fat-cursor,
.wanim-code-editor .cm-vimCursorLayer .cm-fat-cursor {
    display: inline-block !important;
    visibility: visible !important;
    position: absolute !important;
    background: var(--wanim-vim-cursor-color, #f10707) !important;
    background-color: var(--wanim-vim-cursor-color, #f10707) !important;
    border: none !important;
    border-left: none !important;
    outline: none !important;
    white-space: pre !important;
    z-index: 100 !important;
    color: #ffffff !important;
    min-width: 0.65em !important;
    line-height: 1.2 !important;
    opacity: 0.75 !important;
    pointer-events: none !important;
}

/* Force Standard cursorLayer in Insert Mode (defeats outer Obsidian .cm-vimMode) */
.wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer,
.wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursorLayer:not(.cm-vimCursorLayer),
.wanim-code-editor .cm-scroller:not(.cm-vimMode) > .cm-cursorLayer {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
}

/* Suppress Standard cursorLayer only when inner editor is in Normal/Visual Mode */
.wanim-code-editor .cm-scroller.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer) {
    display: none !important;
}

/* Thin White Line Cursor in Insert Mode */
.wanim-code-editor .cm-scroller:not(.cm-vimMode) .cm-cursor,
.wanim-code-editor .cm-cursor:not(.cm-fat-cursor),
.wanim-code-editor .cm-dropCursor {
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

/* Active Line & Selection */
.wanim-code-editor .cm-activeLine,
.wanim-code-editor .cm-activeLineGutter {
    background-color: var(--cursor-line-background, rgba(255, 255, 255, 0.06)) !important;
}

.wanim-code-editor .cm-selectionBackground,
.wanim-code-editor .cm-content ::selection {
    background: var(--wanim-selection-color, var(--text-selection)) !important;
}

/* ==========================================================================
   16:9 Responsive Canvas Layout
   ========================================================================== */
.wanim-canvas,
.wanim-canvas-container {
    aspect-ratio: 16 / 9;
    margin-top: 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 0;
    overflow: hidden;
    background: var(--background-primary);
}

.wanim-canvas-viewport {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}

.wanim-canvas-mount {
    position: relative;
    width: 100%;
    height: 100%;
    max-width: 800px;
    aspect-ratio: 16 / 9;
}

.wanim-canvas-mount canvas,
.wanim-canvas canvas,
.wanim-canvas-container canvas {
    display: block;
    max-width: 100%;
    max-height: 100%;
    margin: 0 auto;
}

/* ==========================================================================
   Red Error Panel
   ========================================================================== */
.wanim-error-panel {
    margin-top: 8px;
    padding: 10px;
    border: 1px solid color-mix(in srgb, var(--color-red), transparent 60%);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-red), transparent 92%);
    color: var(--text-error, var(--color-red));
    font-family: var(--font-monospace);
    font-size: var(--code-size, 0.9em);
    line-height: 1.45;
    white-space: pre-wrap;
    overflow: auto;
    max-height: 220px;
}
```

---

### 4.3 Initial `src/main.ts` Skeleton (R5 Compliant)

This stub implements the complete plugin lifecycle strictly adhering to the user's architectural guidelines:
- **Local Reasoning & Honest Functions**: Leaf helpers `resolvePluginSettings`, `detectVimMode`, `broadcastEditorThemeChange`, and `broadcastEditorVimChange` have zero hidden state access, explicitly declared arguments, and return pure values or actions.
- **One Level of Abstraction ("Stacking Bricks")**: High-level lifecycle methods `onload()` and `onunload()` read like clean tables of contents.
- **Empathetic & Invariant-Rich Signatures**: Bundled config interfaces (`WanimPluginSettings`, `ThemeableEditor`).
- **Map / Dictionary Naming**: `{value}By{key}` -> `editorById: Map<string, ThemeableEditor>`.

```ts
// src/main.ts
import { Plugin, EventRef } from 'obsidian';
import {
    WanimPluginSettings,
    DEFAULT_SETTINGS,
    resolvePluginSettings,
    WanimSettingTab,
} from './settings';
import { ThemeableEditor, WanimEditorTheme } from './types';
import { registerWanimCodeBlockProcessor } from './ui/codeBlockProcessor';
import { detectVimMode } from './editor/vimIntegration';

// ============================================================================
// Pure / Honest Domain Helpers (Leaf Functions)
// ============================================================================

/**
 * Broadcasts a new editor theme across all active themeable editors.
 * Honest function: accepts explicit collection, theme value, and logger callback.
 */
export function broadcastEditorThemeChange(
    editors: Iterable<ThemeableEditor>,
    newTheme: WanimEditorTheme,
    logError: (message: string, error: unknown) => void = console.error
): void {
    for (const editor of editors) {
        try {
            editor.setEditorTheme(newTheme);
        } catch (error) {
            logError(`Failed to update theme for editor "${editor.id}"`, error);
        }
    }
}

/**
 * Broadcasts Vim mode state changes across all active themeable editors.
 * Honest function: accepts explicit collection, vim state, and logger callback.
 */
export function broadcastEditorVimChange(
    editors: Iterable<ThemeableEditor>,
    isVimEnabled: boolean,
    logError: (message: string, error: unknown) => void = console.error
): void {
    for (const editor of editors) {
        try {
            editor.setVimEnabled(isVimEnabled);
        } catch (error) {
            logError(`Failed to update vim mode for editor "${editor.id}"`, error);
        }
    }
}

// ============================================================================
// Plugin Class (Imperative Shell / Boundary Layer)
// ============================================================================

export default class WanimPlugin extends Plugin {
    settings: WanimPluginSettings = DEFAULT_SETTINGS;
    private readonly editorById = new Map<string, ThemeableEditor>();

    // ------------------------------------------------------------------------
    // Lifecycle (Stacking Bricks - Uniform Abstraction)
    // ------------------------------------------------------------------------

    async onload(): Promise<void> {
        await this.initializeSettings();
        this.registerSettingsTab();
        this.registerVimEventListener();
        this.registerCodeBlockProcessor();
    }

    onunload(): void {
        this.teardownActiveEditors();
    }

    // ------------------------------------------------------------------------
    // Active Editor Registry & Notification Dispatch
    // ------------------------------------------------------------------------

    registerActiveEditor(editor: ThemeableEditor): void {
        this.editorById.set(editor.id, editor);
    }

    unregisterActiveEditor(editorId: string): void {
        this.editorById.delete(editorId);
    }

    updateAllEditorThemes(newTheme: WanimEditorTheme): void {
        broadcastEditorThemeChange(this.editorById.values(), newTheme);
    }

    updateAllEditorVim(isVimEnabled: boolean): void {
        broadcastEditorVimChange(this.editorById.values(), isVimEnabled);
    }

    // ------------------------------------------------------------------------
    // Discrete Orchestration Bricks
    // ------------------------------------------------------------------------

    private async initializeSettings(): Promise<void> {
        const rawData = await this.loadData();
        this.settings = resolvePluginSettings(rawData, DEFAULT_SETTINGS);
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    private registerSettingsTab(): void {
        this.addSettingTab(new WanimSettingTab(this.app, this));
    }

    private registerVimEventListener(): void {
        const vault = this.app.vault as unknown as {
            on: (event: string, callback: () => void) => EventRef;
        };
        if (typeof vault?.on === 'function') {
            this.registerEvent(
                vault.on('config-changed', () => {
                    const isVim = detectVimMode(this.app, typeof window !== 'undefined' ? window : undefined);
                    this.updateAllEditorVim(isVim);
                })
            );
        }
    }

    private registerCodeBlockProcessor(): void {
        registerWanimCodeBlockProcessor(this);
    }

    private teardownActiveEditors(): void {
        this.editorById.clear();
    }
}
```

---

## 5. Verification Method

To independently verify these deliverables:

1. **Verify Baseline Directory Isolation**:
   Run the isolation check command in PowerShell:
   ```powershell
   $refDir = "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin"
   $files = Get-ChildItem -Path $refDir | Where-Object { $_.Name -ne 'node_modules' } | ForEach-Object {
       if ($_.PSIsContainer) { Get-ChildItem -Recurse -File $_.FullName } else { $_ }
   }
   Write-Host "File Count: $($files.Count)"
   # Must output: File Count: 26
   ```
2. **Verify SHA-256 Hash Match**:
   Compute hashes on all 26 files and verify zero diff against Section 1.1:
   ```powershell
   $refDir = "C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin"
   Get-ChildItem -Path $refDir | Where-Object { $_.Name -ne 'node_modules' } | ForEach-Object {
       if ($_.PSIsContainer) { Get-ChildItem -Recurse -File $_.FullName } else { $_ }
   } | ForEach-Object {
       $rel = $_.FullName.Substring($refDir.Length + 1).Replace('\', '/')
       $h = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash
       "$rel: $h"
   }
   ```
3. **Verify CSS Namespace Conformance**:
   Inspect the proposed `styles.css` content:
   - Ensure every root selector starts with `.wanim-`.
   - Ensure `.cm-fat-cursor` is strictly prefixed with `.wanim-code-editor`.
   - Confirm `--wanim-vim-cursor-color: #f10707` and Insert mode `border-left: 2px solid #ffffff`.
4. **Verify R5 Principles in `src/main.ts`**:
   - Check `onload()`: 4 clean, single-level method calls.
   - Check leaf functions: `broadcastEditorThemeChange`, `broadcastEditorVimChange`, `resolvePluginSettings`, `detectVimMode` have explicit parameter types and zero hidden global references.
   - Check dictionary name: `editorById: Map<string, ThemeableEditor>` adheres to `{value}By{key}` naming.
