// SPDX-License-Identifier: CC-BY-4.0
// Adapted from Themes+ by nexpid (nexpid/RevengePlugins, nexpid/ThemesPlus), with changes; see NOTICE.md.
import { DEFAULTS } from '../../defaults'
import { findPack, ICON_FOLDER, packTree, swappedCount } from '../../lib/icons'
import { getStorage } from '../../lib/state'
import { confirmRemoveIconPack, useIconPack } from '../actions'
import { dangerIcon, rowIcon } from '../icon'
import { getViewing } from '../routes'
import { useBottomPadding } from '../safeArea'
import { PackIcon } from './Icons'

/** Icons shown on a pack's page, where the pack has them: ones seen on most screens. */
const PREVIEW = [
	'BellIcon',
	'ChatIcon',
	'FriendsIcon',
	'SettingsIcon',
	'MagnifyingGlassIcon',
	'PinIcon',
	'LinkIcon',
	'CopyIcon',
	'TrashIcon',
	'PencilIcon',
	'EyeIcon',
	'LockIcon',
]

/**
 * One icon pack's page, like a font's: a row of its icons, use it, who made it, remove it (packs
 * added by link only; Themes+'s own list can't be edited here).
 */
export default function IconPackPage() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const React = revenge.react.React
	const { Page } = revenge.components
	const { ScrollView, View } = revenge.react.ReactNative
	const { Stack, Text, Card, TableRowGroup, TableRow } = revenge.discord.design
		.Design as any
	const { useNavigation, useRoute } = revenge.externals.ReactNavigation
		.ReactNavigationNative as any
	const navigation = useNavigation() as any
	const route = useRoute?.() as { params?: { id?: string } } | undefined
	const id = route?.params?.id ?? getViewing()
	const [busy, setBusy] = React.useState('')
	const [tree, setTree] = React.useState<string[] | undefined>(undefined)

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }
	const pack = findPack(id)
	const inUse = !!pack && s.selectedIconPack === pack.id
	const added = !!pack && s.iconPacks.some(entry => entry.id === pack.id)

	React.useEffect(() => {
		if (!pack) return
		navigation?.setOptions?.({ title: pack.name })
		packTree(pack)
			.then(setTree)
			.catch(() => setTree([]))
	}, [pack?.id])

	if (!pack) {
		return (
			<Page>
				<View style={{ padding: 24 }}>
					<Text variant="text-md/normal" color="text-muted">
						This icon pack is no longer there.
					</Text>
				</View>
			</Page>
		)
	}

	const suffix = pack.suffix ?? ''
	const has = (name: string) =>
		!tree?.length || tree.includes(`${ICON_FOLDER}/${name}${suffix}.png`)
	const shown = tree ? PREVIEW.filter(has) : []
	const authors =
		pack.credits?.authors?.map(author => author?.name).filter(Boolean) ?? []
	const sources = pack.credits?.sources?.filter(Boolean) ?? []

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<Card variant="secondary" border="none">
						<View
							style={{
								flexDirection: 'row',
								flexWrap: 'wrap',
								gap: 18,
								padding: 18,
								justifyContent: 'center',
								minHeight: 72,
							}}
						>
							{tree === undefined ? (
								<Text variant="text-sm/normal" color="text-muted">
									Getting the pack's icons…
								</Text>
							) : (
								shown.map(name => (
									<PackIcon key={name} pack={pack} name={name} size={28} />
								))
							)}
						</View>
					</Card>

					<TableRowGroup hasIcons>
						{inUse ? (
							<TableRow
								label="Stop using this pack"
								subLabel={`In use · ${swappedCount()} icons swapped. Tap to go back to Discord's icons.`}
								icon={rowIcon('CircleCheckIcon', 'ic_check_24px')}
								disabled={!!busy}
								onPress={() => useIconPack('', setBusy)}
							/>
						) : (
							<TableRow
								label="Use this pack"
								subLabel={
									busy || 'Swaps the icons it has; the rest stay Discord’s'
								}
								icon={rowIcon('ImageIcon', 'ic_image')}
								disabled={!!busy}
								onPress={() => useIconPack(pack.id, setBusy)}
							/>
						)}
					</TableRowGroup>

					<TableRowGroup title="About" hasIcons>
						{authors.length ? (
							<TableRow
								label="Made by"
								subLabel={authors.join(', ')}
								icon={rowIcon('UserIcon', 'ic_profile_24px')}
							/>
						) : null}
						{pack.description?.trim() ? (
							<TableRow
								label="Description"
								subLabel={pack.description.trim()}
								icon={rowIcon('TextIcon', 'ic_text')}
							/>
						) : null}
						{sources.length ? (
							<TableRow
								label="Icons from"
								subLabel={sources.join('\n')}
								icon={rowIcon('LinkIcon', 'ic_link')}
							/>
						) : null}
						<TableRow
							label="Icons"
							subLabel={
								tree === undefined
									? 'Counting…'
									: tree.length
										? `${tree.length} files in the pack`
										: 'No file list: every redesign icon is tried'
							}
							icon={rowIcon('WrenchIcon', 'ic_settings')}
						/>
					</TableRowGroup>

					{added ? (
						<TableRowGroup hasIcons>
							<TableRow
								label="Remove icon pack"
								subLabel={
									inUse
										? "Discord's own icons come back"
										: 'You can add it again from its link'
								}
								icon={dangerIcon('TrashIcon', 'ic_trash')}
								variant="danger"
								onPress={() =>
									confirmRemoveIconPack(pack, inUse, () => navigation.goBack())
								}
							/>
						</TableRowGroup>
					) : null}
				</Stack>
			</ScrollView>
		</Page>
	)
}
