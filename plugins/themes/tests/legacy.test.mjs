import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compileTheme } from '../js/lib/compile.ts'
import { LEGACY_SEMANTIC } from '../js/lib/legacy.ts'
import { parseManifest } from '../js/lib/manifest.ts'
import { discord, envFor, fixture, fixtures, OPTIONS } from './helpers.mjs'

const d348 = discord('348.5')
const d350 = discord('350.2')
const env = envFor(d348)
const translateOnly = { ...OPTIONS, completePalette: false, matchNavBar: false }

test('a colour the theme sets itself is never overwritten', () => {
	for (const { name, manifest } of fixtures()) {
		const parsed = parseManifest(manifest, 'auto', false, env.raw)
		const { definition } = compileTheme(manifest, env, translateOnly)
		for (const [key, own] of Object.entries(parsed.semantic)) {
			assert.deepEqual(definition.semantic[key], own, `${name}: ${key}`)
		}
	}
})

test('old names fill the current names that took over their job', () => {
	const frappe = fixture('catppuccin-frappe-mauve')
	const { definition } = compileTheme(frappe, env, translateOnly)
	const chat = definition.semantic.BACKGROUND_PRIMARY
	assert.ok(chat, 'Frappé sets BACKGROUND_PRIMARY')
	assert.deepEqual(definition.semantic.CHANNEL_BACKGROUND_DEFAULT, chat)
	assert.deepEqual(definition.semantic.BACKGROUND_BASE_LOWER, chat)
	assert.deepEqual(
		definition.semantic.TEXT_DEFAULT,
		definition.semantic.TEXT_NORMAL,
	)
})

test('translation only fills names this Discord has', () => {
	const known = new Set(env.names)
	for (const { name, manifest } of fixtures()) {
		const parsed = parseManifest(manifest, 'auto', false, env.raw)
		const { definition } = compileTheme(manifest, env, translateOnly)
		for (const key of Object.keys(definition.semantic)) {
			assert.ok(
				known.has(key) || key in parsed.semantic,
				`${name}: added unknown ${key}`,
			)
		}
	}
})

test('Fix older themes off adds nothing', () => {
	for (const { name, manifest } of fixtures()) {
		const parsed = parseManifest(manifest, 'auto', false, env.raw)
		const off = compileTheme(manifest, env, {
			...translateOnly,
			translateLegacy: false,
		})
		assert.deepEqual(
			Object.keys(off.definition.semantic).sort(),
			Object.keys(parsed.semantic).sort(),
			name,
		)
		assert.equal(off.legacy, undefined)
	}
})

test('the grey ramp never flips a step between light and dark', () => {
	// Purple Galaxy sets PRIMARY_100 near-black; on 348 the step it maps to is white button text.
	const { legacy } = compileTheme(
		fixture('purple-galaxy-v1'),
		env,
		translateOnly,
	)
	assert.ok(legacy.skippedGreys.length > 0, 'some steps kept as Discord')
})

test('a light theme on a light Discord takes the light values', () => {
	const latte = fixture('catppuccin-latte-mauve')
	const { definition } = compileTheme(latte, envFor(d348, true), translateOnly)
	assert.equal(definition.type, 'light')
	assert.equal(
		definition.semantic.BACKGROUND_PRIMARY.value,
		latte.semanticColors.BACKGROUND_PRIMARY[1].toLowerCase(),
	)
})

test('every target in the old-name table exists on the newest Discord we have', () => {
	const known = new Set(Object.keys(d350.semantic))
	const missing = LEGACY_SEMANTIC.flatMap(([, targets]) =>
		targets.filter(t => !known.has(t)),
	)
	assert.deepEqual([...new Set(missing)], [])
})

test('no old name appears twice in the table', () => {
	const names = LEGACY_SEMANTIC.map(([name]) => name)
	assert.deepEqual(
		names.filter((n, i) => names.indexOf(n) !== i),
		[],
	)
})
