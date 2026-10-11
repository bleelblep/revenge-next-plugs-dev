/**
 * Which parts of Discord Themes relies on are there on this Discord version (plan step B1).
 *
 * Each feature already fails on its own: a patch whose module moved reports it and does nothing,
 * and the rest of Themes carries on (`apply()` in index.ts, `hookByPath` in patches/hook.ts). This
 * gathers those outcomes in one list, plus a few direct checks, so the Debug page and the Themes
 * page can say what doesn't work on this Discord, without searching for any module again.
 *
 * Keep in step with MODULE_PATHS / NATIVE_CLASSES in docs/debugging/scripts/discord_diff.py, which
 * checks the same things in a new Discord APK before it reaches the phone.
 */

import { emojiStateOrThrow } from './emoji'
import { hookReport } from './state'

export type PartStatus = 'ok' | 'missing' | 'waiting'

export interface Part {
	/** What the user would notice, e.g. "Chat background". */
	feature: string
	status: PartStatus
	/** What was found or what failed, for the Debug page. */
	detail: string
}

function tokens(): any {
	return (revenge.discord.common as any).tokens?.Tokens
}

/** A patch's outcome from its report line. No line yet = the screen it needs hasn't loaded. */
function fromReport(feature: string, label: string): Part {
	const outcome = new Map(hookReport()).get(label)
	if (!outcome)
		return {
			feature,
			status: 'waiting',
			detail: 'not loaded yet (opens with the screen it changes)',
		}
	return {
		feature,
		status: outcome.startsWith('hooked') ? 'ok' : 'missing',
		detail: outcome,
	}
}

function direct(
	feature: string,
	check: () => boolean,
	found: string,
	lost: string,
): Part {
	let ok = false
	try {
		ok = check()
	} catch {
		ok = false
	}
	return { feature, status: ok ? 'ok' : 'missing', detail: ok ? found : lost }
}

/** The JS side: instant, from what is already known. */
export function jsHealth(): Part[] {
	return [
		direct(
			'Theme colours',
			() =>
				typeof tokens()?.SemanticColor === 'object' &&
				typeof tokens()?.RawColor === 'object',
			'colour tables found',
			"Discord's colour tables weren't found",
		),
		direct(
			'Switching themes live',
			() => !!(revenge.discord.flux.Stores as any).ThemeStore,
			'ThemeStore found',
			'no ThemeStore: a theme change shows after a reload',
		),
		fromReport('Chat background', 'chat background'),
		fromReport('Fade behind the message box', 'message box fade'),
		fromReport('Message box while typing', 'message box typing fill'),
		fromReport('Icon sizes in icon packs', 'icon fit (BaseIconImage)'),
		direct(
			'Icon packs',
			() => typeof (revenge as any).assets?.addAssetOverride === 'function',
			'asset overrides available',
			"Revenge's addAssetOverride is missing",
		),
	]
}

/** The native side (emoji packs), from Themes' Kotlin half. */
export async function nativeHealth(): Promise<Part[]> {
	try {
		const state = await emojiStateOrThrow()
		if (!state.supported)
			return [
				{
					feature: 'Emoji packs',
					status: 'missing',
					detail: 'needs Android 10 or newer',
				},
			]
		const part = (feature: string, ok: boolean, what: string): Part => ({
			feature,
			status: ok ? 'ok' : 'missing',
			detail: ok
				? `${what} hooked`
				: `${what} not hooked${state.errors ? ` (${state.errors} errors)` : ''}`,
		})
		return [
			part(
				'Emoji in messages and reactions',
				state.messagesActive,
				'message and reaction drawing',
			),
			part('Emoji in the picker', state.pickerActive, 'picker drawing'),
			part('Emoji in text', state.textActive, 'font fallback'),
		]
	} catch (error) {
		return [
			{
				feature: 'Emoji packs',
				status: 'missing',
				detail: `native half not answering: ${(error as Error)?.message ?? error}`,
			},
		]
	}
}

export async function health(): Promise<Part[]> {
	return [...jsHealth(), ...(await nativeHealth())]
}

/** For the Themes page: true when something Themes needs is missing on this Discord. */
export function hasMissing(parts: Part[]): boolean {
	return parts.some(part => part.status === 'missing')
}
