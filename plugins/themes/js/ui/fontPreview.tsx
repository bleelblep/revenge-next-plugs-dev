import { expandFamilies, fontPreviewFamily } from '../lib/fonts'
import { token } from './theme'
import type { InstalledFont } from '../types'

/**
 * A font's preview card, drawn in the font itself, at the top of its page like an icon pack's row
 * of icons or a theme's messages preview.
 *
 * Discord's text can't show a font it isn't using: the files only reach its font manager through
 * Revenge's loader after a reload. So the preview is a WebView (react-native-webview, in the 348.5
 * bundle as `RNCWebView`) with the font in `@font-face`. That works for any installed font, used or
 * not. Without the WebView, the font in use is shown with Discord's own text, which that font has
 * already replaced; a font not in use falls back to the font family native registers for React
 * Native (lib/fonts.ts `fontPreviewFamily`, the same registration as the All emoji grid).
 *
 * The files are downloaded here and handed to the page as `data:` URLs, never as links: the page's
 * own requests are cross-origin, and GitHub's `/raw/` redirect answers with an empty
 * `Access-Control-Allow-Origin`, so the WebView drops the font and draws the fallback (seen on the
 * phone, 2026-09-29, with Google Sans Flex). Links in manifests are often percent-encoded already,
 * so they are used as they are.
 */

const SAMPLE = 'The quick brown fox jumps over the lazy dog'
const HEIGHT = 150

/** The four faces the sample uses: regular, bold and their italics. */
const FACES: Array<[string, number, boolean]> = [
	['ggsans-Normal', 400, false],
	['ggsans-Bold', 700, false],
	['ggsans-NormalItalic', 400, true],
	['ggsans-BoldItalic', 700, true],
]

let webView: any

/** Not cached on a miss: the module only shows up once Discord has loaded it. */
function findWebView(): any {
	if (webView) return webView
	try {
		const { lookupModule } = revenge.modules.finders
		const { withProps } = revenge.modules.finders.filters
		const [mod] = lookupModule(withProps('WebView')) as [
			any,
			number | undefined,
		]
		const candidate = mod?.WebView ?? mod?.default
		if (
			candidate &&
			(typeof candidate === 'function' || typeof candidate === 'object')
		)
			webView = candidate
	} catch {
		webView = undefined
	}
	return webView
}

function htmlEscape(text: string): string {
	return text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`)
}

const downloads = new Map<string, Promise<string>>()

/** A font file as a `data:` URL, fetched once per link per session. */
function dataUrl(url: string): Promise<string> {
	let pending = downloads.get(url)
	if (!pending) {
		pending = fetch(url)
			.then(response => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				return response.blob()
			})
			.then(
				blob =>
					new Promise<string>((resolve, reject) => {
						const reader = new FileReader()
						// GitHub serves fonts as octet-stream; name the type so the page doesn't have to sniff it.
						reader.onload = () =>
							resolve(
								String(reader.result).replace(
									/^data:[^;,]*/,
									`data:font/${/\.otf(\?|$)/i.test(url) ? 'otf' : 'ttf'}`,
								),
							)
						reader.onerror = () => reject(new Error("couldn't read the file"))
						reader.readAsDataURL(blob)
					}),
			)
		pending.catch(() => downloads.delete(url))
		downloads.set(url, pending)
	}
	return pending
}

/** `@font-face` rules for the sample's faces, from the font's files (see `expandFamilies`). */
async function fontFaces(font: InstalledFont): Promise<string> {
	const families = expandFamilies(font.manifest.main)
	const rules = await Promise.all(
		FACES.map(async ([family, weight, italic]) => {
			const url = families[family]
			if (!url) return ''
			const src = await dataUrl(url)
			return `@font-face{font-family:P;font-weight:${weight};font-style:${italic ? 'italic' : 'normal'};src:url("${src}")}`
		}),
	)
	return rules.join('')
}

function previewHtml(
	font: InstalledFont,
	faces: string,
	text: string,
	muted: string,
): string {
	return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${faces}
html,body{margin:0;padding:0;background:transparent;color:${text};font-family:P,sans-serif;-webkit-text-size-adjust:none}
h1{font-size:26px;font-weight:700;line-height:1.2;margin:0 0 8px}
p{font-size:16px;line-height:1.4;margin:0 0 6px}
.muted{color:${muted};font-size:14px}
</style></head><body>
<h1>${htmlEscape(font.manifest.name)}</h1>
<p>${SAMPLE}.</p>
<p><b>Bold</b> · <i>Italic</i> · <b><i>Bold italic</i></b></p>
<p class="muted">0123456789 · Aa Bb Cc · !?&amp;@</p>
</body></html>`
}

