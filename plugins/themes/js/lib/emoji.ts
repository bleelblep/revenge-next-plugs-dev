/**
 * Emoji packs: one per visually distinct look, picked by hand (2026-10-06) after comparing every
 * pack side by side. Both sources are plain font files on GitHub:
 *
 * - **PoomSmart/EmojiFonts** (https://github.com/PoomSmart/EmojiFonts), release `17.0.0`: the current
 *   sets, Apple's `sbix` format.
 * - **SerenityOS** (https://github.com/SerenityOS/serenity, `Base/res/emoji`): its pixel-art emoji,
 *   BSD 2-Clause, built into a bitmap font that ships with Themes (`bundled:` links, no download).
 * - **zFont's host repository** (https://github.com/zFont/Host, `Font/Emoji`): older and other looks,
 *   Android's `CBDT` format (Windows 11 is a vector font). Re-releases of the same artwork, iOS sets
 *   and novelty edits were left out on purpose; new files there don't show up until added here.
 *
 * Names follow one pattern: the maker or set, then the variant; "Classic" marks an older look.
 * Native (Emoji.kt) downloads, loads and draws them; Preview.kt cuts a few emoji out of a font on
 * GitHub for previews.
 */

import { patch, settings, TAG } from './state'
import type { EmojiPack } from '../types'

export type { EmojiPack }

const POOM = 'https://github.com/PoomSmart/EmojiFonts/releases/download/17.0.0'
const ZFONT = 'https://raw.githubusercontent.com/zFont/Host/main/Font/Emoji'

const CURRENT = 'Current'
const CLASSIC = 'Classic'

function poom(
	id: string,
	name: string,
	file: string,
	size: number,
	vendor: string,
	art: string,
	open = false,
): EmojiPack {
	return {
		id,
		name,
		url: `${POOM}/${file}`,
		size,
		art,
		open,
		vendor,
		group: CURRENT,
		source: 'emojifonts',
	}
}

function zfont(
	id: string,
	name: string,
	path: string,
	size: number,
	vendor: string,
	group = CLASSIC,
): EmojiPack {
	const url = `${ZFONT}/${path.split('/').map(encodeURIComponent).join('/')}`
	return {
		id,
		name,
		url,
		size,
		art: `${vendor === 'Other' ? "Its makers'" : `${vendor}'s`} artwork, from zFont`,
		open: false,
		vendor,
		group,
		source: 'zfont',
	}
}

