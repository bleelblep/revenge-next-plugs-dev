import { isSwapped } from '../lib/icons'
import { report } from '../lib/state'
import { hookByPath, renderTarget } from './hook'

/**
 * Makes a pack's icons fit Discord's icon boxes instead of filling them.
 *
 * Discord draws its icons in an `Image` with no `resizeMode`, so React Native's default, `cover`,
 * applies: the image fills the box and whatever sticks out is cut off. For a square box that's
 * nothing, but some boxes aren't square. The row arrow (`TableRowArrow`) is
 * `{ width: TABLE_ROW_ARROW_WIDTH, height: 24 }`, narrower than tall, so only the middle strip of
 * the 24x24 icon shows. Discord's chevron is a thin mark inside that strip; Solar's is a full arrow
 * across the square, and it was cut to a stub and a tip (screenshot, 2026-09-28).
 *
 * `contain` keeps the whole image in the box. It's set as the `resizeMode` prop and in the style,
 * and only for icons the pack swapped: Discord's own icons keep Discord's layout. Two components
 * draw icons on 348.5/349.0:
 * - `BaseIconImage` (`design/components/Icon/native/BaseIconImage.tsx`): every redesign icon
 *   component, `BellIcon` and the rest.
 * - `Icon` (`design/void/Icon/native/Icon.tsx`, `memo(forwardRef(...))`): icons passed by source,
 *   like the row arrow.
 */
const num = (...values: unknown[]): number => {
	for (const value of values) if (typeof value === 'number') return value
	return 0
}

/**
 * A box that isn't square, made square at its longer side, with the margins on the short side
 * pulled in by the same amount so the row keeps its layout. `contain` alone shrank the whole arrow
 * into the arrow's narrow slot and it came out tiny (0.1.24, screenshot 2026-09-28); this way it's
 * drawn at full size and spills into the space beside the slot, which is what Discord's own chevron,
 * a thin mark inside a padded square, looks like it does.
 */
function squared(style: unknown): object | undefined {
	const flat =
		revenge.react.ReactNative.StyleSheet.flatten(style as any) ?? ({} as any)
	const { width, height } = flat
	if (
		typeof width !== 'number' ||
		typeof height !== 'number' ||
		width === height
	)
		return undefined
	const side = Math.max(width, height)
	const half = (side - Math.min(width, height)) / 2
	if (width < height) {
		return {
			width: side,
			marginStart:
				num(
					flat.marginStart,
					flat.marginLeft,
					flat.marginHorizontal,
					flat.margin,
				) - half,
			marginEnd:
				num(
					flat.marginEnd,
					flat.marginRight,
					flat.marginHorizontal,
					flat.margin,
				) - half,
		}
	}
	return {
		height: side,
		marginTop: num(flat.marginTop, flat.marginVertical, flat.margin) - half,
		marginBottom:
			num(flat.marginBottom, flat.marginVertical, flat.margin) - half,
	}
}

function fit(args: any[]): any[] {
	const props = args[0]
	if (!props || !isSwapped(props.source)) return args
	// Both, because `Icon` passes a `resizeMode` prop of its own (default 'cover'), and on `Image` the
	// prop wins over the style: 0.1.22 set the style alone and the row arrows stayed cut off.
	return [
		{
			...props,
			resizeMode: 'contain',
			style: [props.style, { resizeMode: 'contain' }, squared(props.style)],
		},
		...args.slice(1),
	]
}

/**
 * The render function of `Icon`: `forwardRef(...)` / `memo(forwardRef(...))` up to 349, `memo(...)`
 * from 350.2 (no forwardRef). Returns `[host, method]`.
 */
function renderHost(exports: any): [any, string] | undefined {
	for (const key of ['Icon', 'default']) {
		const value = exports?.[key]
		if (!value || typeof value === 'function') continue
		const target = renderTarget(exports, key)
		if (target) return target
	}
	for (const value of Object.values(exports ?? {}) as any[]) {
		if (typeof value?.render === 'function') return [value, 'render']
		if (typeof value?.type?.render === 'function') return [value.type, 'render']
	}
	return undefined
}

function patchVoidIcon(): () => void {
	const label = 'icon fit (Icon)'
	let unpatch: (() => void) | undefined
	let unsubscribe: (() => void) | undefined
	try {
		unsubscribe =
			revenge.discord.utils.modules.finders.getModuleWithImportedPath(
				'design/void/Icon/native/Icon.tsx',
				(exports: any, id: unknown) => {
					try {
						const target = renderHost(exports)
						if (!target) {
							report(label, `module ${id} has no render`)
							return
						}
						unpatch = revenge.patcher.before(target[0], target[1], fit)
						report(label, `hooked (module ${id})`)
					} catch (error) {
						report(label, `failed: ${(error as Error)?.message ?? error}`)
					}
				},
			)
	} catch (error) {
		report(label, `lookup failed: ${(error as Error)?.message ?? error}`)
	}
	return () => {
		unsubscribe?.()
		unpatch?.()
	}
}

export default function patchIconFit(): () => void {
	const base = hookByPath(
		'icon fit (BaseIconImage)',
		'design/components/Icon/native/BaseIconImage.tsx',
		'BaseIconImage',
		(host, method) => revenge.patcher.before(host, method, fit),
	)
	const icon = patchVoidIcon()
	return () => {
		base()
		icon()
	}
}
