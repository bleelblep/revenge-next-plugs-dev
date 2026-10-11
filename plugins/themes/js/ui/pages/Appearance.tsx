import { DEFAULTS } from '../../defaults'
import { CUSTOM_BACKGROUND_ENABLED } from '../../lib/customBackground'
import { clearPreviewCache } from '../../lib/preview'
import { getStorage, patch, toast } from '../../lib/state'
import { reapplySelected } from '../../lib/themes'
import { markReloadNeeded, ReloadRow } from '../actions'
import { rowIcon } from '../icon'
import { useBottomPadding } from '../safeArea'
import { YourBackground } from '../yourBackground'
import type { ThemesStorage, ThemeType } from '../../types'

/** Re-applies the theme in use after an option that changes its colours. */
export function setColourOption(
	value: Partial<ThemesStorage>,
	selected: string,
) {
	patch(value)
	clearPreviewCache()
	if (!selected) return
	try {
		reapplySelected()
		markReloadNeeded()
	} catch (error) {
		toast(`Couldn't apply that theme: ${(error as Error)?.message ?? error}`)
	}
}

/** Appearance: which half of a theme to use, the chat background, and (when enabled) your own background. */
export default function Appearance() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = revenge.components
	const { ScrollView } = revenge.react.ReactNative
	const {
		Stack,
		TableRowGroup,
		TableSwitchRow,
		TableRadioGroup,
		TableRadioRow,
	} = revenge.discord.design.Design as any

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<ReloadRow />

					<TableRadioGroup
						key={`type-${s.typeOverride}`}
						title="Light or dark"
						description="Themes with both a light and a dark version use the one picked here."
						hasIcons
						defaultValue={s.typeOverride}
						onChange={(type: ThemeType) =>
							setColourOption({ typeOverride: type }, s.selected)
						}
					>
						<TableRadioRow
							label="Automatic"
							subLabel="Follow your Discord theme"
							icon={rowIcon('SettingsIcon', 'ic_settings')}
							value="auto"
						/>
						<TableRadioRow
							label="Dark"
							icon={rowIcon('ThemeDarkIcon', 'ic_theme_24px')}
							value="dark"
						/>
						<TableRadioRow
							label="Light"
							icon={rowIcon('ThemeLightIcon', 'ic_theme_24px')}
							value="light"
						/>
					</TableRadioGroup>

					<TableRowGroup title="Chat" hasIcons>
						<TableSwitchRow
							label="Chat background"
							subLabel="Show a theme's background image behind messages, when it has one"
							icon={rowIcon('ImageIcon', 'ic_image')}
							value={!!s.showBackground}
							onValueChange={(value: boolean) =>
								setColourOption({ showBackground: value }, s.selected)
							}
						/>
						<TableSwitchRow
							label="Fade behind the message box"
							subLabel="Discord's shaded band under the message box, in the theme's colours. Off makes it see-through, so the chat and its background show all the way down. Either way it stays the same while someone is typing."
							icon={rowIcon('ChatIcon', 'ic_message')}
							value={s.chatInputFade !== false}
							onValueChange={(value: boolean) =>
								setColourOption({ chatInputFade: value }, s.selected)
							}
						/>
					</TableRowGroup>

					{CUSTOM_BACKGROUND_ENABLED && (
						<YourBackground background={s.customBackground} />
					)}
				</Stack>
			</ScrollView>
		</Page>
	)
}
