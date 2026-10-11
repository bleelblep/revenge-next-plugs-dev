import { DEFAULTS } from '../../defaults'
import { activeType, discordTheme } from '../../lib/engine'
import { health } from '../../lib/health'
import { discordBuild } from '../../lib/launchGuard'
import { getStorage, hookReport, patch } from '../../lib/state'
import { buildChecked } from '../../lib/themes'
import { rowIcon } from '../icon'
import { useBottomPadding } from '../safeArea'
import type { Part } from '../../lib/health'

/** This Discord's parts Themes needs, what each hook actually did, the live theme names, and the logging switch. */
export default function Debug() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = revenge.components
	const { ScrollView } = revenge.react.ReactNative
	const { Stack, TableRowGroup, TableRow, TableSwitchRow } =
		revenge.discord.design.Design

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }

	const storeTheme = discordTheme()
	const React = revenge.react.React
	const [parts, setParts] = React.useState<Part[]>([])
	React.useEffect(() => {
		health().then(setParts, () => {})
	}, [])
	const build = discordBuild()
	const STATUS: Record<Part['status'], string> = {
		ok: 'Works',
		missing: "Doesn't work on this version",
		waiting: 'Not loaded yet',
	}

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<TableRowGroup title="Now" hasIcons>
						<TableRow
							label="Discord's theme name"
							subLabel={storeTheme}
							icon={rowIcon('PaintPaletteIcon', 'ic_theme_24px')}
						/>
						<TableRow
							label="Custom colours"
							subLabel={activeType() ? `on (${activeType()})` : 'off'}
							icon={rowIcon('PaintPaletteIcon', 'ic_theme_24px')}
						/>
						<TableRow
							label="Launch guard"
							subLabel={
								s.applyingAtLaunch
									? 'armed (clears once Discord is up without errors)'
									: `clear${s.safeBuild ? ` · safe on Discord ${s.safeBuild}` : ''}${s.lastCrash ? ` · last failure: ${s.lastCrash}` : ''}`
							}
							icon={rowIcon('PaintPaletteIcon', 'ic_theme_24px')}
						/>
					</TableRowGroup>

					<TableRowGroup title="This Discord" hasIcons>
						<TableRow
							label={`Discord ${build || '(version unknown)'}`}
							subLabel={
								buildChecked(build)
									? 'Checked: a theme has come up on it without problems'
									: 'Not checked yet: the theme goes on after launch until it has come up once without problems'
							}
							icon={rowIcon('CircleInformationIcon', 'ic_info_24px')}
						/>
						{(s.checkedBuilds ?? []).length ? (
							<TableRow
								label="Checked versions"
								subLabel={(s.checkedBuilds ?? []).join(', ')}
								icon={rowIcon('CircleCheckIcon', 'ic_check_24px')}
							/>
						) : null}
					</TableRowGroup>

					<TableRowGroup title="What Themes needs from Discord" hasIcons>
						{parts.map(part => (
							<TableRow
								key={part.feature}
								label={part.feature}
								subLabel={`${STATUS[part.status]} · ${part.detail}`}
								icon={
									part.status === 'missing'
										? rowIcon(
												'WarningIcon',
												'CircleWarningIcon',
												'ic_warning_24px',
											)
										: part.status === 'waiting'
											? rowIcon('ClockIcon', 'ic_clock')
											: rowIcon('CircleCheckIcon', 'ic_check_24px')
								}
							/>
						))}
					</TableRowGroup>

					<TableRowGroup title="Hooks" hasIcons>
						{hookReport().map(([name, outcome]) => (
							<TableRow
								key={name}
								label={name}
								subLabel={outcome}
								icon={rowIcon('BugIcon', 'ic_debug')}
							/>
						))}
					</TableRowGroup>

					<TableRowGroup hasIcons>
						<TableSwitchRow
							label="Debug logging"
							subLabel="Extra lines in the log under [Themes]"
							icon={rowIcon('BugIcon', 'ic_debug')}
							value={!!s.debugLogging}
							onValueChange={(value: boolean) => patch({ debugLogging: value })}
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
