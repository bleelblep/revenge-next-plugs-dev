/**
 * Fonts, through Revenge's own font loader rather than a patch of ours.
 *
 * RevengeXposed (`tweaks/legacy/appearance/Fonts.kt`) reads `files/pyoncord/fonts.json` at launch
 * and answers every `ReactFontManager.createAssetTypeface` call from the files in
 * `files/pyoncord/downloads/fonts/<name>/<family>.ttf` first. 1.6.3 hooks the class Discord 348
 * uses (`com.facebook.react.common.assets.ReactFontManager`); 1.6.1 hooked the old one and did
 * nothing. That one call serves the JS text and the native chat alike: chat's `DiscordFont` asks
 * `ReactFontManager` for `"ggsans-Normal, NotoSans-Normal"` and the loader splits the list.
 *
 * Its own downloads start at launch, after Discord has already asked for its fonts, so a font
 * chosen now would need two reloads. Classic Revenge avoided that by downloading the files itself,
 * through Discord's FileModule, before the reload; this does the same, into the loader's folder and
 * under the loader's file names, so the loader finds them and skips its own download.
 */

import { patch, report, settings, TAG, whenLoaded } from './state'
import type { FontManifest, InstalledFont } from '../types'

/** Discord's primary weights (`com.discord.fonts.DiscordFont`, 348.1). */
const WEIGHTS: Record<string, number> = {
	Normal: 400,
	Medium: 500,
	Semibold: 600,
	Bold: 700,
	ExtraBold: 800,
}
const PRIMARY =
	/^(ggsans|NotoSans)-(Normal|Medium|Semibold|Bold|ExtraBold)(Italic)?$/i
const MONO = /^(ggmono|SourceCodePro)-(Normal|Bold)$/i
/** DisplayExtraBold: headings on some screens. */
const DISPLAY = 'ABCGintoNord-ExtraBold'

const LOADER_DIR = 'pyoncord'
const FONTS_JSON = `${LOADER_DIR}/fonts.json`
const DOWNLOADS = `${LOADER_DIR}/downloads/fonts`

function canonicalWeight(name: string): string {
	return (
		Object.keys(WEIGHTS).find(
			weight => weight.toLowerCase() === name.toLowerCase(),
		) ?? name
	)
}

/**
 * Every family Discord asks for, filled from the ones the font has. A font with only a regular
 * file still changes bold names and headings; each missing weight takes the nearest one, italics
 * from italics where there are any. The code font changes only if the font brings a monospace one.
 */
export function expandFamilies(
	main: Record<string, string>,
): Record<string, string> {
	const out: Record<string, string> = { ...main }
	const have: Array<{
		weight: number
		italic: boolean
		url: string
		gg: boolean
	}> = []
	const mono: Record<string, string> = {}
	for (const [key, url] of Object.entries(main)) {
		const primary = PRIMARY.exec(key)
		if (primary) {
			have.push({
				weight: WEIGHTS[canonicalWeight(primary[2])],
				italic: !!primary[3],
				url,
				gg: primary[1].toLowerCase() === 'ggsans',
			})
			continue
		}
		const code = MONO.exec(key)
		if (code) mono[canonicalWeight(code[2])] ??= url
	}
	// A single file with any other name is the regular weight (installing a .ttf link does this).
	if (!have.length && !Object.keys(mono).length) {
		const only = Object.values(main)
		if (only.length === 1)
			have.push({ weight: 400, italic: false, url: only[0], gg: true })
	}

	if (have.length) {
		const nearest = (weight: number, italic: boolean) => {
			const pool = have.filter(entry => entry.italic === italic)
			const from = pool.length ? pool : have
			return [...from].sort(
				(a, b) =>
					Math.abs(a.weight - weight) - Math.abs(b.weight - weight) ||
					Number(b.gg) - Number(a.gg) ||
					b.weight - a.weight,
			)[0].url
		}
		for (const [name, weight] of Object.entries(WEIGHTS)) {
			for (const italic of [false, true]) {
				const key = `ggsans-${name}${italic ? 'Italic' : ''}`
				out[key] ??= nearest(weight, italic)
			}
		}
		out[DISPLAY] ??= out['ggsans-ExtraBold']
	}

	if (Object.keys(mono).length) {
		out['ggmono-Normal'] ??= mono.Normal ?? mono.Bold
		out['ggmono-Bold'] ??= mono.Bold ?? mono.Normal
	}
	return out
}

