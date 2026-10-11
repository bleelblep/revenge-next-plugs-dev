import {
	allEmojiPacks,
	groupsOf,
	isShown,
	setShown,
	useEmojiState,
} from '../../lib/emoji'
import { getStorage } from '../../lib/state'
import { EmojiPackIcon } from '../emojiPreview'
import { EMOJI_PACK_ROUTE, setViewing } from '../routes'
import { useBottomPadding } from '../safeArea'
import {
	alwaysShown,
	getViewingVendor,
	packStatus,
	useEditToggle,
} from './Emoji'

/**
 * One maker's packs (Apple, Samsung...), under Current and Classic. Each opens the pack's page; the
 * eye hides packs.
 */
export default function EmojiVendor() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const React = revenge.react.React
	const { Page } = revenge.components
	const { ScrollView } = revenge.react.ReactNative
	const { Stack, Text, TableRowGroup, TableRow, TableSwitchRow } = revenge
		.discord.design.Design as any
	const { useNavigation, useRoute } = revenge.externals.ReactNavigation
		.ReactNavigationNative as any
	const navigation = useNavigation() as any
	const route = useRoute?.() as { params?: { vendor?: string } } | undefined
	const vendor = route?.params?.vendor ?? getViewingVendor()
	const [state, refresh] = useEmojiState()
	const editing = useEditToggle(navigation, 'packs')
	getStorage()?.use()

	React.useEffect(() => {
		navigation?.setOptions?.({ title: vendor })
	}, [vendor])
	React.useEffect(
		() => navigation?.addListener?.('focus', refresh),
		[navigation],
	)

	const packs = allEmojiPacks().filter(pack => pack.vendor === vendor)
	const shown = (id: string) => isShown(id)
	const groups = groupsOf(
		editing
			? packs
			: packs.filter(pack => alwaysShown(pack, state) || shown(pack.id)),
	)
	const hidden =
		packs.length - groups.reduce((n, [, list]) => n + list.length, 0)

	const open = (id: string) => {
		setViewing(id)
		navigation.navigate(EMOJI_PACK_ROUTE, { id })
	}

	return (
		<Page>
			<ScrollView
				contentContainerStyle={{ paddingBottom: useBottomPadding() + 24 }}
			>
				<Stack spacing={24}>
					{editing ? (
						<Text variant="text-sm/normal" color="text-muted">
							Switch a pack off to take it off the list; nothing is deleted. Tap
							the tick when you're done.
						</Text>
					) : null}

					{groups.map(([group, list]) => (
						<TableRowGroup key={group} title={group} hasIcons>
							{list.map(pack =>
								editing ? (
									<TableSwitchRow
										key={pack.id}
										label={pack.name}
										subLabel={
											alwaysShown(pack, state)
												? 'In use or on this phone, so always shown'
												: packStatus(pack, state)
										}
										icon={<EmojiPackIcon pack={pack} />}
										value={alwaysShown(pack, state) || shown(pack.id)}
										disabled={alwaysShown(pack, state)}
										onValueChange={(value: boolean) => setShown(pack.id, value)}
									/>
								) : (
									<TableRow
										key={pack.id}
										label={pack.name}
										subLabel={packStatus(pack, state)}
										icon={<EmojiPackIcon pack={pack} />}
										arrow
										onPress={() => open(pack.id)}
									/>
								),
							)}
						</TableRowGroup>
					))}

					{!editing && hidden ? (
						<Text variant="text-sm/normal" color="text-muted">
							{hidden} hidden. Tap the eye at the top right to show{' '}
							{hidden === 1 ? 'it' : 'them'}.
						</Text>
					) : null}

					{!packs.length ? (
						<Text variant="text-sm/normal" color="text-muted">
							No packs from this maker any more.
						</Text>
					) : null}
				</Stack>
			</ScrollView>
		</Page>
	)
}