/** Every pack, in the order each maker's page lists them: current looks first, then classic ones. */
export const EMOJI_PACKS: EmojiPack[] = [
	poom(
		'apple',
		'Apple',
		'AppleColorEmoji.ttc',
		34.3,
		'Apple',
		"Apple's artwork",
	),
	poom(
		'apple-hd',
		'Apple HD',
		'AppleColorEmoji-HD.ttc',
		63.9,
		'Apple',
		"Apple's artwork, 160 px images",
	),
	poom(
		'apple-lq',
		'Apple Small',
		'AppleColorEmoji-LQ.ttc',
		14.7,
		'Apple',
		"Apple's artwork, lighter images",
	),
	poom(
		'apple-pixel',
		'Apple Pixel',
		'AppleColorEmoji-pixel.ttc',
		13.7,
		'Apple',
		"Apple's artwork, pixellated",
	),

	poom(
		'oneui',
		'Samsung One UI',
		'oneui.ttc',
		35.4,
		'Samsung',
		"Samsung's artwork",
	),
	zfont(
		'samsung-experience',
		'Samsung Experience',
		'SamsungPie.ttf',
		2.9,
		'Samsung',
	),
	zfont('samsung-classic', 'Samsung Classic', 'Samsung.ttf', 6.5, 'Samsung'),

	poom(
		'noto',
		'Noto',
		'noto-emoji.ttc',
		46.5,
		'Google',
		'Google, Apache 2.0 / OFL',
		true,
	),
	poom(
		'noto-3d',
		'Noto 3D',
		'noto-emoji-3D.ttc',
		61.5,
		'Google',
		'Google, Apache 2.0 / OFL',
		true,
	),
	poom(
		'blobmoji',
		'Blobmoji',
		'blobmoji.ttc',
		40.0,
		'Google',
		'Google blobs (blobmoji2), Apache 2.0',
		true,
	),
	zfont('android-pie', 'Android Pie', 'AndroidPEmoji.ttf', 13.4, 'Google'),
	zfont('android-lollipop', 'Android Lollipop', 'Android.L.ttf', 4.9, 'Google'),

	zfont(
		'fluent-3d',
		'Fluent 3D',
		'2024/FluentUI3D_U15.1.ttf',
		32.1,
		'Microsoft',
		CURRENT,
	),
	zfont('windows-11', 'Windows 11', 'Windows11.ttf', 2.6, 'Microsoft', CURRENT),
	zfont('windows-10', 'Windows 10', 'Windows10Emoji.ttf', 16.4, 'Microsoft'),

	zfont(
		'facebook',
		'Facebook',
		'2024/Facebook15.0.ttf',
		36.9,
		'Facebook',
		CURRENT,
	),
	zfont(
		'facebook-classic',
		'Facebook Classic',
		'FacebookEmoji.ttf',
		18.0,
		'Facebook',
	),

	poom(
		'whatsapp',
		'WhatsApp',
		'whatsapp.ttc',
		61.2,
		'WhatsApp',
		"WhatsApp's artwork",
	),

	poom(
		'twemoji',
		'Twemoji',
		'twemoji.ttc',
		38.4,
		'Twitter',
		'Twitter / jdecked, CC-BY 4.0',
		true,
	),
	zfont('twemoji-classic', 'Twemoji Classic', 'Twitter.ttf', 2.5, 'Twitter'),

	zfont(
		'joypixels',
		'JoyPixels',
		'2024/Joypixel_v9.0(MFFMEmoji).ttf',
		13.1,
		'JoyPixels',
		CURRENT,
	),

	poom(
		'openmoji',
		'OpenMoji',
		'openmoji.ttc',
		35.9,
		'Other',
		'HfG Schwäbisch Gmünd, CC-BY-SA 4.0',
		true,
	),
	zfont('emojidex', 'EmojiDex', 'EmojiDex.ttf', 33.3, 'Other', CURRENT),
	zfont(
		'harmonyos',
		'HarmonyOS',
		'2024/HarmonyOS_4.0.ttf',
		41.5,
		'Other',
		CURRENT,
	),
	zfont('htc-sense', 'HTC Sense', 'HTC.Sense.ttf', 5.1, 'Other'),
	zfont('lg', 'LG', 'LG.ttf', 6.2, 'Other'),
	zfont('vsmart', 'Vsmart', 'Vsmart_13.1.ttf', 10.2, 'Other'),

	// Ships inside the plugin ZIP (assets/emoji): a bitmap build of SerenityOS's art
	// (tools/build_serenity_emoji.py), so it draws below Android 13 too, unlike linusg's COLRv1 font.
	{
		id: 'serenityos',
		name: 'SerenityOS',
		url: 'bundled:serenityos.ttf',
		size: 0.7,
		art: 'SerenityOS pixel art, BSD 2-Clause',
		open: true,
		vendor: 'Other',
		group: CURRENT,
		source: 'serenityos',
	},
]

/** Makers in the order the Emoji page lists them. */
export const VENDORS = [
	'Apple',
	'Samsung',
	'Google',
	'Microsoft',
	'Facebook',
	'WhatsApp',
	'Twitter',
	'JoyPixels',
	'Other',
]

/** Every pack, plus any downloaded one this list no longer has (so it can still be used or removed). */
export function allEmojiPacks(): EmojiPack[] {
	const ids = new Set(EMOJI_PACKS.map(pack => pack.id))
	const gone = Object.values(settings().emojiKnown ?? {}).filter(
		pack => pack && !ids.has(pack.id),
	)
	return [...EMOJI_PACKS, ...gone]
}

/** Packs by maker in VENDORS order, in list order. Makers with none are left out. */
export function packsByVendor(
	packs: EmojiPack[] = allEmojiPacks(),
): Array<[string, EmojiPack[]]> {
	const makers = [
		...VENDORS,
		...new Set(
			packs
				.map(pack => pack.vendor)
				.filter(vendor => !VENDORS.includes(vendor)),
		),
	]
	return makers
		.map(
			vendor =>
				[vendor, packs.filter(pack => pack.vendor === vendor)] as [
					string,
					EmojiPack[],
				],
		)
		.filter(([, list]) => list.length)
}

