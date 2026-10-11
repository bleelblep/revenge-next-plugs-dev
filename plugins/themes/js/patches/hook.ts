import { report } from '../lib/state'

type Install = (host: any, method: string) => () => void

/**
 * Finds a Discord module by its source path and hooks one function on it, reporting what
 * happened. The export can sit on the namespace or on `default` (porting rule 3), and the
 * callback checks before patching: the patcher builds a Proxy on `undefined` otherwise, which
 * crashes the app when the module was already loaded (api-contracts, finder callbacks).
 *
 * `pick` finds the host when it isn't the namespace or `default`, like a memo'd forwardRef's
 * inner object. It can also return `[host, method]` when the method name depends on the shape
 * (see `renderTarget`).
 *
 * Returns an unpatch that also cancels a wait that never fired.
 */
export function hookByPath(
	label: string,
	path: string,
	method: string,
	install: Install,
	pick?: (exports: any) => any,
): () => void {
	const requested = method
	let unpatch: (() => void) | undefined
	let unsubscribe: (() => void) | undefined

	try {
		unsubscribe =
			revenge.discord.utils.modules.finders.getModuleWithImportedPath(
				path,
				(exports: any, id: unknown) => {
					try {
						method = requested
						let host = pick
							? pick(exports)
							: typeof exports?.[method] === 'function'
								? exports
								: exports?.default
						if (Array.isArray(host)) [host, method] = host
						if (typeof host?.[method] !== 'function') {
							report(label, `module ${id} has no ${method}`)
							return
						}
						unpatch = install(host, method)
						report(label, `hooked (module ${id})`)
					} catch (error) {
						report(label, `failed: ${(error as Error)?.message ?? error}`)
					}
				},
			)
	} catch (error) {
		report(label, `lookup failed: ${(error as Error)?.message ?? error}`)
	}

	return () => {
		unsubscribe?.()
		unpatch?.()
	}
}

/**
 * Where a component's render function lives, for a `pick`, whichever shape Discord built it in.
 * Discord 350.2 alpha dropped `forwardRef` app-wide (React 19 passes refs as props), so a hook on
 * `render` finds nothing there:
 *
 * - `forwardRef(render)` / `memo(forwardRef(render))` (up to 349): `[forwardRef, 'render']`
 * - `memo(render)` (350.2): `[memo, 'type']`
 * - plain `render` (350.2): `[exports, key]`, the export itself
 */
export function renderTarget(
	exports: any,
	key = 'default',
): [any, string] | undefined {
	const value = exports?.[key]
	if (typeof value?.render === 'function') return [value, 'render']
	if (typeof value?.type?.render === 'function') return [value.type, 'render']
	if (typeof value?.type === 'function') return [value, 'type']
	if (typeof value === 'function') return [exports, key]
	return undefined
}

/** Hooks a method on an object already in hand, reporting the outcome. */
export function hookObject(
	label: string,
	host: any,
	method: string,
	install: Install,
): () => void {
	try {
		if (typeof host?.[method] !== 'function') {
			report(label, `no ${method} to hook`)
			return () => {}
		}
		const unpatch = install(host, method)
		report(label, 'hooked')
		return unpatch
	} catch (error) {
		report(label, `failed: ${(error as Error)?.message ?? error}`)
		return () => {}
	}
}
