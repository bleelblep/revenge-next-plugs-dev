import { normalizeToHex, withAlpha } from '../lib/color'
import { effectiveBackground } from '../lib/customBackground'
import { findInReactTree } from '../lib/findInReactTree'
import { settings } from '../lib/state'
import { hookByPath, renderTarget } from './hook'

/** Used when the safe-area library can't say how tall the navigation bar is. */
const FALLBACK_BOTTOM_INSET = 48

/**
 * How far the image runs past the message list: the strip under the message box
 * (`ChannelSafeAreaBottom`, a sibling below the list) is as tall as the bottom inset when the
 * keyboard is closed. Read once, not with `useSafeAreaInsets`: this runs inside Discord's render,
 * and a hook called only when a background is set would change the hook count.
 */
function bottomInset(): number {
	try {
		const bottom = (revenge.externals.ReactNativeSafeAreaContext as any)
			?.initialWindowMetrics?.insets?.bottom
		if (typeof bottom === 'number') return bottom
	} catch {
		/* fall through */
	}
	return FALLBACK_BOTTOM_INSET
}

/**
 * A theme's background image behind the message list, as in classic: `MessagesConnected`
 * (`modules/messages/native/Messages.tsx`, a forwardRef up to 349, a plain function from 350.2) gets the image behind it, and the list's
 * own surface, the element carrying `HACK_fixModalInteraction`, is made see-through so it shows.
 *
 * The image and the theme's dimming (its opacity, over the list's colour) sit in one layer that
 * reaches below the list by the bottom inset. With Compatibility > Match the navigation bar on,
 * the strip under the message box is transparent (`lib/navBar.ts`), and this is what shows there,
 * dimmed the same as the chat.
 */
function withBackground(tree: any): any {
	const background = effectiveBackground()
	if (!background?.url) return tree

	const { Image, StyleSheet, View } = revenge.react.ReactNative
	let base = '#000000'
	try {
		const list = findInReactTree(
			tree,
			node =>
				node?.props &&
				'HACK_fixModalInteraction' in node.props &&
				node.props.style,
		)
		if (list) {
			const flat = StyleSheet.flatten(list.props.style) ?? {}
			base = normalizeToHex(flat.backgroundColor) ?? base
			list.props.style = [list.props.style, { backgroundColor: 'transparent' }]
		}
	} catch (error) {
		console.error('[Themes] chat background: list style not changed:', error)
	}

	const extend = settings().matchNavBar !== false ? bottomInset() : 0
	return (
		<View style={{ flex: 1, height: '100%', overflow: 'visible' }}>
			<View
				pointerEvents="none"
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: -extend,
				}}
			>
				<Image
					style={StyleSheet.absoluteFill}
					resizeMode="cover"
					source={{ uri: background.url }}
					blurRadius={
						typeof background.blur === 'number' ? background.blur : undefined
					}
				/>
				<View
					style={[
						StyleSheet.absoluteFill,
						{ backgroundColor: withAlpha(base, 1 - (background.opacity ?? 1)) },
					]}
				/>
			</View>
			{tree}
		</View>
	)
}

export default function patchBackground(): () => void {
	return hookByPath(
		'chat background',
		'modules/messages/native/Messages.tsx',
		'render',
		(host, method) =>
			revenge.patcher.after(host, method, (tree: any) => {
				try {
					return withBackground(tree)
				} catch (error) {
					console.error('[Themes] chat background failed:', error)
					return tree
				}
			}),
		// A forwardRef up to 349, a plain function from 350.2.
		exports => renderTarget(exports),
	)
}