/** Discord's styles in the order its screens use them, with the name shown for each. */
const STYLE_LABELS: Array<[string, string]> = [
	['ggsans-Normal', 'Regular'],
	['ggsans-Medium', 'Medium'],
	['ggsans-Semibold', 'Semibold'],
	['ggsans-Bold', 'Bold'],
	['ggsans-ExtraBold', 'Extra bold'],
	['ggsans-NormalItalic', 'Italic'],
	['ggsans-MediumItalic', 'Medium italic'],
	['ggsans-SemiboldItalic', 'Semibold italic'],
	['ggsans-BoldItalic', 'Bold italic'],
	['ggsans-ExtraBoldItalic', 'Extra bold italic'],
	[DISPLAY, 'Headings'],
	['ggmono-Normal', 'Code'],
	['ggmono-Bold', 'Code bold'],
]

export interface StyleSource {
	label: string
	/** `own`: a file of the font's. `nearest`: another of its files. `discord`: Discord's own. */
	source: 'own' | 'nearest' | 'discord'
	/** For `nearest`, which of the font's styles stands in. */
	from?: string
}

/** Where each style Discord asks for comes from once the font is in use (see `expandFamilies`). */
export function styleSources(main: Record<string, string>): StyleSource[] {
	const expanded = expandFamilies(main)
	const labelOf = (key: string) =>
		STYLE_LABELS.find(
			([name]) => name.toLowerCase() === key.toLowerCase(),
		)?.[1] ?? key
	const ownByUrl = new Map<string, string>()
	for (const [key, url] of Object.entries(main))
		if (!ownByUrl.has(url)) ownByUrl.set(url, labelOf(key))
	const ownKeys = new Set(Object.keys(main).map(key => key.toLowerCase()))
	// A single file under some other name is the regular weight (expandFamilies does the same).
	const single =
		Object.keys(main).length === 1 &&
		!STYLE_LABELS.some(([name]) => ownKeys.has(name.toLowerCase()))

	return STYLE_LABELS.map(([key, label]) => {
		if (ownKeys.has(key.toLowerCase()) || (single && key === 'ggsans-Normal'))
			return { label, source: 'own' }
		const url = expanded[key]
		if (!url) return { label, source: 'discord' }
		return {
			label,
			source: 'nearest',
			from: single ? 'Regular' : ownByUrl.get(url),
		}
	})
}

/** The loader's file name: `.otf` when the link ends in it, `.ttf` otherwise (`Fonts.kt`). */
function fileName(family: string, url: string): string {
	return `${family}${url.endsWith('.otf') ? '.otf' : '.ttf'}`
}

function hash(text: string): string {
	let h = 5381
	for (let i = 0; i < text.length; i++)
		h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
	return h.toString(36)
}

/**
 * The folder name, and the `name` in fonts.json. The link's hash keeps two fonts with one name
 * apart: the loader never downloads a file it already has, so they must not share a folder.
 */
export function setName(font: InstalledFont): string {
	const base =
		font.manifest.name
			.replace(/[^\w .-]+/g, '_')
			.trim()
			.slice(0, 40) || 'Font'
	return `${base}-${hash(font.id)}`
}

// ---- files --------------------------------------------------------------------------------------

function fs(): any {
	return (revenge.modules.native as any).fs
}

function fileModule(): any {
	return (revenge.discord.native as any).FileModule
}

/** Discord's files folder, where the loader looks: `<data>/files`. */
function filesDir(): string {
	return String(fs().getConstants().files).replace(/\/$/, '')
}

/** Our path relative to FileModule's `documents` folder, which is the same files folder. */
function documentsPath(path: string): string {
	const docs = String(
		fileModule()?.getConstants?.()?.DocumentsDirPath ?? '',
	).replace(/\/$/, '')
	const absolute = `${filesDir()}/${path}`
	if (docs && absolute.startsWith(`${docs}/`))
		return absolute.slice(docs.length + 1)
	if (!docs || docs === filesDir()) return path
	throw new Error("Discord's file storage isn't where Revenge keeps fonts")
}

function exists(path: string): boolean {
	try {
		return !!fs().existsSync(`${filesDir()}/${path}`)
	} catch {
		return false
	}
}

function readFontsJson(): FontManifest | undefined {
	try {
		if (!exists(FONTS_JSON)) return undefined
		return JSON.parse(fs().readFileSync(`${filesDir()}/${FONTS_JSON}`))
	} catch {
		return undefined
	}
}

function removeSet(font: InstalledFont) {
	try {
		fs().rmSync(`${filesDir()}/${DOWNLOADS}/${setName(font)}`)
	} catch {
		/* nothing downloaded */
	}
}

