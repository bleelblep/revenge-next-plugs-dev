import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { compileTheme } from '../js/lib/compile.ts'
import { discord, envFor, fixtures, OPTIONS } from './helpers.mjs'

const dump = discord('348.5')
const env = envFor(dump)

test('completed colours keep the alpha of the colour they replace', () => {
	for (const { name, manifest } of fixtures()) {
		const without = compileTheme(manifest, env, {
			...OPTIONS,
			completePalette: false,
		}).definition
		const { definition } = compileTheme(manifest, env, OPTIONS)
		for (const [key, value] of Object.entries(definition.raw)) {
			if (key in without.raw) continue
			const theirs = dump.raw[key]
			if (!theirs) continue
			assert.equal(
				value.slice(7),
				theirs.slice(7).toLowerCase(),
				`${name}: ${key} ${theirs} -> ${value}`,
			)
		}
	}
})

test('completing the palette reaches more of Discord, never less', () => {
	for (const { name, manifest } of fixtures()) {
		const without = compileTheme(manifest, env, {
			...OPTIONS,
			completePalette: false,
			matchNavBar: false,
		}).definition
		const { palette } = compileTheme(manifest, env, OPTIONS)
		const known = new Set(env.names)
		const named = Object.keys(without.semantic).filter(k => known.has(k)).length
		assert.ok(palette.total > 400, name)
		assert.ok(
			palette.covered >= named,
			`${name}: ${palette.covered} < ${named} named`,
		)
		assert.ok(palette.covered <= palette.total, name)
	}
})

test('preview and apply see the same colours (one pipeline)', () => {
	// compileTheme is pure: the same theme, tables and options give the same result.
	for (const { name, manifest } of fixtures()) {
		const a = compileTheme(structuredClone(manifest), env, OPTIONS).definition
		const b = compileTheme(structuredClone(manifest), env, OPTIONS).definition
		assert.deepEqual(a, b, name)
	}
})

// Snapshots: what each test theme compiles to on 348.5. A change to legacy.ts or palette.ts shows
// up here as exactly which colours moved. Rewrite with UPDATE_SNAPSHOTS=1 after checking the diff.
const snapDir = new URL('snapshots/', import.meta.url)

test('snapshots', () => {
	if (!existsSync(snapDir)) mkdirSync(snapDir)
	const update = process.env.UPDATE_SNAPSHOTS === '1'
	const changed = []
	for (const { name, manifest } of fixtures()) {
		const { definition, legacy, palette } = compileTheme(manifest, env, OPTIONS)
		const snap = {
			type: definition.type,
			legacy: legacy && {
				filled: legacy.filled,
				greys: legacy.greys,
				skippedGreys: legacy.skippedGreys,
				unplaced: legacy.unplaced,
				desktopOnly: legacy.desktopOnly,
			},
			coverage: palette && `${palette.covered}/${palette.total}`,
			semantic: Object.fromEntries(
				Object.entries(definition.semantic)
					.sort()
					.map(([k, v]) => [
						k,
						v.opacity === 1 ? v.value : `${v.value} ${v.opacity}`,
					]),
			),
			raw: Object.fromEntries(Object.entries(definition.raw).sort()),
		}
		const file = new URL(`${name}.json`, snapDir)
		const text = `${JSON.stringify(snap, null, '\t')}\n`
		if (update || !existsSync(file)) {
			writeFileSync(file, text)
			continue
		}
		const old = JSON.parse(readFileSync(file, 'utf8'))
		if (JSON.stringify(old) === JSON.stringify(snap)) continue
		const moved = ['semantic', 'raw'].flatMap(part =>
			[...new Set([...Object.keys(old[part]), ...Object.keys(snap[part])])]
				.filter(k => old[part][k] !== snap[part][k])
				.map(
					k =>
						`${part}.${k}: ${old[part][k] ?? '-'} -> ${snap[part][k] ?? '-'}`,
				),
		)
		changed.push(
			`${name} (${old.coverage} -> ${snap.coverage}):\n  ${moved.slice(0, 30).join('\n  ')}${moved.length > 30 ? `\n  …${moved.length - 30} more` : ''}`,
		)
	}
	assert.equal(
		changed.length,
		0,
		`Snapshots changed (UPDATE_SNAPSHOTS=1 to accept):\n${changed.join('\n')}`,
	)
})
