/**
 * `globalThis.__bleelblepThemes`: what Quick Toggles' Theming section uses to list and switch
 * themes, fonts and icon packs. JS to JS, because Themes keeps nothing in native to flip.
 *
 * Switching goes through the same functions as Themes' own pages, but never opens the Reload
 * Required alert: the caller is already an alert, and two stacked alerts misbehave (seen
 * 2026-09-28). It marks the reload as needed; the caller calls `askForReload()` once its own
 * alert has closed (version 2), or offers `reload()` itself.
 */

import {
	askForReload,
	isReloadNeeded,
	markReloadNeeded,
	reloadDiscord,
} from '../ui/actions'
import { selectFont } from './fonts'
import { allPacks, selectIconPack } from './icons'
import { settings } from './state'
import { selectTheme } from './themes'

export interface Choice {
	id: string
	name: string
}

export interface ThemingSnapshot {
	themes: { selected: string; options: Choice[] }
	fonts: { selected: string; options: Choice[] }
	icons: { selected: string; options: Choice[] }
	reloadNeeded: boolean
}

function snapshot(): ThemingSnapshot {
	const s = settings()
	return {
		themes: {
			selected: s.selected,
			options: s.themes.map(theme => ({
				id: theme.id,
				name: theme.manifest.name,
			})),
		},
		fonts: {
			selected: s.selectedFont,
			options: s.fonts.map(font => ({ id: font.id, name: font.manifest.name })),
		},
		icons: {
			selected: s.selectedIconPack,
			options: allPacks().map(pack => ({ id: pack.id, name: pack.name })),
		},
		reloadNeeded: isReloadNeeded(),
	}
}

const api = {
	version: 2,
	snapshot,
	/** `''` is Discord's own, for each of the three. */
	async setTheme(id: string) {
		selectTheme(id)
		markReloadNeeded()
		return snapshot()
	},
	async setFont(id: string) {
		await selectFont(id)
		markReloadNeeded()
		return snapshot()
	},
	async setIconPack(id: string) {
		await selectIconPack(id)
		markReloadNeeded()
		return snapshot()
	},
	reload: reloadDiscord,
	/** Themes' Reload Required alert. Only once the caller's own alert is gone. */
	askForReload,
}

export function registerBridge(): () => void {
	const g = globalThis as any
	g.__bleelblepThemes = api
	return () => {
		if (g.__bleelblepThemes === api)
			Reflect.deleteProperty(g, '__bleelblepThemes')
	}
}
