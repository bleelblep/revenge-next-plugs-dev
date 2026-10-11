/**
 * Whether this launch of Discord came up healthy with the theme on, judged by what actually
 * happened rather than by a clock.
 *
 * 0.1.38 and earlier armed a flag at launch and cleared it after a flat 15 seconds. That was wrong
 * both ways: closing or reloading Discord inside 15 s looked like a crash (the theme was skipped
 * next time for no reason), and Discord's own crash screen, which keeps the app alive, cleared the
 * flag after 15 s, so a theme that broke rendering came back on every launch.
 *
 * Every signal used here is plain React Native or a Flux event every Discord build has, so the
 * guard doesn't depend on any one version's modules:
 *
 * - **Failure:** a fatal error reaching `ErrorUtils`' global handler, or React reporting an error a
 *   boundary caught ("The above error occurred in the <X> component", which is how Discord's crash
 *   screen is reached). Either keeps the flag set, so the next launch starts on Discord's colours.
 * - **Healthy:** `CONNECTION_OPEN` (Discord is up and drawing), then a few quiet seconds. Offline,
 *   where that never comes, a longer stretch spent in the foreground counts instead.
 * - **Not a crash:** leaving the app (AppState goes to background) or a JS reload through
 *   `BundleUpdaterManager.reload` before the verdict. Neither says anything about the theme, so the
 *   flag is cleared on the way out.
 */

import { report } from './state'

const SETTLE_MS = 5_000
const OFFLINE_FOREGROUND_MS = 30_000
const REACT_CAUGHT = /above error occurred in the/i

export interface LaunchWatch {
	/** Called once with the verdict. `crashed` leaves the flag armed. */
	onSafe(): void
	onCrash(reason: string): void
	/** May return the storage write, which a reload waits for (up to 750 ms). */
	onLeft(): Promise<unknown> | void
}

/** Starts watching; returns a function that stops every hook it installed. */
export function watchLaunch(watch: LaunchWatch): () => void {
	const undo: Array<() => void> = []
	let settled = false
	let settleTimer: ReturnType<typeof setTimeout> | undefined
	let foregroundMs = 0
	let activeSince: number | undefined = Date.now()
	let offlineTimer: ReturnType<typeof setInterval> | undefined

	const finish = (verdict: () => void) => {
		if (settled) return
		settled = true
		verdict()
		stop()
	}
	const crash = (reason: string) => finish(() => watch.onCrash(reason))

	// Fatal JS errors.
	const ErrorUtils = (globalThis as any).ErrorUtils
	if (ErrorUtils?.getGlobalHandler && ErrorUtils?.setGlobalHandler) {
		const previous = ErrorUtils.getGlobalHandler()
		const handler = (error: unknown, isFatal?: boolean) => {
			if (isFatal) crash(`fatal error: ${(error as Error)?.message ?? error}`)
			return previous?.(error, isFatal)
		}
		ErrorUtils.setGlobalHandler(handler)
		undo.push(() => {
			if (ErrorUtils.getGlobalHandler() === handler)
				ErrorUtils.setGlobalHandler(previous)
		})
	}

	// Render errors a boundary caught: React logs each one through console.error.
	const originalError = console.error
	const watchedError = (...args: unknown[]) => {
		try {
			if (args.some(arg => typeof arg === 'string' && REACT_CAUGHT.test(arg)))
				crash('a screen failed to render')
		} catch {
			/* never let the watcher break logging */
		}
		return originalError.apply(console, args as any)
	}
	console.error = watchedError
	undo.push(() => {
		if (console.error === watchedError) console.error = originalError
	})

	// Healthy: connected, then quiet for a few seconds.
	try {
		const unsubscribe = revenge.discord.flux.onFluxEventDispatched(
			'CONNECTION_OPEN',
			(payload: any) => {
				if (!settleTimer)
					settleTimer = setTimeout(() => finish(watch.onSafe), SETTLE_MS)
				return payload
			},
		)
		undo.push(unsubscribe)
	} catch (error) {
		report(
			'launch guard',
			`no connection event: ${(error as Error)?.message ?? error}`,
		)
	}

	// Offline fallback: enough time actually spent in the foreground.
	offlineTimer = setInterval(() => {
		const now = Date.now()
		const total = foregroundMs + (activeSince ? now - activeSince : 0)
		if (total >= OFFLINE_FOREGROUND_MS) finish(watch.onSafe)
	}, 1_000)
	undo.push(() => clearInterval(offlineTimer))

	// Leaving the app before the verdict isn't a crash.
	try {
		const { AppState } = revenge.react.ReactNative
		const subscription = AppState.addEventListener(
			'change',
			(state: string) => {
				const now = Date.now()
				if (state === 'active') {
					activeSince ??= now
					return
				}
				if (activeSince) foregroundMs += now - activeSince
				activeSince = undefined
				if (state === 'background') finish(watch.onLeft)
			},
		)
		undo.push(() => subscription?.remove?.())
	} catch {
		/* no AppState: the other signals still decide */
	}

	// A reload before the verdict isn't a crash either. The write is quick; the reload waits for it.
	try {
		const manager = (revenge.discord.native as any)?.BundleUpdaterManager
		if (typeof manager?.reload === 'function') {
			const original = manager.reload
			const wrapped = function (this: unknown, ...args: unknown[]) {
				if (settled) return original.apply(this, args)
				settled = true
				let gone = false
				const go = () => {
					if (gone) return
					gone = true
					stop()
					original.apply(this, args)
				}
				Promise.resolve()
					.then(() => watch.onLeft())
					.finally(go)
				setTimeout(go, 750)
			}
			manager.reload = wrapped
			undo.push(() => {
				if (manager.reload === wrapped) manager.reload = original
			})
		}
	} catch {
		/* read-only native module: a reload just counts as unknown, which skips the theme once */
	}

	function stop() {
		if (settleTimer) clearTimeout(settleTimer)
		for (const fn of undo.splice(0)) {
			try {
				fn()
			} catch {
				/* already restored */
			}
		}
	}

	return () => {
		settled = true
		stop()
	}
}

/** Discord's build number, to tell a launch on a version the theme has never run on. */
export function discordBuild(): string {
	try {
		const constants = (
			revenge.discord.native as any
		)?.ClientInfoModule?.getConstants?.()
		return String(constants?.Build ?? constants?.Version ?? '')
	} catch {
		return ''
	}
}
