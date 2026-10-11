// Theme colours by token name, resolved through the theme in use. The same approach as Hide Servers
// Drawer's ui/theme.ts: `revenge.discord.common.tokens.Tokens` holds RawColor (name -> hex) and
// SemanticColor (name -> per-theme raw name), confirmed live on 348.1.

function tokenTables(): any {
	try {
		return (revenge.discord.common as any).tokens?.Tokens
	} catch {
		return undefined
	}
}

/** The theme actually in use ('dark', 'light', 'midnight', 'darker', ...). */
function currentTheme(): string {
	try {
		const store = (revenge.discord.flux.Stores as any).ThemeStore
		const theme = store?.theme ?? store?.getTheme?.()
		return typeof theme === 'string' ? theme : 'dark'
	} catch {
		return 'dark'
	}
}

/** A colour by token name; anything unresolvable falls back, costing one wrong shade at worst. */
export function token(name: string, fallback: string): string {
	const tables = tokenTables()
	if (!tables) return fallback
	try {
		const raw = tables.RawColor?.[name]
		if (typeof raw === 'string') return raw
		const semantic = tables.SemanticColor?.[name]
		if (semantic) {
			const entry = semantic[currentTheme()] ?? semantic.darker ?? semantic.dark
			const resolved = entry?.raw ? tables.RawColor?.[entry.raw] : undefined
			if (typeof resolved === 'string') return resolved
		}
	} catch {
		/* fall through to the fallback */
	}
	return fallback
}
