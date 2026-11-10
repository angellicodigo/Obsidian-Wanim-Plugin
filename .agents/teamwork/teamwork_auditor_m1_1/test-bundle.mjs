import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const mainJsPath = path.resolve('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/main.js');
const code = fs.readFileSync(mainJsPath, 'utf8');

const customModule = { exports: {} };
const nativeRequire = createRequire(import.meta.url);

const mockRequire = (id) => {
	if (id === 'obsidian') {
		return {
			Plugin: class {
				async loadData() {
					return { editorTheme: 'github-light', autoSaveDelaySeconds: 15 };
				}
				async saveData(d) {
					this.savedData = d;
				}
			},
		};
	}
	return nativeRequire(id);
};

const fn = new Function('require', 'module', 'exports', code);
fn(mockRequire, customModule, customModule.exports);

const PluginClass = customModule.exports.default || customModule.exports;
const instance = new PluginClass();
await instance.onload();

const pyCode = `
def multiply(x, y):
    return x * y

window.my_calc_result = multiply(6, 7)
`;

const jsOut = await globalThis.RapydScript.compile(pyCode);
console.log('Compiled output generated. Length:', jsOut.length);

globalThis.window = globalThis;
eval(jsOut);

console.log('Result of running compiled Python calculation:', globalThis.my_calc_result);
if (globalThis.my_calc_result === 42) {
	console.log('EMPIRICAL RAPYDYSCRIPT COMPILE AND RUN: SUCCESS');
} else {
	console.error('EMPIRICAL RAPYDYSCRIPT COMPILE AND RUN: FAILED');
	process.exit(1);
}
