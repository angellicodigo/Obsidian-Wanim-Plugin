import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const pluginRoot = 'C:/Users/angel/Notes/.obsidian/plugins/Obsidian Wanim Plugin';
const stateFolder = 'C:/Users/angel/Notes/.agents/teamwork/teamwork_auditor_m3_1';

const req = createRequire(pathToFileURL(`${pluginRoot}/package.json`));
const { build } = req('esbuild');

const rapydscriptAsTextPlugin = {
	name: 'wanim-rapydscript-loader',
	setup(buildCtx) {
		buildCtx.onLoad({ filter: /[/\\]rapydscript\.js$/ }, async (args) => {
			const contents = await fs.promises.readFile(args.path, 'utf8');
			return {
				contents,
				loader: 'text',
			};
		});
	},
};

const commonBuildConfig = {
	absWorkingDir: pluginRoot,
	nodePaths: [path.resolve(pluginRoot, 'node_modules')],
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node18',
	conditions: ['browser', 'default'],
	plugins: [rapydscriptAsTextPlugin],
	alias: {
		obsidian: path.resolve(pluginRoot, 'tests', 'mocks', 'obsidian.ts'),
	},
	external: ['node:*'],
	loader: {
		'.js': 'js',
		'.ts': 'ts',
	},
	logLevel: 'info',
};

async function main() {
	const outfile = path.resolve(stateFolder, 'auditor_bundle.mjs');
	const entry = path.resolve(stateFolder, 'auditor_empirical_verification.ts');

	console.log('[Auditor Builder] Bundling empirical verification test...');
	await build({
		...commonBuildConfig,
		entryPoints: [entry],
		outfile,
	});

	console.log('[Auditor Builder] Executing bundle:', outfile);
	const res = spawnSync('node', [outfile], {
		stdio: 'inherit',
		cwd: pluginRoot,
	});

	if (res.status !== 0) {
		console.error(`[Auditor Builder] Verification failed with exit code: ${res.status}`);
		process.exit(res.status ?? 1);
	}
	console.log('[Auditor Builder] SUCCESS!');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
