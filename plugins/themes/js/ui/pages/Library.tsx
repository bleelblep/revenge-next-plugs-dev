import { DEFAULTS } from '../../defaults'
import { discordTheme } from '../../lib/engine'
import { hasMissing, health } from '../../lib/health'
import { discordColours, themeColours } from '../../lib/preview'
import { getStorage } from '../../lib/state'
import { buildChecked, coverage, skippedAtLaunch } from '../../lib/themes'
import {
	asset,
	authorsOf,
	DISCORD_THEME_NAMES,
	openInstall,
	ReloadRow,
	useDiscordColours,
} from '../actions'
import { rowIcon } from '../icon'
import { Dots, keyColours, paletteOf } from '../preview'
import { DEBUG_ROUTE, setViewing, THEME_ROUTE } from '../routes'
import { useBottomPadding } from '../safeArea'
import type { Part } from '../../lib/health'

/**
 * Your themes, opened straight from the Themes row: one row per installed theme, opening its page,
 * where it can be used, updated or removed. Installing is the floating ＋, which asks for the link
 * in a Discord alert. The settings pages are under their own Settings row (pages/Settings.tsx).
 */
export default function Library() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = revenge.components
	const { ScrollView, View } = revenge.react.ReactNative
	const { Stack, Text, Card, TableRowGroup, TableRow, FloatingActionButton } =
		revenge.discord.design.Design as any
	const { useNavigation } =
		revenge.externals.ReactNavigation.ReactNavigationNative
	const navigation = useNavigation() as any
	const bottom = useBottomPadding()

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }
	const reach = s.selected ? coverage() : undefined

	// What Themes needs that this Discord is missing (lib/health.ts), checked once per visit.
	const React = revenge.react.React
	const [parts, setParts] = React.useState<Part[]>([])
	React.useEffect(() => {
		health().then(setParts, () => {})
	}, [])
	const missing = hasMissing(parts)
	const unchecked = !!s.selected && !buildChecked()

	const open = (id: string) => {
		setViewing(id)
		navigation.navigate(THEME_ROUTE, { id })
	}

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: bottom + 90 }}>
				<Stack spacing={24}>
					<ReloadRow />

					{skippedAtLaunch() && s.selected ? (
						<Card
							variant="secondary"
							border="none"
							style={{
								backgroundColor: '#f0b2321f',
								borderColor: '#f0b23266',
								borderWidth: 1,
							}}
						>
							<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
								<Text color="text-feedback-warning" variant="text-md/semibold">
									Your theme was skipped at launch
								</Text>
								<Text
									color="text-muted"
									variant="text-sm/normal"
									style={{ marginTop: 6 }}
								>
									{s.lastCrash
										? `The last launch hit an error with it on (${s.lastCrash}), so this one started with Discord's colours.`
										: "The last launch didn't finish with it on, so this one started with Discord's colours."}{' '}
									Choose it again below.
								</Text>
							</View>
						</Card>
					) : null}

					{missing || unchecked ? (
						<TableRowGroup hasIcons>
							{missing ? (
								<TableRow
									label="Some parts don't work on this Discord version"
									subLabel={`${parts
										.filter(p => p.status === 'missing')
										.map(p => p.feature)
										.join(', ')}. Everything else works. Tap for details.`}
									icon={rowIcon(
										'WarningIcon',
										'CircleWarningIcon',
										'ic_warning_24px',
									)}
									arrow
									onPress={() => navigation.navigate(DEBUG_ROUTE)}
								/>
							) : null}
							{unchecked ? (
								<TableRow
									label="This Discord version hasn't been checked yet"
									subLabel="Your theme goes on once Discord has started, to be safe. After a launch without problems, it goes on straight away again."
									icon={rowIcon('ClockIcon', 'ic_clock')}
								/>
							) : null}
						</TableRowGroup>
					) : null}

					<TableRowGroup hasIcons>
						<TableRow
							label="Discord default"
							subLabel={
								s.selected
									? `Go back to Discord's own colours (${DISCORD_THEME_NAMES[discordTheme()] ?? discordTheme()})`
									: `In use · your ${DISCORD_THEME_NAMES[discordTheme()] ?? discordTheme()} theme from Appearance`
							}
							icon={
								<Dots
									colours={keyColours(paletteOf(discordColours())).slice(0, 3)}
									size={10}
								/>
							}
							disabled={!s.selected}
							onPress={useDiscordColours}
						/>
					</TableRowGroup>

					{s.themes.length ? (
						<TableRowGroup hasIcons>
							{s.themes.map(theme => (
								<TableRow
									key={theme.id}
									label={theme.manifest.name}
									subLabel={
										theme.id === s.selected
											? `In use${reach ? ` · ${reach.covered} of ${reach.total} colours` : ''}`
											: authorsOf(theme)
									}
									icon={
										<Dots
											colours={keyColours(
												paletteOf(themeColours(theme.id, theme.manifest)),
											).slice(0, 3)}
											size={10}
										/>
									}
									arrow
									onPress={() => open(theme.id)}
								/>
							))}
						</TableRowGroup>
					) : (
						<View style={{ paddingVertical: 32, alignItems: 'center', gap: 6 }}>
							<Text variant="text-lg/semibold" color="text-default">
								No themes yet
							</Text>
							<Text
								variant="text-sm/normal"
								color="text-muted"
								style={{ textAlign: 'center' }}
							>
								Tap + to install one from a link. Revenge and Vendetta themes
								both work.
							</Text>
						</View>
					)}

					<Text color="text-muted" variant="text-sm/normal">
						Chat message text is drawn by Discord's native code and keeps its
						usual colour for now.
					</Text>

					{/* Without Discord's floating button on this build, install from a row instead. */}
					{FloatingActionButton ? null : (
						<TableRowGroup hasIcons>
							<TableRow
								label="Install a theme"
								subLabel="From a link to a .json file"
								icon={rowIcon('DownloadIcon', 'ic_download_24px')}
								onPress={openInstall}
							/>
						</TableRowGroup>
					)}
				</Stack>
			</ScrollView>
			{FloatingActionButton ? (
				<FloatingActionButton
					positionBottom={bottom + 16}
					icon={asset('PlusLargeIcon', 'PlusMediumIcon', 'ic_add_24px')}
					onPress={openInstall}
				/>
			) : null}
		</Page>
	)
}