/** What goes in fonts.json for this font. */
function definition(font: InstalledFont): FontManifest {
	return {
		spec: 1,
		name: setName(font),
		...(font.manifest.description
			? { description: font.manifest.description }
			: {}),
		main: expandFamilies(font.manifest.main),
	}
}

function sameDefinition(a: FontManifest | undefined, b: FontManifest): boolean {
	return (
		!!a &&
		a.name === b.name &&
		JSON.stringify(a.main) === JSON.stringify(b.main)
	)
}

// ---- downloading ----------------------------------------------------------------------------------

/** A file as base64, which is what FileModule writes binary from. */
async function downloadBase64(url: string): Promise<string> {
	const response = await fetch(url, { cache: 'no-store' } as RequestInit)
	if (!response.ok) throw new Error(`HTTP ${response.status}`)
	const blob = await response.blob()
	if ((blob as any).size !== undefined && (blob as any).size < 1024)
		throw new Error("that isn't a font file")
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result ?? ''))
		reader.onerror = () => reject(new Error("couldn't read the download"))
		reader.readAsDataURL(blob)
	})
	const comma = dataUrl.indexOf(',')
	if (comma < 0) throw new Error("couldn't read the download")
	return dataUrl.slice(comma + 1)
}

export interface FontFiles {
	have: number
	total: number
}

/** How many of the font's files are in the loader's folder. */
export function fontFiles(font: InstalledFont): FontFiles {
	const main = expandFamilies(font.manifest.main)
	const dir = `${DOWNLOADS}/${setName(font)}`
	const entries = Object.entries(main)
	return {
		have: entries.filter(([family, url]) =>
			exists(`${dir}/${fileName(family, url)}`),
		).length,
		total: entries.length,
	}
}

// ---- previews ------------------------------------------------------------------------------------

const previewFamilies = new Map<string, Promise<string | null>>()

/**
 * A React Native font family that draws [font]'s regular weight, so a preview shows before the
 * font is in use: Discord's text only gets a font's files after a reload. Native downloads one
 * file and hands it to ReactFontManager (the same registration as emojiCoverage's family), fresh
 * each session like the WebView preview's own fetch. Once per font per session.
 */
export function fontPreviewFamily(font: InstalledFont): Promise<string | null> {
	const expanded = expandFamilies(font.manifest.main)
	const url = expanded['ggsans-Normal'] ?? Object.values(expanded)[0]
	let pending = previewFamilies.get(font.id)
	if (!pending) {
		const request = url
			? (revenge.modules.native as any).callNativeMethod(
					'bleelblep.themes.fontPreview',
					[font.id, url],
				)
			: Promise.resolve(null)
		pending = request
			.then((family: unknown) =>
				typeof family === 'string' && family ? family : null,
			)
			.catch((error: Error) => {
				console.error(`${TAG} font preview for ${font.id}:`, error)
				return null
			})
		previewFamilies.set(font.id, pending!)
	}
	return pending!
}

/**
 * Downloads every file the font needs into the loader's folder, each link once. `progress` gets
 * the number of links done.
 */
async function downloadFont(
	font: InstalledFont,
	progress?: (done: number, total: number) => void,
) {
	const files = fileModule()
	if (typeof files?.writeFile !== 'function')
		throw new Error("Discord's file storage isn't available")
	const dir = `${DOWNLOADS}/${setName(font)}`
	const byUrl = new Map<string, string[]>()
	for (const [family, url] of Object.entries(
		expandFamilies(font.manifest.main),
	)) {
		if (exists(`${dir}/${fileName(family, url)}`)) continue
		byUrl.set(url, [...(byUrl.get(url) ?? []), family])
	}

	let done = 0
	progress?.(done, byUrl.size)
	for (const [url, families] of byUrl) {
		let data: string
		try {
			data = await downloadBase64(url)
		} catch (error) {
			throw new Error(
				`Couldn't download ${families[0]} (${(error as Error)?.message ?? error})`,
			)
		}
		for (const family of families) {
			await files.writeFile(
				'documents',
				documentsPath(`${dir}/${fileName(family, url)}`),
				data,
				'base64',
			)
		}
		progress?.(++done, byUrl.size)
	}
}

// ---- installing and choosing ----------------------------------------------------------------------

function validateFont(json: any): json is FontManifest {
	if (typeof json !== 'object' || json === null) return false
	if (typeof json.name !== 'string' || !json.name.trim()) return false
	if (typeof json.main !== 'object' || json.main === null) return false
	const entries = Object.entries(json.main)
	return (
		entries.length > 0 &&
		entries.every(
			([, url]) => typeof url === 'string' && /^https?:\/\//i.test(url),
		)
	)
}

