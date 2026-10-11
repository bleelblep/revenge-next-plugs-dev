/**
 * Applies a theme by rewriting Discord's own colour tables. Discord's theme name never changes.
 *
 * Discord resolves a semantic colour as `SemanticColor[name][theme]` -> `{ raw, opacity }` ->
 * `RawColor[raw]` (`resolveSemanticColor(theme, colour, context)`). So for every semantic row and
 * every one of Discord's themes (light, dark = Ash, darker = Dark, midnight = Onyx), the entry is
 * replaced:
 *
 * - a colour the theme sets points at a raw colour of our own holding it;
 * - a colour it doesn't set takes the entry of the Discord theme it is based on (`darker` for a
 *   dark theme, `light` for a light one), so the palette is consistent whichever Discord theme is
 *   picked underneath.
 *
 * The theme's raw colours are written over Discord's too. Everything written is recorded and put
 * back when the theme goes.
 *
 * Why not register the theme under a name of its own, as classic did: on 348,
 * `resolveSemanticColor` runs the name through `sanitizeTheme`, which throws
 * `Invalid theme: <name>` for anything but Discord's four. Themes 0.1.1 forced a custom name into
 * ThemeStore and Discord crashed on launch with exactly that (logcat, 348.5). Keeping Discord's
 * name means nothing to validate, nothing to keep out of storage, nothing to tell native.
 *
 * The cost: colours resolved before a switch can be cached per theme name, so switching while
 * Discord is open needs a reload to finish everywhere. At launch the tables are written before
 * most of the UI draws.
 */

import { debug, report } from './state'
import type { ColorDefinition } from '../types'
import type { CompileEnv } from './compile'

/** Raw colours this plugin adds, one per themed semantic colour. */
const SYNTH_PREFIX = 'BLEELBLEP_THEME__'
const DISCORD_THEMES = ['light', 'dark', 'darker', 'midnight']

let active: ColorDefinition | undefined

/**
 * Every table write, to undo: `had` false means the key was ours and is deleted instead. `wrote` is
 * what we put there, so a key someone else changed since is left alone.
 */
let undo: Array<{
	table: any
	key: string
	had: boolean
	value: unknown
	wrote: unknown
}> = []

/** `Object.hasOwn` isn't guaranteed on Discord's Hermes. */
function hasOwn(object: object, key: string): boolean {
	return Object.hasOwn(object, key)
}

function tokens(): any {
	return (revenge.discord.common as any).tokens?.Tokens
}

function themeStore(): any {
	return (revenge.discord.flux.Stores as any).ThemeStore
}

/** The Discord theme in use: `light`, `dark` (Ash), `darker` (Dark) or `midnight` (Onyx). */
export function discordTheme(): string {
	try {
		const theme = themeStore()?.theme
		return typeof theme === 'string' ? theme : 'darker'
	} catch {
		return 'darker'
	}
}

export function prefersLight(): boolean {
	return discordTheme() === 'light'
}

export function isActive(): boolean {
	return !!active
}

export function activeType(): ColorDefinition['type'] | undefined {
	return active?.type
}

export function activeBackground(): ColorDefinition['background'] {
	return active?.background
}

/** Discord's own value for every table key this plugin has written, until it's put back. */
let originals = new Map<any, Map<string, { had: boolean; value: unknown }>>()

function write(table: any, key: string, value: unknown) {
	const had = hasOwn(table, key)
	const before = table[key]
	table[key] = value
	// A frozen table drops the write silently: nothing to undo, nothing to remember.
	if (table[key] !== value) return
	undo.push({ table, key, had, value: before, wrote: value })
	let keys = originals.get(table)
	if (!keys) originals.set(table, (keys = new Map()))
	if (!keys.has(key)) keys.set(key, { had, value: before })
}

/** Discord's own value, whether or not a theme has changed it. */
function discordValue(table: any, key: string): unknown {
	const saved = originals.get(table)?.get(key)
	if (saved) return saved.had ? saved.value : undefined
	return table?.[key]
}

/** Discord's own raw colour, ignoring the applied theme. */
export function discordRaw(name: string): string | undefined {
	const value = discordValue(tokens()?.RawColor, name)
	return typeof value === 'string' ? value : undefined
}