/** One maker's packs under Current and Classic, in that order. */
export function groupsOf(packs: EmojiPack[]): Array<[string, EmojiPack[]]> {
	const groups = new Map<string, EmojiPack[]>()
	for (const group of [CURRENT, CLASSIC]) groups.set(group, [])
	for (const pack of packs)
		groups.set(pack.group, [...(groups.get(pack.group) ?? []), pack])
	return [...groups].filter(([, list]) => list.length)
}

export const EMOJI_SIZES: Array<{ label: string; value: number }> = [
	{ label: 'Smaller', value: 0.85 },
	{ label: "Discord's", value: 1 },
	{ label: 'Larger', value: 1.25 },
	{ label: 'Largest', value: 1.5 },
	{ label: 'Absurd', value: 2 },
]

export interface EmojiState {
	supported: boolean
	/** The pack drawing message, reaction and picker emoji now. */
	active: string | null
	/** The pack the text typefaces were built with at start; differs from `selected` until a restart. */
	text: string | null
	selected: string | null
	installed: string[]
	scale: number
	downloading: string | null
	bytes: number
	total: number
	downloadError: string | null
	messagesActive: boolean
	pickerActive: boolean
	textActive: boolean
	errors: number
	lastError: string
	/** Whether this phone can tell which emoji a pack is missing (Android 12+). */
	coverageChecked: boolean
	/** Emoji handed to the fallback since start. */
	fallbacks: number
	probe?: { ok: boolean; reason?: string; inked?: number; coloured?: number }
}

const EMPTY: EmojiState = {
	supported: false,
	active: null,
	text: null,
	selected: null,
	installed: [],
	scale: 1,
	downloading: null,
	bytes: 0,
	total: 0,
	downloadError: null,
	messagesActive: false,
	pickerActive: false,
	textActive: false,
	errors: 0,
	lastError: '',
	coverageChecked: false,
	fallbacks: 0,
}

function call(name: string, args: unknown[] = []): Promise<EmojiState> {
	return (revenge.modules.native as any)
		.callNativeMethod(`bleelblep.themes.${name}`, args)
		.then((state: Partial<EmojiState> | null) => ({
			...EMPTY,
			...(state ?? {}),
		}))
}

export function packById(id: string | null | undefined): EmojiPack | undefined {
	if (!id) return undefined
	return allEmojiPacks().find(pack => pack.id === id)
}

/** Like `emojiState`, but a native half that doesn't answer is an error, not an empty state. */
export function emojiStateOrThrow(): Promise<EmojiState> {
	return call('emojiState')
}

export function emojiState(): Promise<EmojiState> {
	return call('emojiState').catch(error => {
		console.error(`${TAG} emoji state:`, error)
		return EMPTY
	})
}

export function downloadPack(pack: EmojiPack): Promise<EmojiState> {
	// Remembered first, so the pack keeps its name even if its source later drops it.
	patch({ emojiKnown: { ...(settings().emojiKnown ?? {}), [pack.id]: pack } })
	return call('emojiDownload', [pack.id, pack.url])
}

export function cancelDownload(): Promise<EmojiState> {
	return call('emojiCancel')
}

/** `''` = Discord's own emoji. Rejects when the phone can't draw the pack. */
export async function selectPack(id: string): Promise<EmojiState> {
	const state = await call('emojiSelect', [id || null])
	if (id && state.probe && !state.probe.ok) {
		throw new Error(
			`This phone can't draw ${packById(id)?.name ?? 'that pack'} (${state.probe.reason ?? 'no colour came out'})`,
		)
	}
	return state
}

export interface EmojiCoverage {
	/** A React Native font family that draws only this pack; null if it couldn't be registered. */
	family: string | null
	/** False where the phone can't tell what a pack is missing (Android 11 and older). */
	checked: boolean
	/** Per text asked about: whether the pack draws it itself. */
	covered: boolean[]
}

/** Which of [texts] a downloaded pack draws itself, and a font family to show them with. */
export function emojiCoverage(
	id: string,
	texts: string[],
): Promise<EmojiCoverage> {
	return (revenge.modules.native as any).callNativeMethod(
		'bleelblep.themes.emojiCoverage',
		[id, texts],
	)
}

export function removePack(id: string): Promise<EmojiState> {
	return call('emojiRemove', [id])
}

export function setEmojiScale(scale: number): Promise<EmojiState> {
	return call('emojiScale', [scale])
}

