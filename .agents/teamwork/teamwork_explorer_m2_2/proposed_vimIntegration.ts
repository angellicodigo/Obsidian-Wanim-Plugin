/**
 * Vim mode detection, dynamic synchronization, and CodeMirror 6 compartment integration.
 * Adheres to R5 architectural guidelines: honest leaf functions, explicit dependency injection,
 * and single level of abstraction.
 */

import { Compartment, Extension, StateEffect } from '@codemirror/state';
import { vim } from '@replit/codemirror-vim';

// ============================================================================
// Types & Domain Interfaces
// ============================================================================

export interface VaultConfigInterface {
	getConfig?: (key: string) => unknown;
	config?: {
		vimMode?: unknown;
	};
}

export interface InternalEditorPluginInstance {
	options?: {
		vimMode?: unknown;
	};
}

export interface InternalPluginsInterface {
	plugins?: {
		editor?: {
			instance?: InternalEditorPluginInstance;
		};
	};
}

export interface VimConfigHost {
	vault?: VaultConfigInterface;
	isVimEnabled?: () => unknown;
	internalPlugins?: InternalPluginsInterface;
}

export type VimModeDetector = (host: VimConfigHost) => boolean | undefined;

// ============================================================================
// Pure / Honest Leaf Functions (Detection Tiers)
// ============================================================================

/**
 * Tier 1: Queries app.vault.getConfig('vimMode').
 * Honest function: only reads explicit argument, no side effects.
 */
export function detectVimFromVaultGetConfig(host: VimConfigHost): boolean | undefined {
	if (typeof host.vault?.getConfig === 'function') {
		const result = host.vault.getConfig('vimMode');
		if (typeof result === 'boolean') {
			return result;
		}
	}
	return undefined;
}

/**
 * Tier 2: Inspects app.vault.config.vimMode property.
 * Honest function: only reads explicit argument, no side effects.
 */
export function detectVimFromVaultConfigObject(host: VimConfigHost): boolean | undefined {
	if (typeof host.vault?.config?.vimMode === 'boolean') {
		return host.vault.config.vimMode;
	}
	return undefined;
}

/**
 * Tier 3: Calls app.isVimEnabled() method.
 * Honest function: only reads explicit argument, no side effects.
 */
export function detectVimFromAppMethod(host: VimConfigHost): boolean | undefined {
	if (typeof host.isVimEnabled === 'function') {
		return Boolean(host.isVimEnabled());
	}
	return undefined;
}

/**
 * Tier 4: Inspects app.internalPlugins.plugins['editor'].instance.options.vimMode.
 * Honest function: only reads explicit argument, no side effects.
 */
export function detectVimFromInternalPlugins(host: VimConfigHost): boolean | undefined {
	const option = host.internalPlugins?.plugins?.editor?.instance?.options?.vimMode;
	if (typeof option === 'boolean') {
		return option;
	}
	return undefined;
}

/**
 * Tier 5: Checks global CodeMirrorAdapter.Vim for legacy/fallback support.
 * Honest function: takes explicit global environment target.
 */
export function detectVimFromGlobalAdapter(globalScope: unknown): boolean | undefined {
	if (globalScope && typeof globalScope === 'object') {
		const adapter = (globalScope as Record<string, unknown>).CodeMirrorAdapter;
		if (adapter && typeof adapter === 'object') {
			const hasVim = 'Vim' in adapter && Boolean((adapter as Record<string, unknown>).Vim);
			if (hasVim) {
				return true;
			}
		}
	}
	return undefined;
}

/**
 * Normalizes an unknown target (e.g. Plugin instance or App object) into a VimConfigHost.
 * Pure honest function.
 */
export function extractVimConfigHost(target: unknown): VimConfigHost {
	if (!target || typeof target !== 'object') {
		return {};
	}
	const candidate = target as Record<string, unknown>;
	if (candidate.app && typeof candidate.app === 'object') {
		return candidate.app as VimConfigHost;
	}
	return candidate as VimConfigHost;
}

/**
 * Ordered list of detection tiers evaluated sequentially.
 */
const DETECTION_TIERS: readonly VimModeDetector[] = Object.freeze([
	detectVimFromVaultGetConfig,
	detectVimFromVaultConfigObject,
	detectVimFromAppMethod,
	detectVimFromInternalPlugins,
]);

/**
 * Resolves Vim mode across all detection tiers.
 * Honest function: accepts explicit host and global scope.
 */
export function resolveVimModeFromHost(
	host: VimConfigHost,
	globalScope: unknown = typeof window !== 'undefined' ? window : globalThis
): boolean {
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

/**
 * Public detection entry point. Accepts Plugin, App, or mock host.
 * Honest function: extracts host and resolves Vim mode cleanly.
 */
export function isVimEnabled(
	target: unknown,
	globalScope: unknown = typeof window !== 'undefined' ? window : globalThis
): boolean {
	const host = extractVimConfigHost(target);
	return resolveVimModeFromHost(host, globalScope);
}

// ============================================================================
// CodeMirror 6 Extension Builders (Pure Honest Functions)
// ============================================================================

/**
 * Pure builder returning the Vim extension array or empty array.
 */
export function createVimExtension(enabled: boolean): Extension {
	return enabled ? vim() : [];
}

/**
 * Creates a dedicated CM6 Compartment for Vim reconfiguration.
 */
export function createVimCompartment(): Compartment {
	return new Compartment();
}

/**
 * Wraps the Vim extension in a compartment for initial editor state.
 */
export function createVimCompartmentExtension(
	compartment: Compartment,
	enabled: boolean
): Extension {
	return compartment.of(createVimExtension(enabled));
}

/**
 * Creates a StateEffect that reconfigures the Vim compartment.
 */
export function reconfigureVimCompartment(
	compartment: Compartment,
	enabled: boolean
): StateEffect<unknown> {
	return compartment.reconfigure(createVimExtension(enabled));
}
