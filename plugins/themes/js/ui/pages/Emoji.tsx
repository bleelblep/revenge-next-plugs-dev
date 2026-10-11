import {
	EMOJI_SIZES,
	isShown,
	packById,
	packsByVendor,
	selectPack,
	setEmojiScale,
	setShown,
	useEmojiState,
	vendorKey,
} from '../../lib/emoji'
import { getStorage, toast } from '../../lib/state'
import { markReloadNeeded, ReloadRow } from '../actions'
import { EmojiPackIcon } from '../emojiPreview'
import { rowIcon } from '../icon'
import { EMOJI_PACK_ROUTE, EMOJI_VENDOR_ROUTE, setViewing } from '../routes'
import { useBottomPadding } from '../safeArea'
import type { EmojiPack, EmojiState } from '../../lib/emoji'

/** One pack's line under its name: in use, downloading, on the phone, or its size and source. */
export function packStatus(pack: EmojiPack, state: EmojiState): string {
	if (state.downloading === pack.id) {
		const mb = (n: number) => (n / 1_048_576).toFixed(1)
		return state.total
			? `Downloading · ${mb(state.bytes)} of ${mb(state.total)} MB`
			: 'Downloading…'
	}
	if (state.selected === pack.id) return 'In use'
	if (state.installed.includes(pack.id)) return 'On this phone'
	return `${pack.size} MB`
}

/** A pack that is in use or downloaded is always listed, whatever its switch says. */
export function alwaysShown(pack: EmojiPack, state: EmojiState): boolean {
	return state.selected === pack.id || state.installed.includes(pack.id)
}

/** Which maker's page is open; a fallback for a navigator that drops params. */
let viewingVendor = ''

export function getViewingVendor(): string {
	return viewingVendor
}

/** The eye at the top right, as Icons has it: tap to choose what's listed, the tick to finish. */
export function useEditToggle(navigation: any, what: string): boolean {
	const React = revenge.react.React
	const { Pressable } = revenge.react.ReactNative
	const [editing, setEditing] = React.useState(false)
	React.useLayoutEffect(() => {
		navigation?.setOptions?.({
			headerRight: () => (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={
						editing ? `Done choosing ${what}` : `Choose which ${what} to show`
					}
					hitSlop={12}
					onPress={() => setEditing(!editing)}
					style={({ pressed }: { pressed: boolean }) => ({
						paddingHorizontal: 12,
						opacity: pressed ? 0.5 : 1,
					})}
				>
					{rowIcon(
						editing ? 'CheckmarkLargeIcon' : 'EyeIcon',
						editing ? 'CircleCheckIcon' : 'ic_visibility',
					)}
				</Pressable>
			),
		})
	}, [editing])
	return editing
}

/**
 * Emoji packs, laid out like Fonts and Icons: Discord's own at the top, the pack in use, then one
 * row per maker (Apple, Samsung, Google...) opening its packs by year; then the size of emoji in
 * messages. The eye at the top right switches makers off the list.
 */
