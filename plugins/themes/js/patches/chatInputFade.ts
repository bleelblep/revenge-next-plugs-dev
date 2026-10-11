import { findInReactTree } from '../lib/findInReactTree'
import { settings } from '../lib/state'
import { hookByPath, renderTarget } from './hook'

/**
 * The fade behind the message box. Discord 348.5 draws `ChatInputScrimGradient`
 * (`modules/chat_input/native/ChatInputScrimGradient.tsx`) under the floating chat input: a
 * gradient from transparent to `BACKGROUND_BASE_LOWER` above it and a solid block of that colour
 * behind it. With a theme, that colour is the theme's, so over a chat background image it reads
 * as a band of another colour. Turned off (Appearance > Fade behind the message box), the
 * component renders nothing and the chat shows through.
 *
 * While someone is typing (`hasTypingIndicatorContent`), `ChatInput` draws something else: no
 * fade, but a solid fill (a `pointerEvents: 'none'` View, absolute over the whole input area) plus
 * an `inline` fade above the typing line. With the fade on, that is left alone: it runs seamlessly
 * into the strip below (`lib/navBar.ts`) and keeps the typing line readable. (0.1.32-0.1.34 swapped
 * the fill for the normal fade; its transparent top showed as a lighter stripe under the typing
 * line.) With the fade off, the fill is made see-through, or the band comes back each time the
 * typing line shows; the inline fade is already gone.
 *
 * `after`, not `instead`: two `instead` hooks on one method recurse (upstream bug), and returning
 * null from `after` replaces the element just the same. Read per render, so no reload is needed.
 */
export default function patchChatInputFade(): () => void {
	const unpatchFade = hookByPath(
		'message box fade',
		'modules/chat_input/native/ChatInputScrimGradient.tsx',
		'ChatInputScrimGradient',
		(host, method) =>
			revenge.patcher.after(host, method, (tree: any) =>
				settings().chatInputFade === false ? null : tree,
			),
	)

	const unpatchTyping = hookByPath(
		'message box typing fill',
		'modules/chat_input/native/ChatInput.tsx',
		'render',
		(host, method) =>
			revenge.patcher.after(host, method, (tree: any) => {
				if (settings().chatInputFade !== false) return tree
				try {
					clearTypingFill(tree)
				} catch (error) {
					console.error('[Themes] message box while typing not changed:', error)
				}
				return tree
			}),
		// `memo(forwardRef(render))` up to 349, `memo(render)` from 350.2.
		exports => renderTarget(exports),
	)

	return () => {
		unpatchFade()
		unpatchTyping()
	}
}

function isTypingFill(node: any): boolean {
	const props = node?.props
	if (props?.pointerEvents !== 'none' || props.children != null || !props.style)
		return false
	const style = revenge.react.ReactNative.StyleSheet.flatten(props.style) ?? {}
	return (
		style.position === 'absolute' &&
		style.top === 0 &&
		style.left === 0 &&
		style.right === 0 &&
		style.bottom === 0 &&
		style.backgroundColor != null
	)
}

function clearTypingFill(tree: any) {
	const fill = findInReactTree(tree, isTypingFill)
	if (fill)
		fill.props.style = [fill.props.style, { backgroundColor: 'transparent' }]
}
