import type { ThemesStorage } from './types'

/**
 * Also the fallback for every read: `load: true` starts the storage read without awaiting it,
 * so `jsonStorage.cache` is genuinely undefined for a short window after start (porting rule 7).
 */
export const DEFAULTS: ThemesStorage = {
	themes: [],
	selected: '',
	typeOverride: 'auto',
	showBackground: true,
	chatInputFade: true,
	translateLegacy: true,
	completePalette: true,
	matchNavBar: true,
	applyingAtLaunch: false,
	skippedAtLaunch: false,
	safeBuild: '',
	lastCrash: '',
	debugLogging: false,
	fonts: [],
	selectedFont: '',
	includedPackList: [],
	iconPackList: [],
	iconPacks: [],
	selectedIconPack: '',
	iconTree: [],
}
