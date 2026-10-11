import { DEFAULTS } from '../defaults'
import { packById, useEmojiState } from '../lib/emoji'
import { getStorage, report } from '../lib/state'
import { afterRevengeSection } from '../vendor/afterRevengeSection'
import { rowIcon } from './icon'
import Appearance from './pages/Appearance'
import Compatibility from './pages/Compatibility'
import Debug from './pages/Debug'
import Emoji from './pages/Emoji'
import EmojiList from './pages/EmojiList'
import EmojiPack from './pages/EmojiPack'
import EmojiVendor from './pages/EmojiVendor'
import Font from './pages/Font'
import Fonts from './pages/Fonts'
import IconPackPage from './pages/IconPack'
import Icons from './pages/Icons'
import Library from './pages/Library'
import License from './pages/License'
import Settings from './pages/Settings'
import Theme from './pages/Theme'

const PREFIX = 'bleelblep.themes'

export const THEMES_ROUTE = `${PREFIX}.themes`
export const DEBUG_ROUTE = `${PREFIX}.debug`
export const APPEARANCE_ROUTE = `${PREFIX}.appearance`
export const COMPATIBILITY_ROUTE = `${PREFIX}.compatibility`
export const LICENSE_ROUTE = `${PREFIX}.license`
export const THEME_ROUTE = `${PREFIX}.theme`
export const FONTS_ROUTE = `${PREFIX}.fonts`
export const FONT_ROUTE = `${PREFIX}.font`
export const ICONS_ROUTE = `${PREFIX}.icons`
export const ICON_PACK_ROUTE = `${PREFIX}.iconpack`
export const EMOJI_ROUTE = `${PREFIX}.emoji`
export const EMOJI_PACK_ROUTE = `${PREFIX}.emojipack`
export const EMOJI_VENDOR_ROUTE = `${PREFIX}.emojivendor`
export const EMOJI_LIST_ROUTE = `${PREFIX}.emojilist`
export const SETTINGS_ROUTE = `${PREFIX}.settings`

/**
 * Which theme the theme page shows. Passed as a navigation param too; this is the fallback for a
 * navigator that drops params on registered settings routes.
 */
let viewing = ''

export function setViewing(id: string) {
	viewing = id
}

export function getViewing(): string {
	return viewing
}

/**
 * A settings section of its own, for Themes, Fonts, Icons, Emoji and Settings: directly under Revenge's section and
 * above Plugin Hub's (the user's choice, 2026-09-28).
 *
 * Revenge splices each registered section into Discord's list at its `index`, in registration
 * order (revenge-bundle-next `src/plugins/start/settings/index.ts`), and 0 is falsy there. Both this
 * and Plugin Hub register when the settings modules load, so which is spliced first is chance. So
 * the two agree through a flag: reading this section's index (always 1) sets it for the rest of the
 * splice loop, and Plugin Hub's index getters read it and move down one when it's set. The loop is
 * synchronous, so a microtask clears the flag before the next rebuild.
 */
const SECTION = 'BLEELBLEP_THEMING'
const SECTION_LABEL = 'Theming'
const PLACED_FLAG = '__bleelblepThemingPlaced'

function sectionIndex(): number {
	const g = globalThis as any
	if (!g[PLACED_FLAG]) {
		g[PLACED_FLAG] = true
		Promise.resolve().then(() => {
			g[PLACED_FLAG] = false
		})
	}
	return 1
}

/**
 * Upstream commit 10371ff merged `refreshSettingsNavigator` + `refreshSettingsOverviewScreen`
 * into `refreshSettings`. Which exists depends on the bundle the user is running, so call
 * whichever is actually there.
 */
function refreshSettingsUI() {
	const settings = revenge.discord.modules.settings as any
	if (typeof settings.refreshSettings === 'function') {
		settings.refreshSettings()
		return
	}
	settings.refreshSettingsNavigator?.()
	settings.refreshSettingsOverviewScreen?.()
}

/** The row's trailing text: the theme in use, or Off. A hook, so it follows storage. */
function useThemeName(): string {
	const s = { ...DEFAULTS, ...(getStorage()?.use() ?? {}) }
	return s.themes.find(theme => theme.id === s.selected)?.manifest.name ?? 'Off'
}