/** A link to a .json font pack, or straight to one .ttf/.otf file. */
async function fetchFont(url: string): Promise<FontManifest> {
	const file = /\/([^/?#]+)\.(ttf|otf)(?:[?#].*)?$/i.exec(url)
	if (file) {
		const name = decodeURIComponent(file[1])
			.replace(/[-_]+(Regular|Normal)$/i, '')
			.replace(/[-_]+/g, ' ')
		return { spec: 1, name, main: { 'ggsans-Normal': url } }
	}

	let json: any
	try {
		const response = await fetch(url, { cache: 'no-store' } as RequestInit)
		if (!response.ok) throw new Error(`HTTP ${response.status}`)
		json = await response.json()
	} catch (error) {
		throw new Error(
			`Couldn't download a font from that link (${(error as Error)?.message ?? error})`,
		)
	}
	if (!validateFont(json))
		throw new Error("That link isn't a Revenge font or a .ttf/.otf file")
	return {
		spec: json.spec ?? 1,
		name: json.name.trim(),
		description: json.description,
		main: json.main,
	}
}

export async function installFont(input: string): Promise<FontManifest> {
	const url = input.trim()
	if (!/^https?:\/\//i.test(url))
		throw new Error('Paste a link starting with https://')
	if (settings().fonts.some(font => font.id === url))
		throw new Error('That font is already installed')
	const manifest = await fetchFont(url)
	const fonts = settings().fonts.filter(font => font.id !== url)
	patch({ fonts: [...fonts, { id: url, manifest }] })
	return manifest
}

/**
 * Downloads the font, then points Revenge's fonts.json at it; `''` removes fonts.json, which is
 * Discord's own fonts. Either way the change shows after a reload.
 */
export async function selectFont(
	id: string,
	progress?: (done: number, total: number) => void,
) {
	if (!id) {
		try {
			fs().deleteFileSync(`${filesDir()}/${FONTS_JSON}`)
		} catch {
			/* already gone */
		}
		patch({ selectedFont: '' })
		return
	}
	const font = settings().fonts.find(entry => entry.id === id)
	if (!font) throw new Error('That font is no longer installed')
	await downloadFont(font, progress)
	fs().writeFileSync(
		`${filesDir()}/${FONTS_JSON}`,
		JSON.stringify(definition(font), null, 2),
	)
	patch({ selectedFont: id })
}

/** Downloads the pack again; its files too, since the loader keeps any file it already has. */
export async function refetchFont(id: string): Promise<FontManifest> {
	const manifest = await fetchFont(id)
	const old = settings().fonts.find(font => font.id === id)
	if (old) removeSet(old)
	patch({
		fonts: settings().fonts.map(font =>
			font.id === id ? { id, manifest } : font,
		),
	})
	if (settings().selectedFont === id) await selectFont(id)
	return manifest
}

export async function removeFont(id: string) {
	if (settings().selectedFont === id) await selectFont('')
	const font = settings().fonts.find(entry => entry.id === id)
	if (font) removeSet(font)
	patch({ fonts: settings().fonts.filter(entry => entry.id !== id) })
}

/** A fonts.json this plugin didn't write, from classic Revenge, say. Read at launch. */
let foreign: string | undefined

export function foreignFont(): string | undefined {
	return foreign
}

/**
 * At launch: puts fonts.json back if it went missing or out of date (a cleared app, the plugin
 * turned off and on), and reports what the loader has.
 */
export async function checkFontsAtLaunch(): Promise<boolean> {
	await whenLoaded()
	const { selectedFont, fonts } = settings()
	const current = readFontsJson()
	const font = selectedFont
		? fonts.find(entry => entry.id === selectedFont)
		: undefined
	foreign = !font && current ? current.name : undefined

	if (!font) {
		if (selectedFont) patch({ selectedFont: '' })
		report(
			'font',
			current
				? `none chosen here; fonts.json has "${current.name}"`
				: "Discord's own",
		)
		return false
	}
	if (sameDefinition(current, definition(font))) {
		const files = fontFiles(font)
		report(
			'font',
			`${font.manifest.name}: ${files.have} of ${files.total} files on the device`,
		)
		return false
	}
	await selectFont(font.id)
	report(
		'font',
		`${font.manifest.name}: fonts.json written again; shows after a reload`,
	)
	return true
}

/** Turning the plugin off takes its font with it, as it does its theme. */
export function clearFontsJson() {
	if (!settings().selectedFont) return
	try {
		fs().deleteFileSync(`${filesDir()}/${FONTS_JSON}`)
	} catch {
		/* already gone */
	}
}
