import { DEFAULTS } from '../../defaults'
import { fontFiles, styleSources } from '../../lib/fonts'
import { getStorage } from '../../lib/state'
import {
	confirmRemoveFont,
	copyFontLink,
	downloadFontAgain,
	useFont,
} from '../actions'
import { FontPreview } from '../fontPreview'
import { dangerIcon, rowIcon } from '../icon'
import { getViewing } from '../routes'
import { useBottomPadding } from '../safeArea'

/**
 * One font's page, laid out like a theme's and an icon pack's: a preview card in the font itself
 * (ui/fontPreview.tsx), use it, which of Discord's styles it covers, its link, remove it.
 */
export default function Font() {
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
	const [busy, setBusy] = React.useState('')
	const [showStyles, setShowStyles] = React.useState(false)

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }
	const font = s.fonts.find(entry => entry.id === id)
	const inUse = !!font && s.selectedFont === font.id

	React.useEffect(() => {
		if (font) navigation?.setOptions?.({ title: font.manifest.name })
	}, [font?.manifest.name])

	if (!font) {
		return (
			<Page>
				<View style={{ padding: 24 }}>
					<Text variant="text-md/normal" color="text-muted">
						This font is no longer installed.
					</Text>
				</View>
			</Page>
		)
	}

	const files = inUse ? fontFiles(font) : undefined
	const styles = styleSources(font.manifest.main)
	const own = styles.filter(style => style.source === 'own').length
	const nearest = styles.filter(style => style.source === 'nearest').length
	const styleSummary = [
		`${own} of ${styles.length} in the font`,
		nearest ? `${nearest} use the nearest` : '',
		styles.length - own - nearest
			? `${styles.length - own - nearest} stay Discord's`
			: '',
	]
		.filter(Boolean)
		.join(' · ')

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<FontPreview font={font} inUse={inUse} />

					<TableRowGroup hasIcons>
						{inUse ? (
							<TableRow
								label="Stop using this font"
								subLabel={`In use${files ? ` · ${files.have} of ${files.total} files on this device` : ''}. Tap to go back to Discord's fonts.`}
								icon={rowIcon('CircleCheckIcon', 'ic_check_24px')}
								disabled={!!busy}
								onPress={() => useFont('')}
							/>
						) : (
							<TableRow
								label="Use this font"
								subLabel={
									busy ||
									`Everywhere in Discord, chat messages included · ${own} of ${styles.length} styles its own`
								}
								icon={rowIcon('TextIcon', 'ic_text')}
								disabled={!!busy}
								onPress={() => {
									setBusy('Downloading…')
									useFont(font.id, text => setBusy(text))
								}}
							/>
						)}
					</TableRowGroup>

					<TableRowGroup title="Styles" hasIcons>
						<TableRow
							label={showStyles ? 'Hide styles' : 'Show all styles'}
							subLabel={styleSummary}
							icon={rowIcon(
								showStyles ? 'ChevronSmallUpIcon' : 'ChevronSmallDownIcon',
								'ic_arrow_down',
							)}
							onPress={() => setShowStyles(!showStyles)}
						/>
						{(showStyles ? styles : []).map(style => (
							<TableRow
								key={style.label}
								label={style.label}
								subLabel={
									style.source === 'own'
										? 'In the font'
										: style.source === 'nearest'
											? `Not in the font · uses ${style.from ?? 'the nearest style'}`
											: "Not in the font · stays Discord's own"
								}
								icon={
									style.source === 'own'
										? rowIcon('CircleCheckIcon', 'ic_check_24px')
										: style.source === 'nearest'
											? rowIcon('ArrowSmallRightIcon', 'ic_arrow_right')
											: rowIcon('CircleMinusIcon', 'ic_close_16px')
								}
							/>
						))}
					</TableRowGroup>

					<TableRowGroup title="Link" hasIcons>
						<TableRow
							label="Download again"
							subLabel="Get the latest version from its link"
							icon={rowIcon('DownloadIcon', 'ic_download_24px')}
							onPress={() => downloadFontAgain(font, inUse)}
						/>
						<TableRow
							label="Copy link"
							subLabel={font.id}
							icon={rowIcon('LinkIcon', 'ic_link')}
							onPress={() => copyFontLink(font)}
						/>
					</TableRowGroup>

					<TableRowGroup hasIcons>
						<TableRow
							label="Remove font"
							subLabel={
								inUse
									? "Discord's own fonts come back"
									: 'You can install it again from its link'
							}
							icon={dangerIcon('TrashIcon', 'ic_trash')}
							variant="danger"
							onPress={() =>
								confirmRemoveFont(font, inUse, () => navigation.goBack())
							}
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
