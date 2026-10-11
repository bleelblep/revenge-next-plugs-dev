import { useBottomPadding } from '../safeArea'

/** Attribution, on its own route so the index stays an index. Details are in NOTICE.md. */
export default function License() {
	const { Page } = revenge.components
	const { ScrollView } = revenge.react.ReactNative
	const { Stack, TableRowGroup, TableRow } = revenge.discord.design.Design

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<TableRowGroup title="Licence">
						<TableRow
							label="Themes"
							subLabel="CC0-1.0, public domain, apart from the four parts below."
						/>
						<TableRow
							label="Theme formats and chat background"
							subLabel="Ported from classic Revenge's theme engine (Team Vendetta, pylixonly, Team Revenge), BSD-3-Clause."
						/>
						<TableRow
							label="Icon packs"
							subLabel="Adapted from Themes+ by nexpid (nexpid/RevengePlugins), CC-BY-4.0, with changes. Downloads nexpid's pack list from nexpid/ThemesPlus; nothing from it is bundled. Packs load from their authors and keep their own terms."
						/>
						<TableRow
							label="Emoji packs"
							subLabel="Drawing adapted from System Emoji by contrabags (contrabag/revenge-next-plugins), GPL-3.0, with changes. Packs download from PoomSmart's EmojiFonts (MIT scripts), zFont; the SerenityOS pack ships with Themes (SerenityOS developers, BSD 2-Clause); each pack's artwork keeps its maker's terms."
						/>
						<TableRow
							label="Grey colour table"
							subLabel="Copied from Themeify by Rosie (everestmcarthur/revenge-next-plugs-dev), GPL-3.0. Because of it, a shared build of Themes is offered under GPL-3.0."
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
