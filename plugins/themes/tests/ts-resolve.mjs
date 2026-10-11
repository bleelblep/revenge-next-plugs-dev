// Lets Node load the plugin's extensionless TypeScript imports in tests:
//   node --import ./plugins/themes/tests/ts-resolve.mjs --test plugins/themes/tests/*.test.mjs
import { registerHooks } from 'node:module'

registerHooks({
	resolve(specifier, context, next) {
		try {
			return next(specifier, context)
		} catch (error) {
			if (!/^\.\.?\//.test(specifier) || /\.(m?[jt]s|json)$/.test(specifier))
				throw error
			return next(`${specifier}.ts`, context)
		}
	},
})
