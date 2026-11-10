import fs from "fs";
import { pathToFileURL } from "url";
import vm from "vm";

const rapydscriptSource = fs.readFileSync('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/browser/rapydscript.js', 'utf8');
const init = new Function('external_namespace', rapydscriptSource);
init(globalThis);

const modCompile = await import(pathToFileURL('C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin/node_modules/@wanimjs/wanim/dist/compiler.js').href);
const { compilePython } = modCompile;

const testCodes = [
  'class S(Scene):\n    def construct(self):\n        raise ValueError("custom error test")',
  'class S(Scene):\n    def construct(self):\n        non_existent_fn()',
  'class S(Scene):\n    def construct(self):\n        c = Circle()\n        c.fake_method()'
];

for (const code of testCodes) {
  try {
    const { js } = await compilePython(code);
    const ctx = {
      Scene: class Scene {},
      Circle: class Circle {},
      ValueError: class ValueError extends Error { constructor(m) { super(m); this.name = "ValueError"; } }
    };
    vm.createContext(ctx);
    vm.runInContext(js, ctx);
    const s = new ctx.S();
    s.construct();
  } catch (err) {
    console.log('=== RUNTIME EXCEPTION CAUGHT ===');
    console.log('Name:', err.name);
    console.log('Message:', err.message);
    console.log('Stack:\n' + err.stack);
  }
}
