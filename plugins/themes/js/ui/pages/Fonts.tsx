import { DEFAULTS } from '../../defaults'
import { foreignFont, styleSources } from '../../lib/fonts'
import { getStorage } from '../../lib/state'
import { asset, openInstallFont, ReloadRow, useFont } from '../actions'
import { rowIcon } from '../icon'
import { FONT_ROUTE, setViewing } from '../routes'
import { useBottomPadding } from '../safeArea'

/**
 * Your fonts, laid out like Your themes and Icons: the Reload row, Discord's own at the top, one
 * row per installed font opening its page, a muted caption, and the floating ＋ to install one
 * from a link.
 */
/** "5 of 13 styles": how many of Discord's styles are the font's own files. */
function ownStyles(main: Record<string, string>): string {
	const styles = styleSources(main)
	return `${styles.filter(style => style.source === 'own').length} of ${styles.length} styles`
}

export default function Fonts() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = revenge.components
	const { ScrollView, View } = revenge.react.ReactNative
	const { Stack, Text, TableRowGroup, TableRow, FloatingActionButton } = revenge
		.discord.design.Design as any
	const { useNavigation } =
		revenge.externals.ReactNavigation.ReactNavigationNative
	const navigation = useNavigation() as any
	const bottom = useBottomPadding()

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }
	const other = foreignFont()

	const open = (id: string) => {
		setViewing(id)
		navigation.navigate(FONT_ROUTE, { id })
	}

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: bottom + 90 }}>
				<Stack spacing={24}>
					<ReloadRow />

					<TableRowGroup hasIcons>
						<TableRow
							label="Discord default"
							subLabel={
								s.selectedFont
									? "Go back to Discord's own fonts"
									: other
										? `Revenge is using "${other}". Tap to go back to Discord's fonts`
										: "In use · gg sans, Discord's own"
							}
							icon={rowIcon('TextIcon', 'ic_text')}
							disabled={!s.selectedFont && !other}
							onPress={() => useFont('')}
						/>
					</TableRowGroup>

					{s.fonts.length ? (
						<TableRowGroup hasIcons>
							{s.fonts.map(font => (
								<TableRow
									key={font.id}
									label={font.manifest.name}
									subLabel={
										font.id === s.selectedFont
											? `In use · ${ownStyles(font.manifest.main)} its own`
											: font.manifest.description ||
												`${ownStyles(font.manifest.main)} its own`
									}
									icon={rowIcon('TextIcon', 'ic_text')}
									arrow
									onPress={() => open(font.id)}
								/>
							))}
						</TableRowGroup>
					) : (
						<View style={{ paddingVertical: 32, alignItems: 'center', gap: 6 }}>
							<Text variant="text-lg/semibold" color="text-default">
								No fonts yet
							</Text>
							<Text
								variant="text-sm/normal"
								color="text-muted"
								style={{ textAlign: 'center' }}
							>
								Tap + to install one from a link: a Revenge font .json, or a
								.ttf or .otf file.
							</Text>
						</View>
					)}

					<Text variant="text-sm/normal" color="text-muted">
						Fonts change after a reload. Styles a font doesn't have use its
						nearest one; its page shows which.
					</Text>

					{FloatingActionButton ? null : (
						<TableRowGroup hasIcons>
							<TableRow
								label="Install a font"
								subLabel="From a link to a .json, .ttf or .otf file"
								icon={rowIcon('DownloadIcon', 'ic_download_24px')}
								onPress={openInstallFont}
							/>
						</TableRowGroup>
					)}
				</Stack>
			</ScrollView>
			{FloatingActionButton ? (
				<FloatingActionButton
					positionBottom={bottom + 16}
					icon={asset('PlusLargeIcon', 'PlusMediumIcon', 'ic_add_24px')}
					onPress={openInstallFont}
				/>
			) : null}
		</Page>
	)
}