export function FontPreview({
	font,
	inUse,
}: {
	font: InstalledFont
	inUse: boolean
}) {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const React = revenge.react.React
	const { View } = revenge.react.ReactNative
	const { Card, Text } = revenge.discord.design.Design as any
	const WebView = findWebView()
	const [faces, setFaces] = React.useState<string | undefined>(undefined)
	const [error, setError] = React.useState('')
	// The native preview family, for when the WebView can't be reached and the font isn't in use.
	const [family, setFamily] = React.useState<string | null | undefined>(
		undefined,
	)
	const [familyError, setFamilyError] = React.useState('')

	React.useEffect(() => {
		if (!WebView) return
		let live = true
		setFaces(undefined)
		setError('')
		fontFaces(font)
			.then(rules => live && setFaces(rules))
			.catch((e: Error) => live && setError(e?.message ?? String(e)))
		return () => {
			live = false
		}
	}, [font.id, !!WebView])

	React.useEffect(() => {
		// The WebView shows all four faces; the native family only covers where it can't.
		if (inUse || (WebView && !error)) return
		let live = true
		setFamily(undefined)
		setFamilyError('')
		fontPreviewFamily(font)
			.then(next => live && setFamily(next))
			.catch((e: Error) => live && setFamilyError(e?.message ?? String(e)))
		return () => {
			live = false
		}
	}, [font.id, !!WebView, inUse, !!error])

	// A working WebView preview: loading, then the four faces.
	if (WebView && (faces === undefined || !error)) {
		return (
			<Card variant="secondary" border="none">
				<View style={{ height: HEIGHT, padding: 18, justifyContent: 'center' }}>
					{faces === undefined ? (
						<Text
							color="text-muted"
							variant="text-sm/normal"
							style={{ textAlign: 'center' }}
						>
							Downloading the font for the preview…
						</Text>
					) : (
						<WebView
							source={{
								html: previewHtml(
									font,
									faces,
									token('TEXT_DEFAULT', '#efeff1'),
									token('TEXT_MUTED', '#96979e'),
								),
							}}
							originWhitelist={['*']}
							scrollEnabled={false}
							style={{ flex: 1, backgroundColor: 'transparent' }}
						/>
					)}
				</View>
			</Card>
		)
	}

	// No WebView, or its download failed: the native preview family, which also needs no reload.
	if (!inUse) {
		return (
			<Card variant="secondary" border="none">
				<View
					style={{
						minHeight: 72,
						padding: 18,
						gap: 6,
						justifyContent: 'center',
					}}
				>
					{family ? (
						<>
							<Text
								color="text-default"
								variant="heading-lg/bold"
								style={{ fontFamily: family }}
							>
								{font.manifest.name}
							</Text>
							<Text
								color="text-default"
								variant="text-md/normal"
								style={{ fontFamily: family }}
							>
								{SAMPLE}.
							</Text>
							<Text
								color="text-muted"
								variant="text-sm/normal"
								style={{ fontFamily: family }}
							>
								0123456789 · Aa Bb Cc · !?&@
							</Text>
						</>
					) : (
						<Text
							color="text-muted"
							variant="text-sm/normal"
							style={{ textAlign: 'center' }}
						>
							{family === undefined && !familyError && !error
								? 'Downloading the font for the preview…'
								: `Couldn't download the font for the preview: ${familyError || error}`}
						</Text>
					)}
				</View>
			</Card>
		)
	}

	// In use: Discord's own text already draws the font.
	return (
		<Card variant="secondary" border="none">
			<View
				style={{ minHeight: 72, padding: 18, gap: 6, justifyContent: 'center' }}
			>
				<Text color="text-default" variant="heading-lg/bold">
					{font.manifest.name}
				</Text>
				<Text color="text-default" variant="text-md/normal">
					{SAMPLE}.
				</Text>
				<Text color="text-muted" variant="text-sm/normal">
					0123456789 · Aa Bb Cc · !?&@
				</Text>
			</View>
		</Card>
	)
}
