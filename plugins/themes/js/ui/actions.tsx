/**
 * Actions shared by the Themes pages: updating, copying, removing, reloading. Everything reads
 * `revenge.*` when called, never at module scope (porting rule 1).
 */

import { installFont, refetchFont, removeFont, selectFont } from '../lib/fonts'
import { installIconPack, removeIconPack, selectIconPack } from '../lib/icons'
import { toast } from '../lib/state'
import {
	installTheme,
	refetchTheme,
	removeTheme,
	selectTheme,
} from '../lib/themes'
import { rowIcon } from './icon'
import type { IconPack, InstalledFont, InstalledTheme } from '../types'

const REMOVE_ALERT = 'ThemesRemove'
const RELOAD_ALERT = 'ThemesReloadRequired'
const INSTALL_ALERT = 'ThemesInstall'

export const DISCORD_THEME_NAMES: Record<string, string> = {
	light: 'Light',
	dark: 'Ash',
	darker: 'Dark',
	midnight: 'Onyx',
}

/** First of `names` that is an icon asset, for components that take an asset id. */
export function asset(...names: string[]): number | undefined {
	for (const name of names) {
		try {
			const id = revenge.assets.getAssetIdByName(name)
			if (id) return id
		} catch {
			/* next name */
		}
	}
	return undefined
}

export function authorsOf(theme: InstalledTheme): string {
	const names =
		theme.manifest.authors?.map(author => author?.name).filter(Boolean) ?? []
	return names.length ? `by ${names.join(', ')}` : 'Unknown author'
}

function alerts() {
	return revenge.discord.actions.AlertActionCreators
}

function clipboard(): any {
	try {
		return (
			(revenge as any).externals?.ReactNativeClipboard?.Clipboard ??
			(revenge.react.ReactNative as any)?.Clipboard
		)
	} catch {
		return undefined
	}
}

export function copyLink(theme: InstalledTheme) {
	const board = clipboard()
	if (typeof board?.setString !== 'function')
		return toast("Couldn't reach the clipboard")
	board.setString(theme.id)
	toast('Link copied')
}

/**
 * Set once a theme or a colour option changes this session. Every Themes screen shows a Reload row
 * while it's set, instead of a prompt per change: colours Discord already worked out stay until it
 * redraws (`lib/engine.ts`). Screens re-render on storage writes, which every change makes.
 */
let reloadNeeded = false

export function markReloadNeeded() {
	reloadNeeded = true
}

export function isReloadNeeded(): boolean {
	return reloadNeeded
}

export function reloadDiscord() {
	try {
		revenge.discord.native.BundleUpdaterManager.reload()
	} catch {
		toast('Close and reopen Discord to finish')
	}
}

export function downloadAgain(theme: InstalledTheme, selected: boolean) {
	refetchTheme(theme.id)
		.then(manifest => {
			toast(`Updated ${manifest.name}`)
			if (selected) markReloadNeeded()
		})
		.catch((error: Error) => toast(error?.message ?? String(error)))
}

/** Destructive, so confirmed (plugin-design-language §6). `onRemoved` runs after it's gone. */
export function confirmRemove(
	theme: InstalledTheme,
	selected: boolean,
	onRemoved?: () => void,
) {
	const { AlertModal, AlertActionButton } = revenge.discord.design.Design as any
	alerts().openAlert(
		REMOVE_ALERT,
		<AlertModal
			title={`Remove ${theme.manifest.name}?`}
			content={
				selected
					? "It's the theme in use, so Discord's own colours come back."
					: 'You can install it again from its link.'
			}
			actions={
				<>
					<AlertActionButton
						text="Remove"
						variant="destructive"
						onPress={() => {
							alerts().dismissAlert(REMOVE_ALERT)
							removeTheme(theme.id)
							toast(`Removed ${theme.manifest.name}`)
							if (selected) markReloadNeeded()
							onRemoved?.()
						}}
					/>
					<AlertActionButton
						text="Cancel"
						variant="secondary"
						onPress={() => alerts().dismissAlert(REMOVE_ALERT)}
					/>
				</>
			}
		/>,
	)
}

/** The Reload row every Themes screen shows at the top once something needs it. */
export function ReloadRow({ detail }: { detail?: string }) {
	const { TableRowGroup, TableRow } = revenge.discord.design.Design
	if (!isReloadNeeded()) return null
	return (
		<TableRowGroup hasIcons>
			<TableRow
				label="Reload Discord"
				subLabel={
					detail ?? 'The new colours are on. A reload shows them everywhere.'
				}
				icon={rowIcon('RefreshIcon', 'ic_refresh')}
				arrow
				onPress={reloadDiscord}
			/>
		</TableRowGroup>
	)
}

