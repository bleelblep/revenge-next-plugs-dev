import { discordEmoji } from '../../lib/discordEmoji'
import { emojiCoverage, packById, useEmojiState } from '../../lib/emoji'
import { toast } from '../../lib/state'
import { getViewing } from '../routes'
import { useBottomPadding } from '../safeArea'
import type { DiscordEmoji } from '../../lib/discordEmoji'
import type { EmojiCoverage } from '../../lib/emoji'

type Tab = 'themed' | 'missing'

type Item =
	| { kind: 'header'; key: string; label: string; count: number }
	| { kind: 'row'; key: string; emoji: DiscordEmoji[] }

const CELL = 48

/**
 * Every standard emoji Discord has, split into the ones a downloaded pack draws (shown in the
 * pack's own art, through a font family native registers for React Native) and the ones it leaves
 * out (shown as they'll look instead: Discord's own, and the phone's in text).
 * Tabs are Discord's Buttons, the chosen one filled, like Ghost Log's filters: SegmentedControl's
 * pager inside a list left some phones stuck on one page.
 */
export default function EmojiList() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const React = revenge.react.React
	const { Page } = revenge.components
	const {
		FlatList,
		View,
		Text: RNText,
		Pressable,
		useWindowDimensions,
	} = revenge.react.ReactNative as any
	const { Text, Button } = revenge.discord.design.Design as any
	const { useNavigation, useRoute } = revenge.externals.ReactNavigation
		.ReactNavigationNative as any
	const navigation = useNavigation() as any
	const route = useRoute?.() as { params?: { id?: string } } | undefined
	const pack = packById(route?.params?.id ?? getViewing())
	const [state] = useEmojiState()
	const [tab, setTab] = React.useState<Tab>('themed')
	const [result, setResult] = React.useState<{
		coverage?: EmojiCoverage
		error?: string
	}>({})
	// The list's own width once laid out: the settings pane can be narrower than the window
	// (tablets, landscape), and sizing the grid from the window pushed it off to one side.
	const windowWidth = useWindowDimensions().width
	const [measured, setMeasured] = React.useState(0)
	const width = measured || windowWidth
	const bottom = useBottomPadding()

	const groups = React.useMemo(() => {
		try {
			return discordEmoji()
		} catch (error) {
			console.error('[Themes] emoji list:', error)
			return null
		}
	}, [])
	const texts = React.useMemo(
		() => groups?.flatMap(group => group.emoji.map(emoji => emoji.text)) ?? [],
		[groups],
	)

	React.useEffect(() => {
		if (pack) navigation?.setOptions?.({ title: `${pack.name}: all emoji` })
	}, [pack?.id])

	React.useEffect(() => {
		if (!pack || !texts.length) return
		let live = true
		emojiCoverage(pack.id, texts)
			.then(coverage => live && setResult({ coverage }))
			.catch(
				(error: Error) =>
					live && setResult({ error: error?.message ?? String(error) }),
			)
		return () => {
			live = false
		}
	}, [pack?.id, texts])

	const covered = React.useMemo(() => {
		const map = new Map<string, boolean>()
		result.coverage?.covered.forEach((yes, i) => map.set(texts[i], yes))
		return map
	}, [result.coverage, texts])

	const columns = Math.max(4, Math.floor((width - 32) / CELL))
	// The grid is centred: what's left after whole columns is split evenly either side.
	const inset = Math.max(16, Math.floor((width - columns * CELL) / 2))
	const items = React.useMemo(() => {
		const out: Item[] = []
		for (const group of groups ?? []) {
			const shown = group.emoji.filter(
				emoji => (covered.get(emoji.text) ?? true) === (tab === 'themed'),
			)
			if (!shown.length) continue
			out.push({
				kind: 'header',
				key: `h-${group.category}`,
				label: group.label,
				count: shown.length,
			})
			for (let i = 0; i < shown.length; i += columns) {
				out.push({
					kind: 'row',
					key: `${group.category}-${i}`,
					emoji: shown.slice(i, i + columns),
				})
			}
		}
		return out
	}, [groups, covered, tab, columns])

	const message = (text: string) => (
		<Page>
			<View style={{ padding: 24 }}>
				<Text variant="text-md/normal" color="text-muted">
					{text}
				</Text>
			</View>
		</Page>
	)

	if (!pack) return message("This pack isn't in the list any more.")
	if (!groups)
		return message(
			"Couldn't read Discord's emoji list on this version of Discord.",
		)
	if (!state.installed.includes(pack.id))
		return message(
			'Download the pack first, then come back to see every emoji it has.',
		)
	if (result.error) return message(`Couldn't check the pack: ${result.error}`)
	if (!result.coverage) return message(`Checking ${texts.length} emoji…`)

	const { family, checked } = result.coverage
	const themed = texts.filter(text => covered.get(text)).length
	const missing = texts.length - themed

	const caption =
		tab === 'themed'
			? checked
				? `${pack.name} draws ${themed} of Discord's ${texts.length} emoji. Tap one for its name.`
				: `Android 12 or newer is needed to tell which emoji a pack is missing, so all ${texts.length} are shown here. Any it doesn't have look like your phone's.`
			: `${pack.name} doesn't have these. Shown here as your phone draws them; in messages, reactions and the picker they show as Discord's own, and in text as your phone's.`

	const header = (
		<View
			style={{
				paddingHorizontal: 16,
				paddingTop: 16,
				paddingBottom: 8,
				gap: 12,
			}}
		>
			{checked ? (
				<View style={{ flexDirection: 'row', gap: 8 }}>
					<View style={{ flex: 1 }}>
						<Button
							size="sm"
							variant={tab === 'themed' ? 'primary' : 'secondary'}
							text={`Themed · ${themed}`}
							onPress={() => setTab('themed')}
						/>
					</View>
					<View style={{ flex: 1 }}>
						<Button
							size="sm"
							variant={tab === 'missing' ? 'primary' : 'secondary'}
							text={`Not themed · ${missing}`}
							onPress={() => setTab('missing')}
						/>
					</View>
				</View>
			) : null}
			<Text variant="text-sm/normal" color="text-muted">
				{caption}
			</Text>
			{tab === 'missing' && !missing ? (
				<Text variant="text-md/normal" color="text-default">
					None: {pack.name} has every emoji Discord does.
				</Text>
			) : null}
		</View>
	)

	// Themed ones in the pack's own font; missing ones in the default font, which is how they'll look.
	// Full cell width with centred text, so a pack whose glyphs sit off-centre in their box still
	// lands in the middle; no font padding, so it's centred vertically too.
	const emojiStyle = {
		width: CELL,
		fontSize: 30,
		lineHeight: 40,
		textAlign: 'center' as const,
		textAlignVertical: 'center' as const,
		includeFontPadding: false,
		...(tab === 'themed' && family ? { fontFamily: family } : {}),
	}

	const renderItem = ({ item }: { item: Item }) =>
		item.kind === 'header' ? (
			<View
				style={{ paddingHorizontal: inset, paddingTop: 16, paddingBottom: 6 }}
			>
				<Text variant="eyebrow" color="text-muted">
					{`${item.label} · ${item.count}`}
				</Text>
			</View>
		) : (
			<View
				style={{
					flexDirection: 'row',
					width: columns * CELL,
					alignSelf: 'center',
				}}
			>
				{item.emoji.map(emoji => (
					<Pressable
						key={emoji.text}
						accessibilityLabel={emoji.name}
						onPress={() => toast(`:${emoji.name}:`)}
						style={{
							width: CELL,
							height: CELL,
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<RNText allowFontScaling={false} style={emojiStyle}>
							{emoji.text}
						</RNText>
					</Pressable>
				))}
			</View>
		)

	return (
		<Page>
			<FlatList
				onLayout={(event: any) => {
					const next = Math.round(event?.nativeEvent?.layout?.width ?? 0)
					if (next && next !== measured) setMeasured(next)
				}}
				data={items}
				keyExtractor={(item: Item) => item.key}
				renderItem={renderItem}
				ListHeaderComponent={header}
				extraData={`${tab}-${family}-${columns}`}
				initialNumToRender={20}
				windowSize={7}
				contentContainerStyle={{ paddingBottom: bottom }}
			/>
		</Page>
	)
}