/** Discord's own semantic entry for one of its themes, ignoring the applied theme. */
export function discordEntry(
	name: string,
	theme: string,
): { raw: string; opacity?: number } | undefined {
	const row = tokens()?.SemanticColor?.[name]
	const value = row ? discordValue(row, theme) : undefined
	return value && typeof value === 'object' ? (value as any) : undefined
}

/** Every semantic colour name Discord has. */
export function discordNames(): string[] {
	return Object.keys(tokens()?.SemanticColor ?? {})
}

/** Discord's own colours, for `compileTheme` (`compile.ts`). Read once per call. */
export function discordEnv(): CompileEnv {
	return {
		raw: discordRaw,
		entry: discordEntry,
		names: discordNames(),
		prefersLight: prefersLight(),
	}
}

/** `RawColor` and, if Discord keeps a separate object, `unsafe_rawColors` too. */
function rawTables(): any[] {
	const T = tokens()
	return [...new Set([T?.RawColor, T?.default?.unsafe_rawColors])].filter(
		table => table && typeof table === 'object',
	)
}

function restore() {
	// Newest first, so a key written twice ends at its original value. A key that no longer holds
	// what we wrote was changed by someone else since (another theme plugin, say Themeify): theirs
	// stays. Earlier writes to that key are then stale too, so they're skipped the same way.
	let kept = 0
	for (const { table, key, had, value, wrote } of undo.reverse()) {
		try {
			if (table[key] !== wrote) {
				kept++
				continue
			}
			if (had) table[key] = value
			else delete table[key]
		} catch {
			/* a frozen table never took the write either */
		}
	}
	if (kept)
		report('clear', `left ${kept} colours another plugin changed after us`)
	undo = []
	originals = new Map()
}

/** Writes the theme into Discord's tables. Throws if the tables aren't there. */
function writeTables(def: ColorDefinition) {
	const T = tokens()
	const Semantic = T?.SemanticColor
	if (!T?.RawColor || !Semantic)
		throw new Error("Discord's colour tables weren't found")

	for (const [key, value] of Object.entries(def.raw)) {
		for (const table of rawTables())
			if (hasOwn(table, key)) write(table, key, value)
	}

	const reference = def.type === 'light' ? 'light' : 'darker'
	let themed = 0
	let rows = 0

	for (const name of Object.keys(Semantic)) {
		const row = Semantic[name]
		if (!row || typeof row !== 'object') continue
		const base = row[reference]
		if (!base || typeof base !== 'object') continue

		const own = def.semantic[name]
		let entry = { ...base }
		if (own) {
			const synth = `${SYNTH_PREFIX}${name}`
			for (const table of rawTables()) write(table, synth, own.value)
			entry = { ...base, raw: synth, opacity: own.opacity }
			themed++
		}
		for (const theme of DISCORD_THEMES) {
			if (row[theme] && typeof row[theme] === 'object')
				write(row, theme, { ...entry })
		}
		rows++
	}

	// A frozen table drops writes silently; check one instead of trusting it.
	const probe = Object.keys(def.raw).find(k => hasOwn(T.RawColor, k))
	if (probe && T.RawColor[probe] !== def.raw[probe])
		report('raw colours', 'table is read-only')

	debug(
		`wrote ${rows} rows (${themed} themed) on a ${reference} base, ${Object.keys(def.raw).length} raw`,
	)
}

/** Nudges everything that listens to ThemeStore to draw again with the new tables. */
function repaint() {
	try {
		themeStore()?.emitChange?.()
	} catch (error) {
		debug('ThemeStore.emitChange threw:', error)
	}
}

/**
 * Takes a builder rather than a definition: it runs after the previous theme's colours are put
 * back, so a spec-3 colour that names a raw colour reads Discord's, not the last theme's.
 */
export function applyTheme(build: () => ColorDefinition, live: boolean) {
	restore()
	const def = build()
	try {
		writeTables(def)
	} catch (error) {
		restore()
		throw error
	}
	active = def
	if (live) repaint()
	report(
		'apply',
		`on (${def.type}), ${Object.keys(def.semantic).length} colours`,
	)
}

/** Discord's own colours back. */
export function clearTheme(live: boolean) {
	if (!active && !undo.length) return
	active = undefined
	restore()
	if (live) repaint()
	report('apply', 'off, Discord colours')
}
