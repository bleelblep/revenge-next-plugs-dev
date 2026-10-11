/**
 * Themes -- classic Revenge's colour themes on Revenge Next.
 *
 * A theme is written into Discord's own colour tables for all four of its themes
 * (`lib/engine.ts`); Discord's theme name never changes. Classic registered a theme name of its
 * own, which Discord 348 rejects: 0.1.0 was ignored, and 0.1.1 crashed at launch with
 * `Invalid theme` (see the notes in `lib/engine.ts`). The only other patch draws a theme's
 * background image in chat (`patches/background.tsx`).
 *
 * The stored theme is applied at launch behind a guard (`applyAtLaunch` in `lib/themes.ts`): if
 * Discord dies while it is on, the next launch starts on Discord's colours.
 *
 * A theme file becomes colours in one place (`lib/compile.ts`), shared by applying and the preview;
 * old colour names are translated by `lib/legacy.ts`. What Themes needs from Discord is listed by
 * `lib/health.ts` on the Debug page.
 *
 * Native half (src/main/kotlin): emoji packs (Emoji.kt). Chat message text is drawn natively from
 * Android theme getters and keeps Discord's colours; theming it is not started.
 */

import { CHANGELOG } from './changelog'
import { DEFAULTS } from './defaults'
import { registerBridge } from './lib/bridge'
import { clearTheme } from './lib/engine'
import { checkFontsAtLaunch, clearFontsJson } from './lib/fonts'
import { applyIconsAtLaunch, clearIcons } from './lib/icons'
import {
	clearReport,
	report,
	setPlugin,
	setStorage,
	toast,
	whenLoaded,
} from './lib/state'
import { applyAtLaunch } from './lib/themes'
import patchBackground from './patches/background'
import patchChatInputFade from './patches/chatInputFade'
import patchIconFit from './patches/iconFit'
import { markReloadNeeded } from './ui/actions'
import Settings from './ui/pages/Settings'
import { registerPages } from './ui/routes'
import { setupChangelog } from './vendor/changelog'
import type { ThemesStorage } from './types'

export { DEFAULTS }
export type { ThemesStorage }

export default plugin<{ jsonStorage: ThemesStorage }>({
	jsonStorage: {
		load: true,
		default: DEFAULTS,
	},

	start(api) {
		const { cleanup, jsonStorage } = api
		setStorage(jsonStorage)
		setPlugin(api.plugin)
		clearReport()
		cleanup(() => {
			setStorage(undefined)
			setPlugin(undefined)
		})

		// The Theming section first, and on every start. Before 0.2.10 a late start (an update
		// installed, or the plugin switched on mid-session) returned before this, so the section was
		// missing until Discord restarted.
		try {
			cleanup(registerPages())
		} catch (error) {
			report('settings pages', `failed: ${(error as Error)?.message ?? error}`)
		}

		// The changelog: clock icon on the settings page, "What's new" after an update.
		try {
			cleanup(setupChangelog(api, CHANGELOG))
		} catch (error) {
			report('changelog', `failed: ${(error as Error)?.message ?? error}`)
		}

		// Enabled mid-session, most colours on screen were resolved before the tables changed, so
		// the theme, fonts and icons wait for a reload. The settings pages above still work.
		if (api.plugin.startedLate) {
			api.plugin.requireReload()
			return
		}

		// How long each launch step takes, logged once all of them are done, for the Debug page and
		// the log: "launch timings: pages 3 ms · ...". Async steps count until they finish.
		const startedAt = Date.now()
		const timings: string[] = []
		const time = (name: string, since: number) =>
			timings.push(`${name} ${Date.now() - since} ms`)

		// Applied independently: a moved Discord module should cost one part, not all of them.
		const apply = (name: string, install: () => () => void) => {
			const since = Date.now()
			try {
				cleanup(install())
			} catch (error) {
				report(name, `failed: ${(error as Error)?.message ?? error}`)
			}
			time(name, since)
		}
		apply('chat background', patchBackground)
		apply('icon fit', patchIconFit)
		apply('message box fade', patchChatInputFade)
		apply('quick toggles', registerBridge)

		const readSince = Date.now()
		const ready = whenLoaded().then(() => time('storage read', readSince))
		const step = <T>(name: string, run: () => Promise<T>): Promise<T> => {
			const since = Date.now()
			return run().finally(() => time(name, since))
		}

		const icons = step('icons', () =>
			ready.then(() => applyIconsAtLaunch()),
		).catch(error =>
			report(
				'icon pack',
				`failed at launch: ${(error as Error)?.message ?? error}`,
			),
		)
		cleanup(clearIcons)

		const fonts = step('font', () => checkFontsAtLaunch())
			.then(rewritten => rewritten && markReloadNeeded())
			.catch(error =>
				report(
					'font',
					`failed at launch: ${(error as Error)?.message ?? error}`,
				),
			)

		const theme = step('theme', () =>
			applyAtLaunch(() => {
				markReloadNeeded()
				toast(
					'Discord updated, so your theme went on after launch. Reload to finish applying it.',
				)
			}),
		)
			.then(cancel => cleanup(cancel))
			.catch(error => {
				report(
					'apply',
					`failed at launch: ${(error as Error)?.message ?? error}`,
				)
				toast("Themes couldn't apply your theme; Discord's colours are in use")
			})

		time('start (sync part)', startedAt)
		Promise.allSettled([icons, fonts, theme]).then(() =>
			report(
				'launch timings',
				`${timings.join(' · ')} · all done ${Date.now() - startedAt} ms`,
			),
		)
	},

	stop(api) {
		try {
			clearTheme(true)
		} catch (error) {
			console.error('[Themes] could not put Discord colours back:', error)
		}
		try {
			clearFontsJson()
		} catch (error) {
			console.error('[Themes] could not put Discord fonts back:', error)
		}
		// Colours already resolved on screen stay until Discord redraws them.
		api.plugin.requireReload()
	},

	SettingsComponent: Settings,
})