/** Revenge's own Reload Required alert (revenge-bundle-next `PluginsRequireReloadAlert`), word for word. */
function openReloadRequired() {
	const { AlertModal, AlertActionButton, Text } = revenge.discord.design
		.Design as any
	const alerts = revenge.discord.actions.AlertActionCreators
	alerts.openAlert(
		RELOAD_ALERT,
		<AlertModal
			title="Reload Required"
			content={
				<Text variant="text-md/medium" color="text-default">
					The following plugins require a reload to apply changes:
					{'\n'}
					<Text variant="text-md/bold" color="text-default">
						Themes
					</Text>
				</Text>
			}
			actions={
				<>
					<AlertActionButton
						variant="destructive"
						text="Reload"
						onPress={reloadDiscord}
					/>
					<AlertActionButton
						variant="secondary"
						text="Not now"
						onPress={() => alerts.dismissAlert(RELOAD_ALERT)}
					/>
				</>
			}
		/>,
	)
}

/**
 * After switching theme: a Reload Required alert worded like Revenge's own. Not
 * `plugin.requireReload()`: on the phone that raises Revenge's alert as well, and two alerts
 * stacked (seen 2026-09-28).
 */
export function askForReload() {
	markReloadNeeded()
	openReloadRequired()
}

/** Back to Discord's own colours, from Your themes or a theme's page. */
export function useDiscordColours() {
	try {
		selectTheme('')
		askForReload()
	} catch (error) {
		toast(`Couldn't switch back: ${(error as Error)?.message ?? error}`)
	}
}

interface InstallProps {
	title: string
	content: string
	placeholder: string
	install: (url: string) => Promise<{ name: string }>
}

const INSTALL_THEME: InstallProps = {
	title: 'Install a theme',
	content:
		"Paste the link to a theme's .json file. Revenge and Vendetta themes both work.",
	placeholder: 'https://…/theme.json',
	install: installTheme,
}

const INSTALL_FONT: InstallProps = {
	title: 'Install a font',
	content:
		"Paste the link to a Revenge font's .json file, or straight to a .ttf or .otf file.",
	placeholder: 'https://…/font.json',
	install: installFont,
}

/**
 * Install a theme or a font, from the ＋ on its list: a Discord alert with the link field, which
 * stays open while it downloads and shows any error under the field.
 */
function InstallAlert({
	title,
	content,
	placeholder,
	install: installFrom,
}: InstallProps) {
	const React = revenge.react.React
	const { AlertModal, AlertActionButton, Button, Stack, TextInput } = revenge
		.discord.design.Design as any
	const alerts = revenge.discord.actions.AlertActionCreators
	const [value, setValue] = React.useState('')
	const [error, setError] = React.useState('')
	const [busy, setBusy] = React.useState(false)

	const close = () => alerts.dismissAlert(INSTALL_ALERT)
	const install = () => {
		if (busy || !value.trim()) return
		setBusy(true)
		installFrom(value)
			.then(manifest => {
				close()
				toast(`Installed ${manifest.name}`)
			})
			.catch((e: Error) => setError(e?.message ?? String(e)))
			.finally(() => setBusy(false))
	}
	const paste = () => {
		const board = clipboard()
		if (typeof board?.getString !== 'function')
			return toast("Couldn't reach the clipboard")
		Promise.resolve(board.getString())
			.then((text: string) => {
				setValue(String(text ?? '').trim())
				setError('')
			})
			.catch(() => toast("Couldn't reach the clipboard"))
	}

	return (
		<AlertModal
			title={title}
			content={content}
			extraContent={
				<Stack spacing={8}>
					<TextInput
						autoFocus
						isClearable
						value={value}
						placeholder={placeholder}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="go"
						onChange={(text: string) => {
							setValue(text)
							if (error) setError('')
						}}
						onSubmitEditing={install}
						state={error ? 'error' : undefined}
						errorMessage={error || undefined}
					/>
					<Button
						size="sm"
						variant="tertiary"
						text="Paste from clipboard"
						onPress={paste}
						disabled={busy}
					/>
				</Stack>
			}
			actions={
				<>
					{/* A plain Button: an AlertActionButton would close the alert before the download ends. */}
					<Button
						text="Install"
						variant="primary"
						loading={busy}
						disabled={busy || !value.trim()}
						onPress={install}
					/>
					<AlertActionButton
						text="Cancel"
						variant="secondary"
						disabled={busy}
						onPress={close}
					/>
				</>
			}
		/>
	)
}