/** The Fonts row's trailing text: the font in use, or Off. */
function useFontName(): string {
	const s = { ...DEFAULTS, ...(getStorage()?.use() ?? {}) }
	return (
		s.fonts.find(font => font.id === s.selectedFont)?.manifest.name ?? 'Off'
	)
}

/** The Icons row's trailing text: the pack in use, or Off. */
function useIconPackName(): string {
	const s = { ...DEFAULTS, ...(getStorage()?.use() ?? {}) }
	return s.selectedIconPack ? (s.iconPack?.name ?? 'On') : 'Off'
}

/** The Emoji row's trailing text: the pack in use, or Off. */
function useEmojiPackName(): string {
	const [state] = useEmojiState()
	return packById(state.selected)?.name ?? 'Off'
}

/**
 * Themes (straight to Your themes), Fonts, Icons, Emoji and Settings rows in the Theming section. The other
 * pages are plain routes with no row.
 */
export function registerPages(): () => void {
	const {
		registerSettingsItem,
		onSettingsModulesLoaded,
		registerSettingsSection,
	} = revenge.discord.modules.settings as any

	const page = (
		route: string,
		title: string,
		component: any,
		extra: Record<string, any> = {},
	) =>
		registerSettingsItem(route, {
			parent: null,
			type: 'route',
			useTitle: () => title,
			screen: { route, getComponent: () => component },
			...extra,
		})

	let unregister: Array<() => void> = []
	let cancelWait: (() => void) | undefined
	const unsubscribe = onSettingsModulesLoaded(() => {
		unregister = [
			page(THEMES_ROUTE, 'Themes', Library, {
				IconComponent: () => rowIcon('PaintPaletteIcon', 'ic_theme_24px'),
				useTrailing: useThemeName,
			}),
			page(APPEARANCE_ROUTE, 'Appearance', Appearance),
			page(COMPATIBILITY_ROUTE, 'Compatibility', Compatibility),
			page(LICENSE_ROUTE, 'Licence', License),
			page(THEME_ROUTE, 'Theme', Theme),
			page(FONTS_ROUTE, 'Fonts', Fonts, {
				IconComponent: () => rowIcon('TextIcon', 'ic_text'),
				useTrailing: useFontName,
			}),
			page(FONT_ROUTE, 'Font', Font),
			page(ICONS_ROUTE, 'Icons', Icons, {
				IconComponent: () => rowIcon('ImageIcon', 'ic_image'),
				useTrailing: useIconPackName,
			}),
			page(ICON_PACK_ROUTE, 'Icon pack', IconPackPage),
			page(EMOJI_ROUTE, 'Emoji', Emoji, {
				IconComponent: () => rowIcon('ReactionIcon', 'ic_emoji_24px'),
				useTrailing: useEmojiPackName,
			}),
			page(EMOJI_PACK_ROUTE, 'Emoji pack', EmojiPack),
			page(EMOJI_LIST_ROUTE, 'All emoji', EmojiList),
			page(EMOJI_VENDOR_ROUTE, 'Emoji packs', EmojiVendor),
			page(SETTINGS_ROUTE, 'Settings', Settings, {
				IconComponent: () => rowIcon('SettingsIcon', 'ic_settings'),
			}),
			page(DEBUG_ROUTE, 'Debug', Debug),
		]

		refreshSettingsUI()
		// After Revenge's own section, or ours is placed under Discord's Account Settings.
		cancelWait = afterRevengeSection(() => {
			try {
				unregister.push(
					registerSettingsSection(SECTION, {
						label: SECTION_LABEL,
						settings: [
							THEMES_ROUTE,
							FONTS_ROUTE,
							ICONS_ROUTE,
							EMOJI_ROUTE,
							SETTINGS_ROUTE,
						],
						get index() {
							return sectionIndex()
						},
					}),
				)
				report('settings row', `in a ${SECTION_LABEL} section of its own`)
			} catch (error) {
				report(
					'settings row',
					`no ${SECTION_LABEL} section: ${(error as Error)?.message ?? error}`,
				)
			}
			refreshSettingsUI()
		})
	})

	return () => {
		cancelWait?.()
		unsubscribe()
		for (const remove of unregister) {
			try {
				remove()
			} catch {
				/* already gone */
			}
		}
		unregister = []
		refreshSettingsUI()
	}
}
