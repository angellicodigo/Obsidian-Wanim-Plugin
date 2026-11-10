Build a production-ready Obsidian Wanim Plugin that recreates the Obsidian Manim Plugin using Wanim (https://github.com/Acfboy/Wanim) with Python in the code editor instead of TypeScript, residing in an independent plugin directory while keeping the existing Obsidian Manim Plugin untouched.

Working directory: C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin
Integrity mode: development

Reference material:
- Wanim repository: https://github.com/Acfboy/Wanim
- Manim Community Example Scenes: https://docs.manim.community/en/stable/examples.html
- Read-only reference plugin: C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\
- Detailed implementation plan: C:\Users\angel\.gemini\antigravity-cli\brain\297f2c6b-e69a-4d05-b196-0b0d450a9639\wanim_implementation_plan.md

## Requirements

### R1. Independent Plugin Scaffolding and Target Directory
Create a complete, self-contained Obsidian plugin in `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\` with manifest (`id: "obsidian-wanim-plugin"`, `name: "Obsidian Wanim Plugin"`), `package.json`, `tsconfig.json`, `esbuild.config.mjs`, styles, and build tooling. The existing plugin folder `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` must remain completely untouched (no files created, modified, or deleted); it may be inspected strictly as a read-only reference for settings, UI layout, and styling.

### R2. Python Code Editor & Obsidian Vim Mode Integration
Register the Markdown code block processor for tag ````manim ````. Embed a CodeMirror 6 editor configured with Python syntax highlighting (`@codemirror/lang-python`), 4-space tab indentation (`tabSize: 4`, `indentUnit: 4`), and dynamic Vim mode synchronization with Obsidian's vimMode setting. When Vim mode is enabled, display an exact bright red block cursor (`#f10707`) in Normal Mode and a thin white cursor line in Insert Mode.

### R3. In-Browser Wanim Execution Engine & UI Controls
Integrate `@wanimjs/wanim` (0.1.3) via the browser bridge (`runPythonOnCanvas` from `@wanimjs/wanim/bridge`) to execute Python Manim code on a 16:9 responsive HTML5 canvas. Provide header controls for each code block: Run / Pause toggle, Restart button, collapse caret (▾ / ▸), save status indicator, and a dedicated red error panel formatting compilation errors and runtime tracebacks.

### R4. Plugin Settings & Source Persistence
Provide user settings: Editor theme (Obsidian, GitHub Light, GitHub Dark, One Dark, Monokai), Auto-save delay (1–300 seconds, default 60), Default collapsed toggle (default false), Render quality dropdown (-qm 720p/30fps default, -ql 480p/15fps, -qh 1080p/60fps), and Auto-run on open toggle (default true). Automatically persist edited code back to the enclosing markdown document in the vault by updating the corresponding ````manim ```` fence block.

### R5. Architectural Code Principles
Adhere strictly to the user's architectural guidelines: local reasoning and honest functions (push side effects such as vault I/O and DOM manipulation to boundaries, explicit dependency injection), single uniform level of abstraction ("stacking bricks"), invariant-rich signatures, and `{value}By{key}` naming convention for maps and dictionaries.

### R6. Verification, Automated Testing, and Simulated User Validation
Implement automated test scripts verifying build compilation, Python transpilation bridge execution, and state persistence. Execute simulated user workflows to discover edge cases or runtime defects across realistic Manim Python scenes (including examples from the Manim Community documentation), and patch any discovered bugs.

## Acceptance Criteria

### Plugin Build & Directory Isolation
- [ ] `npm install` and `npm run build` run inside `C:\Users\angel\Notes\.obsidian\plugins\Obsidian Wanim Plugin\` succeed with zero compilation errors, generating valid `main.js`, `manifest.json`, and `styles.css`.
- [ ] No files in `C:\Users\angel\Notes\.obsidian\plugins\obsidian-manim-plugin\` are created, modified, or deleted.

### Editor & Code Block Behavior
- [ ] Markdown code blocks tagged with ````manim ```` render the interactive Wanim block widget.
- [ ] CodeMirror 6 editor highlights Python syntax and inserts 4 spaces on Tab.
- [ ] Vim mode displays a bright red block cursor (`#f10707`) in Normal Mode and a thin white line cursor in Insert Mode, dynamically updating when Obsidian Vim mode is toggled.
- [ ] Modifying code in the editor persists back to the markdown file in the vault after the configured auto-save delay or on save trigger.

### Animation Runtime & Playback Controls
- [ ] Executing Python Manim scenes (including standard shapes, transforms, and examples from Manim Community documentation) renders animations smoothly onto the 16:9 canvas.
- [ ] Run/Pause button toggles playback execution, Restart button resets the animation from the beginning, and the collapse caret hides or shows the editor.
- [ ] Syntax errors or runtime exceptions display clearly in the red error panel without crashing the plugin or Obsidian view.

### Settings Configuration
- [ ] Settings tab allows changing theme, auto-save delay, default collapsed state, render quality, and auto-run on open.

### Verification & Bug Patching
- [ ] Automated test scripts execute and pass without errors.
- [ ] Simulated user trials exercise key interaction flows (scene rendering, playback pausing/resuming, settings changes, file persistence), and all discovered issues are patched and verified.