export function openInstall() {
	revenge.discord.actions.AlertActionCreators.openAlert(
		INSTALL_ALERT,
		<InstallAlert {...INSTALL_THEME} />,
	)
}

const INSTALL_ICONS: InstallProps = {
	title: 'Add an icon pack',
	content:
		"Paste the link to a Themes+ icon pack's .json file, or to a list of packs.",
	placeholder: 'https://…/iconpack.json',
	install: installIconPack,
}

export function openInstallIconPack() {
	revenge.discord.actions.AlertActionCreators.openAlert(
		INSTALL_ALERT,
		<InstallAlert {...INSTALL_ICONS} />,
	)
}

/** Swaps the icons now and asks for the reload that redraws the ones already on screen. */
export function useIconPack(
	id: string,
	busy?: (text: string) => void,
): Promise<void> {
	busy?.(id ? 'Getting the icon list…' : '')
	return selectIconPack(id)
		.then(() => askForReload())
		.catch((error: Error) =>
			toast(`Couldn't switch icons: ${error?.message ?? error}`),
		)
		.finally(() => busy?.(''))
}

export function confirmRemoveIconPack(
	pack: IconPack,
	selected: boolean,
	onRemoved?: () => void,
) {
	const { AlertModal, AlertActionButton } = revenge.discord.design.Design as any
	alerts().openAlert(
		REMOVE_ALERT,
		<AlertModal
			title={`Remove ${pack.name}?`}
			content={
				selected
					? "It's the pack in use, so Discord's own icons come back."
					: 'You can add it again from its link.'
			}
			actions={
				<>
					<AlertActionButton
						text="Remove"
						variant="destructive"
						onPress={() => {
							alerts().dismissAlert(REMOVE_ALERT)
							removeIconPack(pack.id)
							toast(`Removed ${pack.name}`)
							if (selected) askForReload()
							onRemoved?.()
						}}
					/>
					<AlertActionButton
						text="Cancel"
						variant="secondary"
						onPress={() => alerts().dismissAlert(REMOVE_ALERT)}
					/>
				</>
			}
		/>,
	)
}

export function openInstallFont() {
	revenge.discord.actions.AlertActionCreators.openAlert(
		INSTALL_ALERT,
		<InstallAlert {...INSTALL_FONT} />,
	)
}

// ---- fonts ----------------------------------------------------------------------------------------

/**
 * Downloads the font's files and points Revenge's fonts.json at it, then asks for the reload.
 * `''` is Discord's own fonts. `progress` shows the download on the font's page.
 */
export function useFont(
	id: string,
	progress?: (text: string) => void,
): Promise<void> {
	return selectFont(id, (done, total) => {
		if (total) progress?.(`Downloading ${done} of ${total}…`)
	})
		.then(() => askForReload())
		.catch((error: Error) =>
			toast(`Couldn't switch font: ${error?.message ?? error}`),
		)
		.finally(() => progress?.(''))
}

export function downloadFontAgain(font: InstalledFont, selected: boolean) {
	refetchFont(font.id)
		.then(manifest => {
			toast(`Updated ${manifest.name}`)
			if (selected) askForReload()
		})
		.catch((error: Error) => toast(error?.message ?? String(error)))
}

export function copyFontLink(font: InstalledFont) {
	const board = clipboard()
	if (typeof board?.setString !== 'function')
		return toast("Couldn't reach the clipboard")
	board.setString(font.id)
	toast('Link copied')
}

export function confirmRemoveFont(
	font: InstalledFont,
	selected: boolean,
	onRemoved?: () => void,
) {
	const { AlertModal, AlertActionButton } = revenge.discord.design.Design as any
	alerts().openAlert(
		REMOVE_ALERT,
		<AlertModal
			title={`Remove ${font.manifest.name}?`}
			content={
				selected
					? "It's the font in use, so Discord's own fonts come back."
					: 'You can install it again from its link.'
			}
			actions={
				<>
					<AlertActionButton
						text="Remove"
						variant="destructive"
						onPress={() => {
							alerts().dismissAlert(REMOVE_ALERT)
							removeFont(font.id)
								.then(() => {
									toast(`Removed ${font.manifest.name}`)
									if (selected) askForReload()
									onRemoved?.()
								})
								.catch((error: Error) => toast(error?.message ?? String(error)))
						}}
					/>
					<AlertActionButton
						text="Cancel"
						variant="secondary"
						onPress={() => alerts().dismissAlert(REMOVE_ALERT)}
					/>
				</>
			}
		/>,
	)
}
