// SPDX-License-Identifier: CC-BY-4.0
// Adapted from Themes+ by nexpid (nexpid/RevengePlugins, nexpid/ThemesPlus), with changes; see NOTICE.md.
import { DEFAULTS } from '../../defaults'
import {
	allPacks,
	iconUrl,
	isPackShown,
	refreshIncludedList,
	refreshPackList,
	setPackShown,
} from '../../lib/icons'
import { getStorage } from '../../lib/state'
import { asset, openInstallIconPack, useIconPack } from '../actions'
import { rowIcon } from '../icon'
import { ICON_PACK_ROUTE, setViewing } from '../routes'
import { useBottomPadding } from '../safeArea'
import { token } from '../theme'
import type { IconPack } from '../../types'

/** A pack's bell, tinted like Discord tints its icons, as Themes+'s list shows each pack. */
export function PackIcon({
	pack,
	name = 'BellIcon',
	size = 24,
}: {
	pack: IconPack
	name?: string
	size?: number
}) {
	const { Image } = revenge.react.ReactNative
	return (
		<Image
			source={{ uri: iconUrl(pack, name) }}
			style={{
				width: size,
				height: size,
				tintColor: token('INTERACTIVE_ICON_DEFAULT', '#b5bac1'),
			}}
		/>
	)
}

/**
 * Icon packs, laid out like Fonts: Discord's own at the top, then our own packs made from Iconify
 * sets, then Themes+'s, then any added by link, each opening its page; the floating ＋ adds one by
 * link.
 */
export default function Icons() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const React = revenge.react.React
	const { Page } = revenge.components
	const { ScrollView, View, Pressable } = revenge.react.ReactNative
	const {
		Stack,
		Text,
		TableRowGroup,
		TableRow,
		TableSwitchRow,
		FloatingActionButton,
	} = revenge.discord.design.Design as any
	const { useNavigation } =
		revenge.externals.ReactNavigation.ReactNavigationNative
	const navigation = useNavigation() as any
	const bottom = useBottomPadding()
	const [error, setError] = React.useState('')
	const [busy, setBusy] = React.useState('')
	// Choosing which packs are listed: every pack with a switch instead of the list itself.
	const [editing, setEditing] = React.useState(false)

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }
	const packs = allPacks()
	const added = new Set(s.iconPacks.map(pack => pack.id))
	const included = new Set((s.includedPackList ?? []).map(pack => pack.id))
	const fromThemesPlus = packs.filter(
		pack => !added.has(pack.id) && !included.has(pack.id),
	)
	// `s` above subscribes this page to storage, so a switch redraws the lists.
	const listed = (list: IconPack[]) =>
		editing ? list : list.filter(isPackShown)

	// An eye at the top right, as Plugin Hub puts its settings: tap to choose which packs are
	// listed, then the tick to finish.
	React.useLayoutEffect(() => {
		navigation?.setOptions?.({
			headerRight: () => (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={
						editing ? 'Done choosing packs' : 'Choose which packs to show'
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

	React.useEffect(() => {
		refreshPackList().catch((e: Error) => setError(e?.message ?? String(e)))
		refreshIncludedList().catch(() => {
			/* the ones from last time stay listed */
		})
	}, [])

	const open = (id: string) => {
		setViewing(id)
		navigation.navigate(ICON_PACK_ROUTE, { id })
	}

	const row = (pack: IconPack) =>
		editing ? (
			<TableSwitchRow
				key={pack.id}
				label={pack.name}
				subLabel={
					pack.id === s.selectedIconPack
						? 'In use, so always shown'
						: added.has(pack.id)
							? 'Added by you, so always shown'
							: (pack.description ?? '').trim()
				}
				icon={<PackIcon pack={pack} />}
				value={isPackShown(pack)}
				disabled={pack.id === s.selectedIconPack || added.has(pack.id)}
				onValueChange={(value: boolean) => setPackShown(pack.id, value)}
			/>
		) : (
			<TableRow
				key={pack.id}
				label={pack.name}
				subLabel={
					pack.id === s.selectedIconPack
						? 'In use'
						: (pack.description ?? '').trim()
				}
				icon={<PackIcon pack={pack} />}
				arrow
				onPress={() => open(pack.id)}
			/>
		)

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: bottom + 90 }}>
				<Stack spacing={24}>
					<TableRowGroup hasIcons>
						<TableRow
							label="Discord default"
							subLabel={
								busy ||
								(s.selectedIconPack
									? "Go back to Discord's own icons"
									: "In use · Discord's own icons")
							}
							icon={rowIcon('BellIcon', 'ic_notifications')}
							disabled={!s.selectedIconPack || !!busy}
							onPress={() => useIconPack('', setBusy)}
						/>
					</TableRowGroup>

					{editing ? (
						<Text variant="text-sm/normal" color="text-muted">
							Switch a pack off to take it off the list; nothing is uninstalled.
							Tap the tick when you're done.
						</Text>
					) : null}

					{listed(packs.filter(pack => included.has(pack.id))).length ? (
						<TableRowGroup title="Included" hasIcons>
							{listed(packs.filter(pack => included.has(pack.id))).map(row)}
						</TableRowGroup>
					) : null}

					{fromThemesPlus.length ? (
						listed(fromThemesPlus).length ? (
							<TableRowGroup title="From Themes+" hasIcons>
								{listed(fromThemesPlus).map(row)}
							</TableRowGroup>
						) : null
					) : (
						<View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
							<Text variant="text-md/semibold" color="text-default">
								{error
									? "Couldn't get Themes+'s icon packs"
									: 'Getting icon packs…'}
							</Text>
							{error ? (
								<Text
									variant="text-sm/normal"
									color="text-muted"
									style={{ textAlign: 'center' }}
								>
									{error}
								</Text>
							) : null}
						</View>
					)}

					{s.iconPacks.length ? (
						<TableRowGroup title="Added by you" hasIcons>
							{packs.filter(pack => added.has(pack.id)).map(row)}
						</TableRowGroup>
					) : null}

					<Text variant="text-sm/normal" color="text-muted">
						Included packs are made from Iconify icon sets; the others are from
						Themes+ by nexpid. Icons a pack doesn't have stay as Discord's, and
						Discord tints every icon in one colour.
					</Text>

					{FloatingActionButton ? null : (
						<TableRowGroup hasIcons>
							<TableRow
								label="Add an icon pack"
								subLabel="From a link to a Themes+ pack"
								icon={rowIcon('DownloadIcon', 'ic_download_24px')}
								onPress={openInstallIconPack}
							/>
						</TableRowGroup>
					)}
				</Stack>
			</ScrollView>
			{FloatingActionButton ? (
				<FloatingActionButton
					positionBottom={bottom + 16}
					icon={asset('PlusLargeIcon', 'PlusMediumIcon', 'ic_add_24px')}
					onPress={openInstallIconPack}
				/>
			) : null}
		</Page>
	)
}