export default function Emoji() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const React = revenge.react.React
	const { Page } = revenge.components
	const { ScrollView, View } = revenge.react.ReactNative
	const {
		Stack,
		Text,
		TableRowGroup,
		TableRow,
		TableSwitchRow,
		TableRadioGroup,
		TableRadioRow,
	} = revenge.discord.design.Design as any
	const { useNavigation } =
		revenge.externals.ReactNavigation.ReactNavigationNative
	const navigation = useNavigation() as any
	const bottom = useBottomPadding()
	const [state, refresh] = useEmojiState()
	const editing = useEditToggle(navigation, 'makers')
	// Subscribes to storage: the list redraws when a switch changes.
	getStorage()?.use()

	React.useEffect(
		() => navigation?.addListener?.('focus', refresh),
		[navigation],
	)

	const inUse = packById(state.selected)
	const vendors = packsByVendor()
	// A maker with a pack in use or on the phone can't be hidden.
	const keeps = (packs: EmojiPack[]) =>
		packs.some(pack => alwaysShown(pack, state))
	const listed = editing
		? vendors
		: vendors.filter(
				([vendor, packs]) => keeps(packs) || isShown(vendorKey(vendor)),
			)

	const openVendor = (vendor: string) => {
		viewingVendor = vendor
		navigation.navigate(EMOJI_VENDOR_ROUTE, { vendor })
	}
	const openPack = (id: string) => {
		setViewing(id)
		navigation.navigate(EMOJI_PACK_ROUTE, { id })
	}

	if (!state.supported) {
		return (
			<Page>
				<View style={{ padding: 24, gap: 6 }}>
					<Text variant="text-md/semibold" color="text-default">
						Emoji packs need Android 10 or newer
					</Text>
					<Text variant="text-sm/normal" color="text-muted">
						Or Themes' native part didn't load. Close and reopen Discord, then
						look again.
					</Text>
				</View>
			</Page>
		)
	}

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: bottom + 24 }}>
				<Stack spacing={24}>
					<ReloadRow detail="Reload to see the new emoji everywhere, the message box and names included." />

					<TableRowGroup hasIcons>
						<TableRow
							label="Discord default"
							subLabel={
								state.selected
									? "Go back to Discord's own emoji"
									: "In use · Discord's own emoji"
							}
							icon={rowIcon('ReactionIcon', 'ic_emoji_24px')}
							disabled={!state.selected}
							onPress={() =>
								selectPack('')
									.then(() => {
										markReloadNeeded()
										refresh()
									})
									.catch((error: Error) =>
										toast(error?.message ?? String(error)),
									)
							}
						/>
						{inUse ? (
							<TableRow
								label={inUse.name}
								subLabel={`In use · ${inUse.vendor}`}
								icon={<EmojiPackIcon pack={inUse} />}
								arrow
								onPress={() => openPack(inUse.id)}
							/>
						) : null}
					</TableRowGroup>

					{editing ? (
						<Text variant="text-sm/normal" color="text-muted">
							Switch a maker off to take it off the list; nothing is deleted.
							Tap the tick when you're done.
						</Text>
					) : null}

					<TableRowGroup title="Packs" hasIcons>
						{listed.map(([vendor, packs]) => {
							const onPhone = packs.filter(pack =>
								state.installed.includes(pack.id),
							).length
							const count = `${packs.length} ${packs.length === 1 ? 'pack' : 'packs'}${onPhone ? ` · ${onPhone} on this phone` : ''}`
							return editing ? (
								<TableSwitchRow
									key={vendor}
									label={vendor}
									subLabel={
										keeps(packs)
											? 'Has a pack in use or on this phone, so always shown'
											: count
									}
									icon={<EmojiPackIcon pack={packs[0]} />}
									value={keeps(packs) || isShown(vendorKey(vendor))}
									disabled={keeps(packs)}
									onValueChange={(value: boolean) =>
										setShown(vendorKey(vendor), value)
									}
								/>
							) : (
								<TableRow
									key={vendor}
									label={vendor}
									subLabel={count}
									icon={<EmojiPackIcon pack={packs[0]} />}
									arrow
									onPress={() => openVendor(vendor)}
								/>
							)
						})}
					</TableRowGroup>

					{!editing && vendors.length > listed.length ? (
						<Text variant="text-sm/normal" color="text-muted">
							{vendors.length - listed.length}{' '}
							{vendors.length - listed.length === 1 ? 'maker' : 'makers'}{' '}
							hidden. Tap the eye at the top right to show{' '}
							{vendors.length - listed.length === 1 ? 'it' : 'them'}.
						</Text>
					) : null}

					<TableRadioGroup
						key={`size-${state.scale}`}
						title="Size in messages"
						description="Reactions and the emoji picker keep Discord's size. Messages already on screen change when they're drawn again."
						hasIcons
						defaultValue={String(
							EMOJI_SIZES.find(
								size => Math.abs(size.value - state.scale) < 0.01,
							)?.value ?? 1,
						)}
						onChange={(value: string) =>
							setEmojiScale(Number(value))
								.then(() => {
									markReloadNeeded()
									refresh()
								})
								.catch((error: Error) => toast(error?.message ?? String(error)))
						}
					>
						{EMOJI_SIZES.map(size => (
							<TableRadioRow
								key={size.label}
								label={size.label}
								icon={rowIcon('ReactionIcon', 'ic_emoji_24px')}
								value={String(size.value)}
							/>
						))}
					</TableRadioGroup>

					<Text variant="text-sm/normal" color="text-muted">
						One pack per distinct look, from PoomSmart's EmojiFonts and zFont's
						library on GitHub, downloaded from there. Emoji in messages,
						reactions and the picker change at once; in the message box and
						names after a reload.
					</Text>
				</Stack>
			</ScrollView>
		</Page>
	)
}
