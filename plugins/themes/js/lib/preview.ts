/**
 * A theme's colours worked out without applying it, for the picker's preview and swatches.
 *
 * Runs the same pipeline as applying (`compileTheme` in `compile.ts`), against Discord's *own*
 * colours, which the engine keeps while another theme is applied (`discordRaw` /
 * `discordEntry`), and resolves colour names the way Discord's
 * `resolveSemanticColor` does: the semantic entry for the theme picks a raw colour and an opacity.
 */

import { compileTheme, referenceTheme } from './compile'
import { discordEntry, discordEnv, discordRaw, discordTheme } from './engine'
import { settings } from './state'
import type { ThemeManifest } from '../types'

export type Resolve = (name: string, fallback: string) => string

function withOpacity(hex: string, opacity: number): string {
	const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex)
	if (!m || opacity >= 0.999) return hex
	const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
	return `#${m[1]}${a.toString(16).padStart(2, '0')}`
}

/** Discord's colours for the Discord theme in use, as the picker's "Discord" swatch shows them. */
export function discordColours(): Resolve {
	const theme = discordTheme()
	return (name, fallback) => {
		const entry = discordEntry(name, theme) ?? discordEntry(name, 'darker')
		const raw = entry?.raw ? discordRaw(entry.raw) : undefined
		return raw ? withOpacity(raw, entry?.opacity ?? 1) : fallback
	}
}

/** One cached result per theme and settings, since the picker re-renders on every swipe. */
const cache = new Map<string, Resolve>()

export function themeColours(id: string, manifest: ThemeManifest): Resolve {
	const s = settings()
	const key = `${id}|${s.typeOverride}|${s.translateLegacy}|${s.completePalette}|${s.matchNavBar !== false}|${s.showBackground}|${s.chatInputFade !== false}|${discordTheme()}`
	const hit = cache.get(key)
	if (hit) return hit

	let resolve: Resolve
	try {
		const def = compileTheme(manifest, discordEnv(), s).definition
		const reference = referenceTheme(def.type)
		resolve = (name, fallback) => {
			const own = def.semantic[name]
			if (own) return withOpacity(own.value, own.opacity)
			const entry = discordEntry(name, reference)
			if (!entry?.raw) return fallback
			const raw = def.raw[entry.raw] ?? discordRaw(entry.raw)
			return raw ? withOpacity(raw, entry.opacity ?? 1) : fallback
		}
	} catch {
		resolve = discordColours()
	}
	cache.set(key, resolve)
	return resolve
}

/** Forget cached previews: after an install, update or option change. */
export function clearPreviewCache() {
	cache.clear()
}
