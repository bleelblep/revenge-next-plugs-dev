import {
	cancelDownload,
	downloadPack,
	packById,
	removePack,
	selectPack,
	useEmojiState,
} from '../../lib/emoji'
import { toast } from '../../lib/state'
import { markReloadNeeded, ReloadRow } from '../actions'
import { EmojiPackPreview } from '../emojiPreview'
import { dangerIcon, rowIcon } from '../icon'
import { EMOJI_LIST_ROUTE, getViewing } from '../routes'
import { useBottomPadding } from '../safeArea'
import { packStatus } from './Emoji'

const REMOVE_ALERT = 'bleelblep.themes.remove-emoji'

/**
 * One emoji pack's page, laid out like a font's: use it (downloading first if needed), where it
 * comes from, remove it.
 */
export default function EmojiPack() {
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
	const pack = packById(route?.params?.id ?? getViewing())
	const [state, refresh, setState] = useEmojiState()
	const [busy, setBusy] = React.useState('')
	// Use the pack once its download finishes, if that's what was asked for.
	const [useWhenDone, setUseWhenDone] = React.useState(false)

	React.useEffect(() => {
		if (pack) navigation?.setOptions?.({ title: pack.name })
	}, [pack?.id])

	const use = (id: string) => {
		setBusy('Loading…')
		selectPack(id)
			.then(() => {
				markReloadNeeded()
				toast(id ? `Using ${pack?.name}` : "Back to Discord's emoji")
			})
			.catch((error: Error) => toast(error?.message ?? String(error)))
			.finally(() => {
				setBusy('')
				refresh()
			})
	}

	const installed = !!pack && state.installed.includes(pack.id)
	const downloading = !!pack && state.downloading === pack.id

	React.useEffect(() => {
		if (!pack || !useWhenDone || state.downloading) return
		setUseWhenDone(false)
		if (state.installed.includes(pack.id)) use(pack.id)
		else if (state.downloadError)
			toast(`Couldn't download ${pack.name}: ${state.downloadError}`)
	}, [state.downloading, state.installed.join(','), useWhenDone])

	if (!pack) {
		return (
			<Page>
				<View style={{ padding: 24 }}>
					<Text variant="text-md/normal" color="text-muted">
						This pack isn't in the list any more.
					</Text>
				</View>
			</Page>
		)
	}

	const inUse = state.selected === pack.id

	const confirmRemove = () => {
		const { AlertModal, AlertActionButton } = revenge.discord.design
			.Design as any
		const alerts = revenge.discord.actions.AlertActionCreators
		alerts.openAlert(
			REMOVE_ALERT,
			<AlertModal
				title={`Remove ${pack.name}?`}
				content={
					inUse
						? `It's the pack in use, so Discord's own emoji come back. Frees ${pack.size} MB.`
						: `Frees ${pack.size} MB. You can download it again here.`
				}
				actions={
					<>
						<AlertActionButton
							text="Remove"
							variant="destructive"
							onPress={() => {
								alerts.dismissAlert(REMOVE_ALERT)
								removePack(pack.id)
									.then(() => {
										if (inUse) markReloadNeeded()
										toast(`Removed ${pack.name}`)
										refresh()
									})
									.catch((error: Error) =>
										toast(error?.message ?? String(error)),
									)
							}}
						/>
						<AlertActionButton
							text="Cancel"
							variant="secondary"
							onPress={() => alerts.dismissAlert(REMOVE_ALERT)}
						/>
					</>
				}
			/>,
		)
	}

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<ReloadRow detail="Reload to see the new emoji everywhere, the message box and names included." />

					<EmojiPackPreview pack={pack} />

					<TableRowGroup hasIcons>
						{inUse ? (
							<TableRow
								label="Stop using this pack"
								subLabel="In use. Tap to go back to Discord's own emoji."
								icon={rowIcon('CircleCheckIcon', 'ic_check_24px')}
								disabled={!!busy}
								onPress={() => use('')}
							/>
						) : downloading ? (
							<TableRow
								label="Cancel download"
								subLabel={packStatus(pack, state)}
								icon={rowIcon('XSmallIcon', 'ic_close_16px')}
								onPress={() => {
									setUseWhenDone(false)
									cancelDownload().then(refresh)
								}}
							/>
						) : (
							<TableRow
								label="Use this pack"
								subLabel={
									busy ||
									(installed
										? 'In messages, reactions, the picker, the message box and names'
										: `Downloads ${pack.size} MB first, from GitHub`)
								}
								icon={rowIcon(
									installed ? 'ReactionIcon' : 'DownloadIcon',
									installed ? 'ic_emoji_24px' : 'ic_download_24px',
								)}
								disabled={!!busy || !!state.downloading}
								onPress={() => {
									if (installed) {
										use(pack.id)
										return
									}
									// Set from the reply, which already says it's downloading, so the
									// use-when-done effect waits for the end.
									downloadPack(pack)
										.then(next => {
											setState(next)
											setUseWhenDone(true)
										})
										.catch((error: Error) =>
											toast(error?.message ?? String(error)),
										)
								}}
							/>
						)}
					</TableRowGroup>

					<TableRowGroup hasIcons>
						<TableRow
							label="All emoji"
							subLabel={
								installed
									? "Every emoji Discord has, split into the ones this pack themes and the ones it doesn't"
									: "Download the pack to see every emoji it themes and the ones it doesn't"
							}
							icon={rowIcon('ReactionIcon', 'ic_emoji_24px')}
							arrow
							disabled={!installed}
							onPress={() =>
								navigation.navigate(EMOJI_LIST_ROUTE, { id: pack.id })
							}
						/>
					</TableRowGroup>

					<TableRowGroup title="About" hasIcons>
						<TableRow
							label="Artwork"
							subLabel={pack.art}
							icon={rowIcon('PaintPaletteIcon', 'ic_theme_24px')}
						/>
						<TableRow
							label="Font"
							subLabel={`${decodeURIComponent(pack.url.split(/[/:]/).pop() ?? '')} · ${pack.size} MB`}
							icon={rowIcon('TextIcon', 'ic_text')}
						/>
						<TableRow
							label="From"
							subLabel={
								pack.source === 'emojifonts'
									? "PoomSmart's EmojiFonts on GitHub (MIT scripts), release 17.0.0"
									: pack.source === 'serenityos'
										? 'Comes with Themes, built from SerenityOS (no download)'
										: "zFont's library on GitHub (zFont/Host)"
							}
							icon={rowIcon('LinkIcon', 'ic_link')}
						/>
						{pack.open ? null : (
							<TableRow
								label="Not freely licensed"
								subLabel="The artwork belongs to its maker. It downloads to this phone for your own use."
								icon={rowIcon('CircleInformationIcon', 'ic_info_24px')}
							/>
						)}
					</TableRowGroup>

					{installed ? (
						<TableRowGroup hasIcons>
							<TableRow
								label="Remove pack"
								subLabel={
									inUse
										? `Discord's own emoji come back · frees ${pack.size} MB`
										: `Frees ${pack.size} MB`
								}
								icon={dangerIcon('TrashIcon', 'ic_trash')}
								variant="danger"
								onPress={confirmRemove}
							/>
						</TableRowGroup>
					) : null}
				</Stack>
			</ScrollView>
		</Page>
	)
}
