/** Installing, choosing and removing themes: storage on one side, the engine on the other. */

import { compileTheme } from './compile'
import { applyTheme, clearTheme, discordEnv } from './engine'
import { jsHealth } from './health'
import { discordBuild, watchLaunch } from './launchGuard'
import { fetchManifest } from './manifest'
import { clearPreviewCache } from './preview'
import { getStorage, patch, report, settings, whenLoaded } from './state'
import type { InstalledTheme, ThemeManifest } from '../types'

/** How many of Discord's colours the applied theme reaches, for the selected card. */
let lastCoverage: { covered: number; total: number } | undefined

export function coverage(): { covered: number; total: number } | undefined {
	return lastCoverage
}

/** Old colour names the applied theme sets that this Discord doesn't have and nothing translates. */
let lastUnplaced: string[] = []

export function unplacedNames(): string[] {
	return lastUnplaced
}

function apply(manifest: ThemeManifest, live: boolean) {
	lastCoverage = undefined
	lastUnplaced = []
	applyTheme(() => {
		const { definition, legacy, palette } = compileTheme(
			manifest,
			discordEnv(),
			settings(),
		)
		if (legacy) {
			const { filled, greys, skippedGreys, unplaced } = legacy
			lastUnplaced = unplaced
			report(
				'old colour names',
				`${filled} filled${unplaced.length ? `; not placed: ${unplaced.join(', ')}` : ''}`,
			)
			report(
				'old grey ramp',
				`${greys} filled${skippedGreys.length ? `; kept Discord's ${skippedGreys.join(', ')} (would flip light/dark)` : ''}`,
			)
		}
		if (palette) {
			const { added, readable, unmatched, covered, total } = palette
			lastCoverage = { covered, total }
			report(
				'complete palette',
				`${covered}/${total} colours follow the theme (${added} filled, ${readable} made readable)${unmatched.length ? `; no example for: ${unmatched.join(', ')}` : ''}`,
			)
		}
		return definition
	}, live)
}

export async function installTheme(input: string): Promise<ThemeManifest> {
	const url = input.trim()
	if (!/^https?:\/\//i.test(url))
		throw new Error('Paste a link starting with https://')
	if (settings().themes.some(theme => theme.id === url))
		throw new Error('That theme is already installed')

	const manifest = await fetchManifest(url)
	// Re-read: the list may have changed while the download ran.
	const themes = settings().themes.filter(theme => theme.id !== url)
	patch({ themes: [...themes, { id: url, manifest }] })
	clearPreviewCache()
	return manifest
}

/** `''` goes back to Discord's own colours. Throws if the theme can't be applied. */
export function selectTheme(id: string) {
	if (!id) {
		clearTheme(true)
		patch({ selected: '' })
		return
	}
	const theme = settings().themes.find(entry => entry.id === id)
	if (!theme) throw new Error('That theme is no longer installed')
	apply(theme.manifest, true)
	patch({ selected: id, skippedAtLaunch: false })
}

/** Downloads the theme again, and re-applies it if it's the one in use. */
export async function refetchTheme(id: string): Promise<ThemeManifest> {
	const manifest = await fetchManifest(id)
	const themes: InstalledTheme[] = settings().themes.map(theme =>
		theme.id === id ? { id, manifest } : theme,
	)
	patch({ themes })
	clearPreviewCache()
	if (settings().selected === id) apply(manifest, true)
	return manifest
}

export function removeTheme(id: string) {
	if (settings().selected === id) selectTheme('')
	patch({ themes: settings().themes.filter(theme => theme.id !== id) })
}

/** Applies the stored choice again after an option that changes the colours. */
export function reapplySelected() {
	const { selected, themes } = settings()
	const theme = selected
		? themes.find(entry => entry.id === selected)
		: undefined
	if (theme) apply(theme.manifest, true)
}

/**
 * Applies the stored theme at launch, behind a guard (`lib/launchGuard.ts`).
 *
 * `applyingAtLaunch` is written, and awaited to disk, before the theme goes on, and cleared once
 * Discord is up and drawing without errors, or once the user leaves or reloads. If it is still set
 * at the next launch, the last one died or hit Discord's crash screen with the theme on, so this
 * one starts on Discord's colours instead and says so. The crash in 0.1.1 left no way back in
 * short of reinstalling; this is so that can't happen again.
 *
 * On a Discord build the theme has never come up safely on (`safeBuild`), the theme isn't written
 * before the first screen at all: Discord starts on its own colours and the theme goes on once the
 * launch is healthy, so a Discord update that breaks theming can't stop Discord opening. From the
 * next launch on that build, it applies early again.
 */
export async function applyAtLaunch(
	onLateApply?: () => void,
): Promise<() => void> {
	const storage = getStorage()
	await whenLoaded()
	const { selected, themes, applyingAtLaunch } = settings()
	if (!selected) return () => {}

	if (applyingAtLaunch) {
		report(
			'apply',
			`skipped: the last launch ${settings().lastCrash || 'did not finish'} with the theme on`,
		)
		await storage?.set({ applyingAtLaunch: false, skippedAtLaunch: true })
		return () => {}
	}

	const theme = themes.find(entry => entry.id === selected)
	if (!theme) {
		report('apply', 'selected theme is missing; using Discord colours')
		patch({ selected: '' })
		return () => {}
	}

	const build = discordBuild()
	const newBuild = !buildChecked(build)
	await storage?.set({
		applyingAtLaunch: true,
		skippedAtLaunch: false,
		lastCrash: '',
	})
	if (!newBuild) apply(theme.manifest, false)
	else
		report(
			'apply',
			`Discord ${build || '(unknown build)'} is new to this theme; applying once it is up`,
		)

	return watchLaunch({
		onSafe() {
			if (newBuild) {
				apply(theme.manifest, true)
				onLateApply?.()
			}
			const missing = jsHealth().filter(part => part.status === 'missing')
			const checked = settings().checkedBuilds ?? []
			const add = build && !missing.length && !checked.includes(build)
			patch({
				applyingAtLaunch: false,
				safeBuild: build,
				...(add ? { checkedBuilds: [...checked, build].slice(-20) } : {}),
			})
			report(
				'launch guard',
				`healthy on Discord ${build}${missing.length ? `; not marked checked, missing: ${missing.map(p => p.feature).join(', ')}` : ''}`,
			)
		},
		onCrash(reason) {
			// The flag stays armed: the next launch skips the theme.
			patch({ lastCrash: reason })
			report('launch guard', `launch failed with the theme on: ${reason}`)
		},
		onLeft() {
			return storage?.set({ applyingAtLaunch: false })
		},
	})
}

/**
 * Whether a theme has come up fine on this Discord build before (plan step B2). `safeBuild` is the
 * older single-build record, still honoured so an update to this version doesn't re-check.
 */
export function buildChecked(build = discordBuild()): boolean {
	if (!build) return false
	const { checkedBuilds, safeBuild } = settings()
	return build === safeBuild || !!checkedBuilds?.includes(build)
}

/** Whether the last launch skipped the theme, for the settings page. */
export function skippedAtLaunch(): boolean {
	return !!settings().skippedAtLaunch
}
