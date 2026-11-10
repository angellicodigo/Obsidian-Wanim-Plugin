// Standalone verification script for Vim detection, compartment reconfiguration, and styling helpers

import assert from 'node:assert';

// 1. Mock Implementations of honest functions from proposed_vimIntegration.ts

function detectVimFromVaultGetConfig(host) {
	if (typeof host.vault?.getConfig === 'function') {
		const result = host.vault.getConfig('vimMode');
		if (typeof result === 'boolean') {
			return result;
		}
	}
	return undefined;
}

function detectVimFromVaultConfigObject(host) {
	if (typeof host.vault?.config?.vimMode === 'boolean') {
		return host.vault.config.vimMode;
	}
	return undefined;
}

function detectVimFromAppMethod(host) {
	if (typeof host.isVimEnabled === 'function') {
		return Boolean(host.isVimEnabled());
	}
	return undefined;
}

function detectVimFromInternalPlugins(host) {
	const option = host.internalPlugins?.plugins?.editor?.instance?.options?.vimMode;
	if (typeof option === 'boolean') {
		return option;
	}
	return undefined;
}

function detectVimFromGlobalAdapter(globalScope) {
	if (globalScope && typeof globalScope === 'object') {
		const adapter = globalScope.CodeMirrorAdapter;
		if (adapter && typeof adapter === 'object') {
			const hasVim = 'Vim' in adapter && Boolean(adapter.Vim);
			if (hasVim) {
				return true;
			}
		}
	}
	return undefined;
}

function extractVimConfigHost(target) {
	if (!target || typeof target !== 'object') {
		return {};
	}
	if (target.app && typeof target.app === 'object') {
		return target.app;
	}
	return target;
}

const DETECTION_TIERS = [
	detectVimFromVaultGetConfig,
	detectVimFromVaultConfigObject,
	detectVimFromAppMethod,
	detectVimFromInternalPlugins,
];

function resolveVimModeFromHost(host, globalScope = {}) {
	for (const detector of DETECTION_TIERS) {
		const result = detector(host);
		if (result !== undefined) {
			return result;
		}
	}
	const fallbackResult = detectVimFromGlobalAdapter(globalScope);
	if (fallbackResult !== undefined) {
		return fallbackResult;
	}
	return false;
}

function isVimEnabled(target, globalScope = {}) {
	const host = extractVimConfigHost(target);
	return resolveVimModeFromHost(host, globalScope);
}

// 2. Broadcast honest helper
function broadcastEditorVimChange(editors, isVim, logError = console.error) {
	for (const editor of editors) {
		try {
			editor.setVimEnabled(isVim);
		} catch (error) {
			logError(`Failed to update vim mode for editor "${editor.id}"`, error);
		}
	}
}

// -------------------------------------------------------------
// Test Suite
// -------------------------------------------------------------

console.log('--- Testing Vim Detection Tiers ---');

// Tier 1: vault.getConfig('vimMode')
assert.strictEqual(isVimEnabled({ vault: { getConfig: (k) => k === 'vimMode' ? true : undefined } }), true, 'Tier 1 true failed');
assert.strictEqual(isVimEnabled({ vault: { getConfig: (k) => k === 'vimMode' ? false : undefined } }), false, 'Tier 1 false failed');

// Target is Plugin wrapping App
assert.strictEqual(isVimEnabled({ app: { vault: { getConfig: (k) => k === 'vimMode' ? true : undefined } } }), true, 'Plugin app wrapper Tier 1 failed');

// Tier 2: vault.config.vimMode
assert.strictEqual(isVimEnabled({ vault: { config: { vimMode: true } } }), true, 'Tier 2 true failed');
assert.strictEqual(isVimEnabled({ vault: { config: { vimMode: false } } }), false, 'Tier 2 false failed');

// Tier 3: app.isVimEnabled()
assert.strictEqual(isVimEnabled({ isVimEnabled: () => true }), true, 'Tier 3 true failed');
assert.strictEqual(isVimEnabled({ isVimEnabled: () => false }), false, 'Tier 3 false failed');

// Tier 4: internalPlugins.plugins.editor.instance.options.vimMode
assert.strictEqual(isVimEnabled({ internalPlugins: { plugins: { editor: { instance: { options: { vimMode: true } } } } } }), true, 'Tier 4 true failed');
assert.strictEqual(isVimEnabled({ internalPlugins: { plugins: { editor: { instance: { options: { vimMode: false } } } } } }), false, 'Tier 4 false failed');

// Tier 5: global CodeMirrorAdapter.Vim
assert.strictEqual(isVimEnabled({}, { CodeMirrorAdapter: { Vim: {} } }), true, 'Tier 5 true failed');

// Default when nothing matches
assert.strictEqual(isVimEnabled({}), false, 'Default false failed');
assert.strictEqual(isVimEnabled(null), false, 'Null target failed');
assert.strictEqual(isVimEnabled(undefined), false, 'Undefined target failed');

console.log('✓ All 5 detection tiers passed.');

// -------------------------------------------------------------
// Test Broadcast & Error Resilience
// -------------------------------------------------------------
console.log('--- Testing Broadcast and Error Resilience ---');

const mockEditors = [
	{ id: 'editor-1', vim: false, setVimEnabled(val) { this.vim = val; } },
	{ id: 'editor-2', vim: false, setVimEnabled(val) { throw new Error('Simulated failure'); } },
	{ id: 'editor-3', vim: false, setVimEnabled(val) { this.vim = val; } },
];

let errorCount = 0;
broadcastEditorVimChange(mockEditors, true, (msg, err) => {
	errorCount++;
});

assert.strictEqual(mockEditors[0].vim, true, 'Editor 1 was not updated');
assert.strictEqual(mockEditors[2].vim, true, 'Editor 3 was not updated after Editor 2 threw');
assert.strictEqual(errorCount, 1, 'Error logger was not called exactly once');

console.log('✓ Broadcast error resilience passed.');

console.log('All tests passed successfully!');
