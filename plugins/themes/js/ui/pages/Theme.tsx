import { DEFAULTS } from '../../defaults'
import { themeColours } from '../../lib/preview'
import { getStorage, toast } from '../../lib/state'
import { coverage, selectTheme, unplacedNames } from '../../lib/themes'
import {
	askForReload,
	authorsOf,
	confirmRemove,
	copyLink,
	downloadAgain,
	useDiscordColours,
} from '../actions'
import { dangerIcon, rowIcon } from '../icon'
import { MessagesPreview, paletteOf } from '../preview'
import { getViewing } from '../routes'
import { useBottomPadding } from '../safeArea'

/**
 * One theme's page, opened by holding its tile: a preview in its colours, what it is, and what
 * can be done with it. Discord rows throughout; the only pop-up is the confirmation before
 * removing it, which is how Discord asks before anything destructive.
 */
export default function Theme() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const React = revenge.react.React
	const { Page } = revenge.components
	const { ScrollView, View } = revenge.react.ReactNative
	const { Stack, Text, TableRowGroup, TableRow } = revenge.discord.design
		.Design as any
	const { useNavigation, useRoute } = revenge.externals.ReactNavigation
		.ReactNavigationNative as any
	const navigation = useNavigation() as any
	const route = useRoute?.() as { params?: { id?: string } } | undefined
	const id = route?.params?.id ?? getViewing()

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }
	const theme = s.themes.find(entry => entry.id === id)
	const inUse = !!theme && s.selected === theme.id
	const [showLeftOut, setShowLeftOut] = React.useState(false)

	React.useEffect(() => {
		if (theme) navigation?.setOptions?.({ title: theme.manifest.name })
	}, [theme?.manifest.name])

	if (!theme) {
		return (
			<Page>
				<View style={{ padding: 24 }}>
					<Text variant="text-md/normal" color="text-muted">
						This theme is no longer installed.
					</Text>
				</View>
			</Page>
		)
	}

	const reach = inUse ? coverage() : undefined
	// Old colour names this theme sets that this Discord has nowhere to put (lib/legacy.ts).
	const leftOut = inUse ? unplacedNames() : []
	const p = paletteOf(themeColours(theme.id, theme.manifest))
	const spec =
		theme.manifest.spec === 3 ? 'Bunny / Revenge (spec 3)' : 'Vendetta (spec 2)'

	const use = () => {
		try {
			selectTheme(theme.id)
			askForReload()
		} catch (error) {
			toast(`Couldn't apply that theme: ${(error as Error)?.message ?? error}`)
		}
	}

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<View
						style={{
							height: 300,
							borderRadius: 20,
							overflow: 'hidden',
							backgroundColor: p.page,
							padding: 10,
						}}
					>
						<MessagesPreview p={p} />
					</View>

					<TableRowGroup hasIcons>
						{inUse ? (
							<TableRow
								label="Stop using this theme"
								subLabel={`In use${reach ? ` · ${reach.covered} of ${reach.total} colours follow it` : ''}. Tap to go back to Discord's colours.`}
								icon={rowIcon('CircleCheckIcon', 'ic_check_24px')}
								onPress={useDiscordColours}
							/>
						) : (
							<TableRow
								label="Use this theme"
								subLabel="Changes Discord's colours on this device"
								icon={rowIcon('PaintPaletteIcon', 'ic_theme_24px')}
								onPress={use}
							/>
						)}
					</TableRowGroup>

					<TableRowGroup title="About" hasIcons>
						<TableRow
							label="Made by"
							subLabel={authorsOf(theme).replace(/^by /, '')}
							icon={rowIcon('UserIcon', 'ic_profile_24px')}
						/>
						{theme.manifest.description ? (
							<TableRow
								label="Description"
								subLabel={theme.manifest.description}
								icon={rowIcon('TextIcon', 'ic_text')}
							/>
						) : null}
						<TableRow
							label="Format"
							subLabel={spec}
							icon={rowIcon('WrenchIcon', 'ic_settings')}
						/>
						{leftOut.length ? (
							<TableRow
								label={`${leftOut.length} old ${leftOut.length === 1 ? 'colour' : 'colours'} left out`}
								subLabel={
									showLeftOut
										? leftOut.join(', ')
										: "Set for parts of Discord this version doesn't have. Tap to see which."
								}
								icon={rowIcon('CircleInformationIcon', 'ic_info_24px')}
								onPress={() => setShowLeftOut(!showLeftOut)}
							/>
						) : null}
					</TableRowGroup>

					<TableRowGroup title="Link" hasIcons>
						<TableRow
							label="Download again"
							subLabel="Get the latest version from its link"
							icon={rowIcon('DownloadIcon', 'ic_download_24px')}
							onPress={() => downloadAgain(theme, inUse)}
						/>
						<TableRow
							label="Copy link"
							subLabel={theme.id}
							icon={rowIcon('LinkIcon', 'ic_link')}
							onPress={() => copyLink(theme)}
						/>
					</TableRowGroup>

					<TableRowGroup hasIcons>
						<TableRow
							label="Remove theme"
							subLabel={
								inUse
									? "Discord's own colours come back"
									: 'You can install it again from its link'
							}
							icon={dangerIcon('TrashIcon', 'ic_trash')}
							variant="danger"
							onPress={() =>
								confirmRemove(theme, inUse, () => navigation.goBack())
							}
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
