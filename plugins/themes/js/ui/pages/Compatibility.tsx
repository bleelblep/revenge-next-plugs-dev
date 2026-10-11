import { DEFAULTS } from '../../defaults'
import { getStorage } from '../../lib/state'
import { ReloadRow } from '../actions'
import { rowIcon } from '../icon'
import { useBottomPadding } from '../safeArea'
import { setColourOption } from './Appearance'

/** Compatibility: the layers that keep themes made for older Discord covering the whole app. */
export default function Compatibility() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = revenge.components
	const { ScrollView } = revenge.react.ReactNative
	const { Stack, TableRowGroup, TableSwitchRow } = revenge.discord.design.Design

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<ReloadRow />

					<TableRowGroup
						title="Older themes"
						description="Most themes were made for older Discord, whose colours had different names. Without these, most of the app keeps Discord's own colours."
						hasIcons
					>
						<TableSwitchRow
							label="Fix older themes"
							subLabel="Fills in colours older themes set under names Discord no longer uses"
							icon={rowIcon('WrenchIcon', 'ic_settings')}
							value={!!s.translateLegacy}
							onValueChange={(value: boolean) =>
								setColourOption({ translateLegacy: value }, s.selected)
							}
						/>
						<TableSwitchRow
							label="Theme everything"
							subLabel="A best guess at the colours a theme doesn't set, worked out from the ones it does, keeping text readable"
							icon={rowIcon('PaintPaletteIcon', 'ic_theme_24px')}
							value={!!s.completePalette}
							onValueChange={(value: boolean) =>
								setColourOption({ completePalette: value }, s.selected)
							}
						/>
					</TableRowGroup>

					<TableRowGroup
						title="Fixes"
						description="Places where a theme's colours don't line up the way Discord's own do."
						hasIcons
					>
						<TableSwitchRow
							label="Match the navigation bar"
							subLabel="The strip under the message box carries on what's above it: the fade, the chat's colour, or the chat background image"
							icon={rowIcon('ChatIcon', 'ic_message')}
							value={s.matchNavBar !== false}
							onValueChange={(value: boolean) =>
								setColourOption({ matchNavBar: value }, s.selected)
							}
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
