import { PREVIEW_SAMPLE, usePackPreview } from '../lib/emoji'
import { rowIcon } from './icon'
import type { EmojiPack } from '../lib/emoji'

const ICON_SAMPLE = [PREVIEW_SAMPLE[0]]

/** A pack's 😀 as its row icon, read from the pack itself; Discord's emoji icon until it loads. */
export function EmojiPackIcon({
	pack,
	size = 24,
}: {
	pack: EmojiPack
	size?: number
}) {
	const { Image } = revenge.react.ReactNative
	const uri = usePackPreview(pack, ICON_SAMPLE)?.[0]
	if (!uri) return rowIcon('ReactionIcon', 'ic_emoji_24px')
	return <Image source={{ uri }} style={{ width: size, height: size }} />
}

/**
 * A pack's preview card, at the top of its page like a font's sample or an icon pack's row of
 * icons: a dozen of its emoji, taken from the font on GitHub before anything is downloaded.
 */
export function EmojiPackPreview({ pack }: { pack: EmojiPack }) {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { View, Image } = revenge.react.ReactNative
	const { Card, Text } = revenge.discord.design.Design as any
	const uris = usePackPreview(pack)
	const shown = (uris ?? []).filter((uri): uri is string => !!uri)

	return (
		<Card variant="secondary" border="none">
			<View style={{ minHeight: 132, padding: 18, justifyContent: 'center' }}>
				{shown.length ? (
					<View
						style={{
							flexDirection: 'row',
							flexWrap: 'wrap',
							justifyContent: 'center',
							gap: 14,
						}}
					>
						{shown.map(uri => (
							<Image
								key={uri}
								source={{ uri }}
								style={{ width: 40, height: 40 }}
							/>
						))}
					</View>
				) : (
					<Text
						color="text-muted"
						variant="text-sm/normal"
						style={{ textAlign: 'center' }}
					>
						{uris === undefined
							? 'Getting a preview…'
							: "No preview: this pack may be drawn as vectors, which can't be previewed, or GitHub didn't answer. It can still be used."}
					</Text>
				)}
			</View>
		</Card>
	)
}
