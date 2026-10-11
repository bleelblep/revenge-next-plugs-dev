// Shared by the Themes tests: Discord's colour tables from a saved dump, and the test themes.
//   node --import ./plugins/themes/tests/ts-resolve.mjs --test plugins/themes/tests/*.test.mjs
import { readdirSync, readFileSync } from 'node:fs'

const here = new URL('.', import.meta.url)

/** A dump written by docs/debugging/scripts/discord_diff.py. */
export function discord(version) {
	return JSON.parse(
		readFileSync(new URL(`discord/${version}.json`, here), 'utf8'),
	)
}

/** `compileTheme`'s env from a dump, as `discordEnv()` builds it in the app. */
export function envFor(dump, prefersLight = false) {
	return {
		raw: name => dump.raw[name],
		entry: (name, theme) => dump.semantic[name]?.[theme] ?? undefined,
		names: Object.keys(dump.semantic),
		prefersLight,
	}
}

export const OPTIONS = {
	typeOverride: 'auto',
	translateLegacy: true,
	completePalette: true,
	matchNavBar: true,
	chatInputFade: true,
	showBackground: true,
}

/** Every test theme, as `fetchManifest` leaves it (spec defaults to 2). */
export function fixtures() {
	const dir = new URL('fixtures/', here)
	return readdirSync(dir)
		.filter(name => name.endsWith('.json'))
		.sort()
		.map(name => {
			const manifest = JSON.parse(readFileSync(new URL(name, dir), 'utf8'))
			manifest.spec ??= 2
			return { name: name.replace(/\.json$/, ''), manifest }
		})
}

export function fixture(name) {
	const found = fixtures().find(f => f.name === name)
	if (!found) throw new Error(`no fixture ${name}`)
	return found.manifest
}
