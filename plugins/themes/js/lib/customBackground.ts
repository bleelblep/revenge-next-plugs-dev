import { activeBackground } from './engine'
import { patch, settings, TAG } from './state'
import type { ColorDefinition, CustomBackground } from '../types'

/**
 * The user's own chat background: one image for every theme (and for no theme), chosen from the
 * gallery or by link. It wins over the applied theme's `background`.
 *
 * Gallery: Discord ships react-native-image-picker's native `ImagePickerManager`, which hands back
 * a copy in Discord's cache folder (`cache/rn_image_picker_lib_temp_*.png`, checked on device
 * 2026-10-04). The cache can be cleared, so that copy is moved into Discord's files folder with
 * the document picker's `keepLocalCopy` (also native, also shipped by Discord), which survives
 * cache clears and doesn't depend on the photo staying in the gallery.
 *
 * Every native module is read when used, never at module scope (porting rule 1).
 */

export const DIM = { min: 0, max: 0.9, default: 0.4 } as const
export const BLUR = { min: 0, max: 25, default: 0 } as const

/** Options react-native-image-picker's JS wrapper would fill in; the native side reads them all. */
const PICKER_OPTIONS = {
	mediaType: 'photo',
	selectionLimit: 1,
	includeBase64: false,
	includeExtra: false,
	quality: 1,
	maxWidth: 0,
	maxHeight: 0,
	videoQuality: 'high',
	durationLimit: 0,
	saveToPhotos: false,
	cameraType: 'back',
	presentationStyle: 'pageSheet',
	assetRepresentationMode: 'auto',
	formatAsMp4: false,
	conversionQuality: 0.92,
	restrictMimeTypes: [],
}

function nativeModules(): any {
	return revenge.react.ReactNative.NativeModules
}

/** Opens the gallery. Resolves to the picked image's (temporary) uri, or undefined if cancelled. */
function launchGallery(): Promise<{ uri: string; type?: string } | undefined> {
	return new Promise((resolve, reject) => {
		const picker = nativeModules().ImagePickerManager
		if (typeof picker?.launchImageLibrary !== 'function') {
			reject(new Error("Discord's image picker isn't available"))
			return
		}
		picker.launchImageLibrary(PICKER_OPTIONS, (response: any) => {
			if (response?.didCancel) return resolve(undefined)
			if (response?.errorCode)
				return reject(new Error(response.errorMessage ?? response.errorCode))
			const asset = response?.assets?.[0]
			resolve(typeof asset?.uri === 'string' ? asset : undefined)
		})
	})
}

/** Moves a cache file into Discord's files folder. Falls back to the cache copy if it can't. */
async function keepCopy(uri: string, type?: string): Promise<string> {
	const documents = nativeModules().RNDocumentPicker
	if (typeof documents?.keepLocalCopy !== 'function') return uri
	const extension =
		type === 'image/jpeg' ? 'jpg' : (type?.split('/')[1] ?? 'png')
	try {
		const [result] = await documents.keepLocalCopy({
			files: [
				{ uri, fileName: `themes-chat-background-${Date.now()}.${extension}` },
			],
			destination: 'documentDirectory',
		})
		if (result?.status === 'success' && typeof result.localUri === 'string')
			return result.localUri
		console.warn(
			`${TAG} keeping a copy of the background failed:`,
			result?.copyError ?? result,
		)
	} catch (error) {
		console.warn(`${TAG} keeping a copy of the background failed:`, error)
	}
	return uri
}

function current(): CustomBackground | undefined {
	return settings().customBackground ?? undefined
}

function save(next: Partial<CustomBackground> & { uri: string }) {
	const previous = current()
	patch({
		customBackground: {
			dim: previous?.dim ?? DIM.default,
			blur: previous?.blur ?? BLUR.default,
			...next,
		},
	})
}

/** Gallery -> permanent copy -> saved. Resolves true when a new background was set. */
export async function pickFromGallery(): Promise<boolean> {
	const asset = await launchGallery()
	if (!asset) return false
	save({ uri: await keepCopy(asset.uri, asset.type) })
	return true
}

/** Saves an image link. Returns an error to show, or undefined when it was saved. */
export function setLink(link: string): string | undefined {
	const url = link.trim()
	if (!/^https?:\/\/\S+$/i.test(url))
		return 'Paste a link starting with https://'
	save({ uri: url })
	return undefined
}

export function setDim(dim: number) {
	const bg = current()
	if (bg) save({ ...bg, dim: Math.min(DIM.max, Math.max(DIM.min, dim)) })
}

export function setBlur(blur: number) {
	const bg = current()
	if (bg)
		save({
			...bg,
			blur: Math.min(BLUR.max, Math.max(BLUR.min, Math.round(blur))),
		})
}

export function removeBackground() {
	patch({ customBackground: null })
}

/**
 * What the chat shows: the user's own image if there is one, otherwise the theme's when the
 * "Chat background" switch is on. In the theme format: `opacity` is how much of the image shows.
 */
/**
 * Your own background is hidden for now (user's call, 2026-10-08). Off, the Appearance section is gone
 * and a saved one is ignored rather than deleted, so turning this back on restores it.
 */
export const CUSTOM_BACKGROUND_ENABLED = false

export function effectiveBackground(): ColorDefinition['background'] {
	const bg = CUSTOM_BACKGROUND_ENABLED ? current() : undefined
	if (bg?.uri)
		return {
			url: bg.uri,
			blur: bg.blur || undefined,
			opacity: 1 - (bg.dim ?? DIM.default),
		}
	return settings().showBackground ? activeBackground() : undefined
}
