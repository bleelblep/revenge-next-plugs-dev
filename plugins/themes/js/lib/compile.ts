/**
 * A theme file -> the colours the engine writes, in one place for applying (`themes.ts`) and the
 * preview (`preview.ts`), so the two can't drift apart. Before 0.3.0 each kept its own copy of
 * these steps.
 *
 * Pure: everything it needs from Discord comes in through `env`, so tests can run it on saved
 * colour tables (`tests/`). Nothing here reads `revenge.*`.
 *
 * Steps, in order:
 * 1. read the file (`manifest.ts`), spec 2 or 3, dark or light;
 * 2. fill current colour names from old ones (`legacy.ts`), if Fix older themes is on;
 * 3. derive every other colour from the ones the theme set (`palette.ts`), if on;
 * 4. give the strip under the message box the chat's colour (`navBar.ts`), if on.
 */

import { translateLegacy } from './legacy'
import { parseManifest } from './manifest'
import { matchNavBar, navBarOptions } from './navBar'
import { completePalette } from './palette'
import type { ColorDefinition, ThemeManifest, ThemesStorage } from '../types'
import type { LegacyResult } from './legacy'
import type { PaletteResult } from './palette'

/** Discord's own colours, whatever theme is applied on top. */
export interface CompileEnv {
	/** Discord's raw colour by name. */
	raw: (name: string) => string | undefined
	/** Discord's entry for a semantic colour in one of its themes (`light`, `darker`…). */
	entry: (
		name: string,
		theme: string,
	) => { raw: string; opacity?: number } | undefined
	/** Every semantic colour name this Discord has. */
	names: string[]
	/** The user's own Discord theme is light; picks a spec-2 theme's light values on Auto. */
	prefersLight: boolean
}

export type CompileOptions = Pick<
	ThemesStorage,
	| 'typeOverride'
	| 'translateLegacy'
	| 'completePalette'
	| 'matchNavBar'
	| 'chatInputFade'
	| 'showBackground'
>

export interface CompileResult {
	definition: ColorDefinition
	/** Set when old names were translated. */
	legacy?: LegacyResult
	/** Set when the palette was completed. */
	palette?: PaletteResult
}

/** The Discord theme a theme is built on: its colours fill everything the theme doesn't set. */
export function referenceTheme(type: ColorDefinition['type']): string {
	return type === 'light' ? 'light' : 'darker'
}

export function compileTheme(
	manifest: ThemeManifest,
	env: CompileEnv,
	options: CompileOptions,
): CompileResult {
	const definition = parseManifest(
		manifest,
		options.typeOverride,
		env.prefersLight,
		env.raw,
	)
	const reference = referenceTheme(definition.type)
	const result: CompileResult = { definition }

	if (options.translateLegacy) {
		result.legacy = translateLegacy(
			definition.semantic,
			definition.raw,
			new Set(env.names),
			env.raw,
			name => env.entry(name, reference)?.opacity,
		)
	}

	if (options.completePalette) {
		const rows: Record<string, any> = {}
		for (const name of env.names)
			rows[name] = { [reference]: env.entry(name, reference) }
		result.palette = completePalette(
			definition.semantic,
			definition.raw,
			rows,
			env.raw,
			reference,
		)
	}

	if (options.matchNavBar !== false) {
		matchNavBar(
			definition.semantic,
			navBarOptions(options, definition.background),
		)
	}

	return result
}
