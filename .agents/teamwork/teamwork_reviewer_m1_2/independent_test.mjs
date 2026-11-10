import fs from 'node:fs';

const code = fs.readFileSync('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/main.js', 'utf8');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
	if (cond) {
		passed++;
		console.log(`[PASS] ${msg}`);
	} else {
		failed++;
		console.error(`[FAIL] ${msg}`);
	}
}

let storedData = {};
const mockRequire = (id) => {
	if (id === 'obsidian') {
		return {
			Plugin: class {
				async loadData() { return storedData; }
				async saveData(d) { storedData = d; }
			}
		};
	}
	return (import.meta && import.meta.require) ? import.meta.require(id) : {};
};

const customModule = { exports: {} };
const fn = new Function('require', 'module', 'exports', code);
fn(mockRequire, customModule, customModule.exports);

const PluginClass = customModule.exports.default;
const { broadcastEditorThemeChange, broadcastEditorVimChange } = customModule.exports;

async function runTests() {
	console.log('Running plugin lifecycle and adversarial tests...');

	// Test 1: Default initialization
	storedData = null;
	const p1 = new PluginClass();
	await p1.onload();
	assert(p1.settings.editorTheme === 'obsidian', 'Default theme is obsidian');
	assert(p1.settings.autoSaveDelaySeconds === 60, 'Default delay is 60');
	assert(p1.settings.defaultCollapsed === false, 'Default collapsed is false');
	assert(p1.settings.renderQuality === '-qm', 'Default quality is -qm');
	assert(p1.settings.autoRunOnOpen === true, 'Default autoRun is true');

	// Test 2: Adversarial corrupted data in loadData()
	storedData = {
		editorTheme: 'malicious-theme',
		autoSaveDelaySeconds: -50,
		defaultCollapsed: 'yes',
		renderQuality: 'ultra-hd',
		autoRunOnOpen: 'no'
	};
	const p2 = new PluginClass();
	await p2.onload();
	assert(p2.settings.editorTheme === 'obsidian', 'Invalid theme falls back to default');
	assert(p2.settings.autoSaveDelaySeconds === 60, 'Negative delay falls back to default');
	assert(p2.settings.defaultCollapsed === false, 'String collapsed falls back to default');
	assert(p2.settings.renderQuality === '-qm', 'Invalid quality falls back to default');
	assert(p2.settings.autoRunOnOpen === true, 'String autoRun falls back to default');

	// Test 3: Valid boundary settings
	storedData = {
		editorTheme: 'github-dark',
		autoSaveDelaySeconds: 1, // min bound
		defaultCollapsed: true,
		renderQuality: '-qh',
		autoRunOnOpen: false
	};
	const p3 = new PluginClass();
	await p3.onload();
	assert(p3.settings.editorTheme === 'github-dark', 'Valid theme accepted');
	assert(p3.settings.autoSaveDelaySeconds === 1, 'Min delay accepted');
	assert(p3.settings.defaultCollapsed === true, 'Valid collapsed boolean accepted');
	assert(p3.settings.renderQuality === '-qh', 'Valid quality accepted');
	assert(p3.settings.autoRunOnOpen === false, 'Valid autoRun boolean accepted');

	// Test 4: Max boundary delay
	storedData = { autoSaveDelaySeconds: 300 };
	const p4 = new PluginClass();
	await p4.onload();
	assert(p4.settings.autoSaveDelaySeconds === 300, 'Max delay 300 accepted');

	storedData = { autoSaveDelaySeconds: 301 };
	const p5 = new PluginClass();
	await p5.onload();
	assert(p5.settings.autoSaveDelaySeconds === 60, 'Out of bound 301 rejected');

	// Test 5: Float delay truncation
	storedData = { autoSaveDelaySeconds: 45.9 };
	const p6 = new PluginClass();
	await p6.onload();
	assert(p6.settings.autoSaveDelaySeconds === 45, 'Float delay truncated to integer');

	// Test 6: Editor Registry & Broadcast
	let editor1Theme = '';
	let editor1Vim = false;
	let editor2Theme = '';
	let editor2Vim = false;
	const mockEditor1 = {
		id: 'block-1',
		setEditorTheme: (t) => { editor1Theme = t; },
		setVimEnabled: (v) => { editor1Vim = v; }
	};
	const mockEditor2 = {
		id: 'block-2',
		setEditorTheme: (t) => { editor2Theme = t; },
		setVimEnabled: (v) => { editor2Vim = v; }
	};
	p1.registerActiveEditor(mockEditor1);
	p1.registerActiveEditor(mockEditor2);
	assert(p1.getActiveEditor('block-1') === mockEditor1, 'Get active editor works');

	p1.updateAllEditorThemes('one-dark');
	assert(editor1Theme === 'one-dark' && editor2Theme === 'one-dark', 'Theme broadcast succeeds');

	p1.updateAllEditorVim(true);
	assert(editor1Vim === true && editor2Vim === true, 'Vim broadcast succeeds');

	p1.unregisterActiveEditor('block-1');
	assert(p1.getActiveEditor('block-1') === undefined, 'Unregister active editor works');

	// Test 7: Broadcast error resilience
	const faultyEditor = {
		id: 'block-faulty',
		setEditorTheme: () => { throw new Error('DOM exploded'); },
		setVimEnabled: () => { throw new Error('Vim crashed'); }
	};
	let errorLogged = 0;
	broadcastEditorThemeChange([faultyEditor, mockEditor2], 'monokai', () => { errorLogged++; });
	assert(errorLogged === 1, 'Error caught and logged');
	assert(editor2Theme === 'monokai', 'Subsequent editor still updated despite error');

	// Test 8: onunload cleanup
	p1.onunload();
	assert(p1.getActiveEditor('block-2') === undefined, 'Active editors cleared on unload');

	// Test 9: RapydScript compilation
	assert(typeof globalThis.RapydScript?.compile === 'function', 'RapydScript compiler exists');
	const codePy = 'def greet(name):\n    return "Hello, " + name\n';
	const compiled = await globalThis.RapydScript.compile(codePy);
	assert(typeof compiled === 'string' && compiled.includes('function greet'), 'Python compiles to JS');

	// Test 10: RapydScript syntax error handling
	let caughtError = null;
	try {
		await globalThis.RapydScript.compile('def broken_syntax(:\n    pass\n');
	} catch (e) {
		caughtError = e;
	}
	assert(caughtError !== null, 'RapydScript raises error on invalid Python syntax');
	assert(caughtError?.line !== undefined || caughtError?.message !== undefined, 'Error contains diagnostic info');

	// Test 11: RapydScript Manim-like construct
	const scenePy = `
class TestScene(Scene):
    def construct(self):
        c = Circle(radius=2, color=RED)
        self.play(Create(c))
        self.wait(1)
`;
	const compiledScene = await globalThis.RapydScript.compile(scenePy);
	assert(typeof compiledScene === 'string' && compiledScene.includes('TestScene'), 'Python Manim Scene class transpiled successfully');

	console.log(`\nFinal Test Results: ${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

runTests();
