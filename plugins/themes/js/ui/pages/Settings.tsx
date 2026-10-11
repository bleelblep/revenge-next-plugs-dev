import { DEFAULTS } from '../../defaults'
import { getStorage } from '../../lib/state'
import { useChangelog } from '../../vendor/changelog'
import { ReloadRow } from '../actions'
import { rowIcon } from '../icon'
import {
	APPEARANCE_ROUTE,
	COMPATIBILITY_ROUTE,
	DEBUG_ROUTE,
	LICENSE_ROUTE,
} from '../routes'
import { useBottomPadding } from '../safeArea'

const TYPE_LABELS = { auto: 'Automatic', dark: 'Dark', light: 'Light' } as const

/**
 * Settings: one row per settings page, Debug kept apart. Opened from the Settings row in the
 * Theming section (under Icons) and from the plugin's own settings button.
 */
export default function Settings() {
	// The changelog icon at the top right, and "What's new" once after an update.
	useChangelog()
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = revenge.components
	const { ScrollView } = revenge.react.ReactNative
	const { Stack, TableRowGroup, TableRow } = revenge.discord.design.Design
	const { useNavigation } =
		revenge.externals.ReactNavigation.ReactNavigationNative
	const navigation = useNavigation() as { navigate: (route: string) => void }

	const s = { ...DEFAULTS, ...(getStorage()?.use() ?? {}) }
	const onOff = (on: boolean) => (on ? 'on' : 'off')

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<ReloadRow />

					<TableRowGroup hasIcons>
						<TableRow
							label="Appearance"
							subLabel={`${TYPE_LABELS[s.typeOverride] ?? 'Automatic'} light/dark · background ${onOff(s.showBackground)}`}
							icon={rowIcon('ThemeLightIcon', 'ic_theme_24px')}
							arrow
							onPress={() => navigation.navigate(APPEARANCE_ROUTE)}
						/>
						<TableRow
							label="Compatibility"
							subLabel={`Fix older themes ${onOff(s.translateLegacy)} · theme everything ${onOff(s.completePalette)}`}
							icon={rowIcon('WrenchIcon', 'ic_settings')}
							arrow
							onPress={() => navigation.navigate(COMPATIBILITY_ROUTE)}
						/>
						<TableRow
							label="Licence"
							subLabel="CC0, with BSD-3-Clause, CC-BY-4.0 and GPL-3.0 parts"
							icon={rowIcon('BookCheckIcon', 'InformationIcon', 'ic_info')}
							arrow
							onPress={() => navigation.navigate(LICENSE_ROUTE)}
						/>
					</TableRowGroup>

					<TableRowGroup title="Developer" hasIcons>
						<TableRow
							label="Debug"
							subLabel="What each part of the plugin did at startup"
							icon={rowIcon('BugIcon', 'ic_debug')}
							arrow
							onPress={() => navigation.navigate(DEBUG_ROUTE)}
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
