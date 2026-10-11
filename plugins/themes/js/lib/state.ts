import { DEFAULTS } from '../defaults'
import type { ThemesStorage } from '../types'

export const TAG = '[Themes]'

type Storage = RevengeJsonStorageApi<ThemesStorage>

let storage: Storage | undefined

/** One read of the file per start, shared: `get()` reads and parses it from disk every call. */
let loaded: Promise<unknown> | undefined

export function setStorage(value: Storage | undefined) {
	storage = value
	loaded = undefined
}

/** Resolves once storage has been read from disk; every launch step waits on this same read. */
export function whenLoaded(): Promise<unknown> {
	if (!loaded)
		loaded = storage ? Promise.resolve(storage.get()) : Promise.resolve()
	return loaded
}

/** This plugin, from `start()`. Its `requireReload()` makes Revenge show its Reload Required alert. */
let self: { requireReload: () => void } | undefined

export function setPlugin(value: typeof self) {
	self = value
}

export function getPlugin(): typeof self {
	return self
}

/** Sub-pages are plain navigator routes with no plugin `api` prop, so they read through this. */
export function getStorage(): Storage | undefined {
	return storage
}

/** Never reads `cache` without a fallback -- porting rule 7. */
export function settings(): ThemesStorage {
	return { ...DEFAULTS, ...(storage?.cache ?? {}) }
}

export function patch(value: Partial<ThemesStorage>) {
	try {
		storage?.set(value)
	} catch (error) {
		console.error(`${TAG} failed to write storage:`, error)
	}
}

export function debug(...args: unknown[]) {
	if (settings().debugLogging) console.log(TAG, ...args)
}

export function toast(content: string) {
	try {
		revenge.discord.actions.ToastActionCreators.open({
			key: 'ThemesToast',
			content,
		})
	} catch {
		/* a missing toast is never worth a crash */
	}
}

/**
 * What each hook actually did, for the Debug page and the log. Records the outcome, not the
 * attempt (porting rule 3: a page that says "patched" for a hook that never installed cost
 * another plugin fifteen releases).
 */
const hookStatus = new Map<string, string>()

export function report(name: string, outcome: string) {
	hookStatus.set(name, outcome)
	console.log(`${TAG} ${name}: ${outcome}`)
}

export function hookReport(): Array<[string, string]> {
	return [...hookStatus]
}

export function clearReport() {
	hookStatus.clear()
}
