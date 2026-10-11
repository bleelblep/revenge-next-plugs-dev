/**
 * Discord's own list of standard emoji, by picker category: what an emoji pack is measured against
 * on its All emoji page. `modules/emojis/UnicodeEmojis.tsx` (checked on 350.2) has
 * `getCategories()` and `getByCategory(category)`; each emoji carries `surrogates` (the text) and
 * `uniqueName`. Skin-tone versions are left out: one entry per emoji, as the picker shows them.
 */

const PATH = 'modules/emojis/UnicodeEmojis.tsx'

export interface DiscordEmoji {
	name: string
	text: string
}

export interface DiscordEmojiGroup {
	category: string
	label: string
	emoji: DiscordEmoji[]
}

const LABELS: Record<string, string> = {
	people: 'People',
	nature: 'Nature',
	food: 'Food',
	activity: 'Activities',
	travel: 'Travel',
	objects: 'Objects',
	symbols: 'Symbols',
	flags: 'Flags',
}

let cached: DiscordEmojiGroup[] | undefined

/** Every standard emoji Discord has, in its picker's order; throws when the module can't be read. */
export function discordEmoji(): DiscordEmojiGroup[] {
	if (cached) return cached
	const finders = revenge.discord.utils.modules.finders as any
	const [exports] = finders.lookupModuleWithImportedPath(PATH) ?? []
	const api = [exports?.default, exports].find(
		candidate => typeof candidate?.getByCategory === 'function',
	)
	if (!api) throw new Error("Couldn't find Discord's emoji list")
	const categories: string[] = (
		api.getCategories?.() ?? Object.keys(LABELS)
	).filter((c: unknown) => typeof c === 'string')
	const seen = new Set<string>()
	const groups: DiscordEmojiGroup[] = []
	for (const category of categories) {
		const emoji: DiscordEmoji[] = []
		for (const item of api.getByCategory(category) ?? []) {
			const text = item?.surrogates
			if (typeof text !== 'string' || !text || seen.has(text)) continue
			seen.add(text)
			emoji.push({
				text,
				name: item.uniqueName ?? item.names?.[0] ?? item.name ?? text,
			})
		}
		if (emoji.length)
			groups.push({
				category,
				label:
					LABELS[category] ?? category[0].toUpperCase() + category.slice(1),
				emoji,
			})
	}
	if (!groups.length) throw new Error("Discord's emoji list was empty")
	cached = groups
	return groups
}
