import type { ChangelogEntry } from './vendor/changelog'

/** Newest first. Every version users got gets an entry; see shared/changelog.tsx. */
export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '0.3.6',
		date: '2026-10-12',
		title: 'Font previews on the font page',
		changes: [
			"The fonts list stays plain. A font's page now previews it live even when Discord's built-in preview part can't be reached, instead of only after putting the font in use.",
		],
	},
	{
		version: '0.3.5',
		date: '2026-10-12',
		title: 'Font previews, absurd emoji',
		changes: [
			'Your fonts now show a sample line live in the font itself, right in the list, before you use it.',
			"Emoji a pack doesn't have always show as Discord's own now; the choice is gone.",
			"A new Absurd emoji size, twice Discord's, joins the size choices.",
		],
	},
	{
		version: '0.3.4',
		date: '2026-10-11',
		title: 'All emoji, centred',
		changes: [
			'The All emoji grid is centred on the screen, and each emoji in its square, instead of sitting off to one side.',
		],
	},
	{
		version: '0.3.3',
		date: '2026-10-11',
		title: 'See every emoji in a pack',
		changes: [
			"An emoji pack's page has a new All emoji row: every emoji Discord has, in the pack's own art, with Themed and Not themed tabs so you can see what it leaves out.",
			'Tap an emoji there for its name. Telling what a pack is missing needs Android 12 or newer.',
		],
	},
	{
		version: '0.3.2',
		date: '2026-10-11',
		title: 'SerenityOS on every phone',
		changes: [
			'The SerenityOS emoji pack now comes with Themes: no download, works on Android 10 and up, and shows a preview.',
		],
	},
	{
		version: '0.3.1',
		date: '2026-10-11',
		title: 'SerenityOS emoji',
		changes: [
			"New emoji pack under Other: SerenityOS's pixel-art emoji (0.7 MB). Needs Android 13 or newer.",
		],
	},
	{
		version: '0.3.0',
		date: '2026-10-09',
		title: 'Older themes look right',
		changes: [
			'Older themes colour more of Discord: info boxes, message highlights, buttons, input boxes and the buttons on profile banners now follow them.',
			'Colours a theme sets for parts phones never had (scrollbars, hover effects) no longer count as missing, and see-through parts stay see-through.',
			"A theme's page lists the old colours this Discord has nowhere to put.",
			"Your themes says when something Themes needs is missing on your Discord version, and when a version hasn't been checked yet.",
			'Turning a theme off keeps colours another plugin changed in the meantime.',
			'The preview and the applied theme now always match.',
		],
	},
	{
		version: '0.2.10',
		date: '2026-10-09',
		title: 'Theming section always shows',
		changes: [
			'The Theming section shows up straight after an update or after switching Themes on, instead of only after restarting Discord.',
			'Licence page corrected: the icon pack list comes from nexpid/ThemesPlus, which has no licence, and nothing from it is bundled.',
		],
	},
	{
		version: '0.2.9',
		date: '2026-10-09',
		title: 'Vector fix',
		changes: [
			'Works on JingMatrix Vector and LSPosed with API obfuscation, where it failed to load.',
		],
	},
	{
		version: '0.2.8',
		date: '2026-10-09',
		title: 'Works on Discord 350.2',
		changes: [
			'Chat backgrounds, Fade behind the message box and icon fitting work again on Discord 350.2 alpha, which rebuilt those parts of the app. Older Discord versions still work.',
		],
	},
	{
		version: '0.2.7',
		date: '2026-10-08',
		title: 'Your background hidden',
		changes: [
			"Appearance > Your background is gone for now. A picture you had set is no longer shown; themes' own chat backgrounds still work.",
		],
	},
	{
		version: '0.2.6',
		date: '2026-10-08',
		title: 'Credits',
		changes: [
			'contrabag (System Emoji) and Rosie (Themeify) are now listed as authors.',
		],
	},
	{
		version: '0.2.5',
		date: '2026-10-07',
		title: 'Missing emoji',
		changes: [
			"An emoji the pack doesn't have now shows as Discord's own, instead of your phone's or in pieces.",
			"Emoji > Emoji a pack doesn't have: choose Discord's or your phone's.",
			'Needs Android 12 or newer to tell; older phones draw everything with the pack as before.',
		],
	},
	{
		version: '0.2.4',
		date: '2026-10-06',
		title: 'Slider cards',
		changes: [
			'Sliders now sit on the same card background as the settings rows around them, with the current value in the row title.',
		],
	},
	{
		version: '0.2.3',
		date: '2026-10-06',
		title: 'Tidier emoji list',
		changes: [
			'Facebook, WhatsApp, Twitter and JoyPixels are hidden at first; the eye at the top right shows them.',
			'HarmonyOS moves to Other.',
			'Windows 11 has a preview now.',
		],
	},
	{
		version: '0.2.2',
		date: '2026-10-06',
		title: 'One pack per look',
		changes: [
			'Emoji packs are trimmed to one per distinct look: repeats of the same artwork, older iOS copies and novelty sets are gone.',
			'Each maker lists its current look first, then its classic ones, with names that follow one pattern.',
		],
	},
	{
		version: '0.2.1',
		date: '2026-10-06',
		title: 'More emoji packs, with previews',
		changes: [
			"zFont's emoji library joins EmojiFonts: dozens more packs, from old iOS and Samsung sets to Fluent 3D, HarmonyOS, Facebook and JoyPixels.",
			'Packs are sorted by maker, then by year.',
			'Every pack shows a preview of its emoji before you download it.',
			'The eye at the top right hides makers or packs you never want to see, like on the Icons page.',
		],
	},
	{
		version: '0.2.0',
		date: '2026-10-06',
		title: 'Emoji packs',
		changes: [
			"A new Emoji page under Theming: swap Discord's emoji for Twemoji, Noto, Blobmoji, OpenMoji, Apple, Samsung or WhatsApp.",
			"Packs download on demand from PoomSmart's EmojiFonts and change emoji in messages, reactions and the emoji picker at once, and in the message box and names after a reload.",
			'Pick the size of emoji in messages, from smaller to largest.',
			'Needs Android 10 or newer.',
		],
	},
	{
		version: '0.1.42',
		date: '2026-10-04',
		title: 'Your own chat background',
		changes: [
			'Pick a picture from your gallery, or paste a link, to show behind the chat with any theme.',
			'Dim and blur sliders, with a preview. Find it under Appearance.',
		],
	},
	{
		version: '0.1.41',
		date: '2026-10-03',
		title: 'Changelog',
		changes: [
			'The clock icon at the top right of the settings shows what changed in every version.',
			'After an update, a short "What\'s new" dialog lists the changes the next time you open the settings.',
		],
	},
	{
		version: '0.1.30',
		date: '2026-09-29',
		title: 'Quick Toggles',
		changes: ['Theme, font and icon pack can be switched from Quick Toggles.'],
	},
	{
		version: '0.1.0',
		date: '2026-09-28',
		title: 'First release',
		changes: ['Colour themes for Discord, from classic Revenge.'],
	},
]