export function sizeLabel(scale: number): string {
	return (
		EMOJI_SIZES.find(size => Math.abs(size.value - scale) < 0.01)?.label ??
		`${Math.round(scale * 100)}%`
	)
}

/** What native has, kept fresh: every second while a download runs, else when `refresh` is called. */
export function useEmojiState(): [
	EmojiState,
	() => void,
	(state: EmojiState) => void,
] {
	const React = revenge.react.React
	const [state, setState] = React.useState<EmojiState>(EMPTY)
	const refresh = React.useCallback(() => {
		emojiState().then(setState)
	}, [])
	React.useEffect(refresh, [])
	React.useEffect(() => {
		if (!state.downloading) return
		const timer = setInterval(refresh, 1000)
		return () => clearInterval(timer)
	}, [state.downloading])
	return [state, refresh, setState]
}

// ---- previews -------------------------------------------------------------------------------------

/** The emoji on a pack's preview card; the first is its icon in the list. Single code points only. */
export const PREVIEW_SAMPLE = [
	0x1f600, 0x1f602, 0x1f60d, 0x1f97a, 0x1f62d, 0x1f914, 0x1f44d, 0x1f525,
	0x1f389, 0x2764, 0x1f431, 0x1f355,
]

const previews = new Map<string, Promise<Array<string | null>>>()

let running = 0
const waiting: Array<() => void> = []

/** Runs [task] when fewer than three previews are being read. */
function queued<T>(task: () => Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const start = () => {
			running++
			task()
				.then(resolve, reject)
				.finally(() => {
					running--
					waiting.shift()?.()
				})
		}
		if (running < 3) start()
		else waiting.push(start)
	})
}

/**
 * `file://` images of [codepoints] in the pack, read from the font on GitHub without downloading it
 * (Preview.kt) and kept on the phone. Once per pack and set per session; a failure can be retried.
 */
export function packPreview(
	pack: EmojiPack,
	codepoints: number[] = PREVIEW_SAMPLE,
): Promise<Array<string | null>> {
	const key = `${pack.id}:${codepoints.join(',')}`
	let pending = previews.get(key)
	if (!pending) {
		pending = queued(() =>
			(revenge.modules.native as any).callNativeMethod(
				'bleelblep.themes.emojiPreview',
				[pack.id, pack.url, codepoints],
			),
		).then((uris: unknown) =>
			Array.isArray(uris)
				? uris.map(uri => (typeof uri === 'string' ? uri : null))
				: [],
		)
		pending!.catch(() => previews.delete(key))
		previews.set(key, pending!)
	}
	return pending!
}

/** A hook form of `packPreview`: undefined while loading, [] on failure. */
export function usePackPreview(
	pack: EmojiPack | undefined,
	codepoints: number[] = PREVIEW_SAMPLE,
): Array<string | null> | undefined {
	const React = revenge.react.React
	const [uris, setUris] = React.useState<Array<string | null> | undefined>(
		undefined,
	)
	React.useEffect(() => {
		if (!pack) return
		let live = true
		setUris(undefined)
		packPreview(pack, codepoints)
			.then(result => live && setUris(result))
			.catch((error: Error) => {
				console.error(`${TAG} emoji preview for ${pack.id}:`, error)
				if (live) setUris([])
			})
		return () => {
			live = false
		}
	}, [pack?.id, codepoints.join(',')])
	return uris
}

// ---- hiding -----------------------------------------------------------------------------------------

/** A maker's key in `emojiShown`; packs use their id. */
export function vendorKey(vendor: string): string {
	return `vendor:${vendor}`
}

/** Makers off the list until the eye switches them on (the user's choice, 2026-10-06). */
const HIDDEN_BY_DEFAULT = new Set(
	['Facebook', 'WhatsApp', 'Twitter', 'JoyPixels'].map(vendorKey),
)

/**
 * The switch's value if it was ever set, else shown unless hidden by default. Explicit values,
 * because storage merges and a key can't be removed (porting rule 6).
 */
export function isShown(key: string): boolean {
	const value = settings().emojiShown?.[key]
	return value ?? !HIDDEN_BY_DEFAULT.has(key)
}

export function setShown(key: string, shown: boolean) {
	patch({ emojiShown: { ...(settings().emojiShown ?? {}), [key]: shown } })
}
