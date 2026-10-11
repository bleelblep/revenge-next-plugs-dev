/**
 * The drawing shared by the Themes screens: a theme's palette, Discord's Messages preview in it,
 * and the portrait tiles from Discord's App Theme screen. Everything reads `revenge.*` at render
 * (porting rule 1).
 */

import type { Resolve } from '../lib/preview'

/** Discord's Dark theme, for anything a theme's colours can't place. */
export const FALLBACK = {
	page: '#202024',
	card: '#1a1a1e',
	raised: '#97979f14',
	text: '#efeff1',
	strong: '#fbfbfb',
	muted: '#96979e',
	accent: '#5865f2',
	border: '#97979f1f',
}

export interface Palette {
	page: string
	card: string
	raised: string
	text: string
	strong: string
	muted: string
	subtle: string
	accent: string
	border: string
	online: string
	idle: string
	dnd: string
}

export function paletteOf(resolve: Resolve): Palette {
	return {
		page: resolve('BACKGROUND_BASE_LOW', FALLBACK.page),
		card: resolve('BACKGROUND_BASE_LOWER', FALLBACK.card),
		raised: resolve('BACKGROUND_MOD_MUTED', FALLBACK.raised),
		text: resolve('TEXT_DEFAULT', FALLBACK.text),
		strong: resolve('TEXT_STRONG', FALLBACK.strong),
		muted: resolve('TEXT_MUTED', FALLBACK.muted),
		subtle: resolve('TEXT_SUBTLE', '#abacb2'),
		accent: resolve('CONTROL_PRIMARY_BACKGROUND_DEFAULT', FALLBACK.accent),
		border: resolve('BORDER_SUBTLE', FALLBACK.border),
		online: resolve('ICON_STATUS_ONLINE', '#3d9e60'),
		idle: resolve('ICON_STATUS_IDLE', '#ffcb6e'),
		dnd: resolve('ICON_STATUS_DND', '#dc4247'),
	}
}

/** Text in a colour of our choosing, in Discord's own font and sizes. */
export function T({
	colour,
	variant,
	children,
	style,
	lines,
}: {
	colour: string
	variant: string
	children: any
	style?: any
	lines?: number
}) {
	const { Text } = revenge.discord.design.Design as any
	return (
		<Text
			variant={variant}
			style={[{ color: colour }, style]}
			numberOfLines={lines}
		>
			{children}
		</Text>
	)
}

/** The sample conversations on Discord's own preview. Read ones draw their name muted. */
const CONVERSATIONS: Array<{
	name: string
	preview: string
	time: string
	unread?: boolean
	status?: 'online' | 'idle' | 'dnd'
	hue: number
	group?: boolean
}> = [
	{
		name: 'Nelly',
		preview: 'Enjoy your trip to spain!',
		time: '24m',
		unread: true,
		status: 'online',
		hue: 0,
	},
	{
		name: 'bio study group',
		preview: 'graggle: Can someone explain #4?',
		time: '32m',
		unread: true,
		hue: 1,
		group: true,
	},
	{
		name: 'phibi',
		preview: "I'll add them to the server",
		time: '1h',
		status: 'idle',
		hue: 2,
	},
	{
		name: 'Dodgeball',
		preview: 'cap: Registration opens on the third!',
		time: '2h',
		hue: 3,
		group: true,
	},
	{
		name: 'mac',
		preview: 'What time should we start tonight?',
		time: '2h',
		status: 'online',
		hue: 4,
	},
	{
		name: 'Wumpus and Locke',
		preview: "Locke: okay I'll see you there",
		time: '4h',
		hue: 5,
		group: true,
	},
	{ name: 'amanda', preview: 'ok', time: '6h', status: 'dnd', hue: 6 },
]

/** Avatar stand-ins: fixed friendly colours, since avatars are pictures and don't follow a theme. */
const AVATAR_COLOURS = [
	'#57f287',
	'#5865f2',
	'#3ba55c',
	'#faa61a',
	'#eb459e',
	'#fee75c',
	'#7289da',
]

function Avatar({
	p,
	hue,
	status,
	group,
}: {
	p: Palette
	hue: number
	status?: 'online' | 'idle' | 'dnd'
	group?: boolean
}) {
	const { View } = revenge.react.ReactNative
	const colour = AVATAR_COLOURS[hue % AVATAR_COLOURS.length]
	const dot =
		status === 'online'
			? p.online
			: status === 'idle'
				? p.idle
				: status === 'dnd'
					? p.dnd
					: undefined
	if (group) {
		return (
			<View style={{ width: 44, height: 44 }}>
				<View
					style={{
						position: 'absolute',
						left: 0,
						top: 0,
						width: 30,
						height: 30,
						borderRadius: 15,
						backgroundColor: colour,
					}}
				/>
				<View
					style={{
						position: 'absolute',
						right: 0,
						bottom: 0,
						width: 30,
						height: 30,
						borderRadius: 15,
						backgroundColor: AVATAR_COLOURS[(hue + 3) % AVATAR_COLOURS.length],
						borderWidth: 2,
						borderColor: p.card,
					}}
				/>
			</View>
		)
	}
	return (
		<View style={{ width: 44, height: 44 }}>
			<View
				style={{
					width: 44,
					height: 44,
					borderRadius: 22,
					backgroundColor: colour,
				}}
			/>
			{dot ? (
				<View
					style={{
						position: 'absolute',
						right: -1,
						bottom: -1,
						width: 16,
						height: 16,
						borderRadius: 8,
						backgroundColor: dot,
						borderWidth: 3,
						borderColor: p.card,
					}}
				/>
			) : null}
		</View>
	)
}

/** Discord's preview: the Messages tab, drawn in the palette. */
export function MessagesPreview({ p }: { p: Palette }) {
	const { View } = revenge.react.ReactNative
	return (
		<View
			style={{
				flex: 1,
				borderRadius: 20,
				overflow: 'hidden',
				backgroundColor: p.card,
				borderWidth: 1,
				borderColor: p.border,
			}}
		>
			<View
				style={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12 }}
			>
				<T colour={p.strong} variant="heading-lg/extrabold">
					Messages
				</T>
			</View>

			{/* The activity card row. */}
			<View
				style={{
					flexDirection: 'row',
					gap: 8,
					paddingLeft: 16,
					marginBottom: 10,
				}}
			>
				<View
					style={{
						flex: 1,
						flexDirection: 'row',
						alignItems: 'center',
						gap: 12,
						padding: 8,
						borderRadius: 16,
						backgroundColor: p.raised,
						borderWidth: 1,
						borderColor: p.border,
					}}
				>
					<View
						style={{
							width: 64,
							height: 64,
							borderRadius: 10,
							backgroundColor: '#ffffff',
						}}
					/>
					<View style={{ flex: 1, gap: 2 }}>
						<View style={{ flexDirection: 'row' }}>
							{[0, 1, 2].map(i => (
								<View
									key={i}
									style={{
										width: 18,
										height: 18,
										borderRadius: 9,
										marginLeft: i ? -5 : 0,
										backgroundColor: AVATAR_COLOURS[i + 2],
										borderWidth: 1.5,
										borderColor: p.card,
									}}
								/>
							))}
						</View>
						<T colour={p.strong} variant="text-md/medium" lines={1}>
							Mallow, Cap, and 3 others
						</T>
						<T colour={p.muted} variant="text-sm/normal" lines={1}>
							SketchHeads
						</T>
					</View>
				</View>
				<View
					style={{
						width: 70,
						borderTopLeftRadius: 16,
						borderBottomLeftRadius: 16,
						backgroundColor: p.raised,
						borderWidth: 1,
						borderRightWidth: 0,
						borderColor: p.border,
					}}
				/>
			</View>

			<View
				style={{ paddingHorizontal: 16, gap: 14, overflow: 'hidden', flex: 1 }}
			>
				{CONVERSATIONS.map(c => (
					<View
						key={c.name}
						style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
					>
						<View
							style={{
								width: 8,
								height: 8,
								borderRadius: 4,
								backgroundColor: c.unread ? p.accent : 'transparent',
							}}
						/>
						<Avatar p={p} hue={c.hue} status={c.status} group={c.group} />
						<View style={{ flex: 1, minWidth: 0 }}>
							<View
								style={{
									flexDirection: 'row',
									justifyContent: 'space-between',
									gap: 8,
								}}
							>
								<T
									colour={c.unread ? p.strong : p.muted}
									variant="text-md/semibold"
									lines={1}
									style={{ flexShrink: 1 }}
								>
									{c.name}
								</T>
								<T colour={p.muted} variant="text-xs/medium">
									{c.time}
								</T>
							</View>
							<T
								colour={c.unread ? p.text : p.muted}
								variant="text-sm/medium"
								lines={1}
							>
								{c.preview}
							</T>
						</View>
					</View>
				))}
			</View>
		</View>
	)
}

/** A row of colour dots: a theme's main colours, for the index card and the Manage rows. */
export function Dots({
	colours,
	size = 18,
}: {
	colours: string[]
	size?: number
}) {
	const { View } = revenge.react.ReactNative
	return (
		<View style={{ flexDirection: 'row', gap: size / 4 }}>
			{colours.map((colour, i) => (
				<View
					key={`${i}-${colour}`}
					style={{
						width: size,
						height: size,
						borderRadius: size / 2,
						backgroundColor: colour,
						borderWidth: 1,
						borderColor: '#ffffff26',
					}}
				/>
			))}
		</View>
	)
}

/** The colours a theme is recognised by: chat, bars, text and accent. */
export function keyColours(p: Palette): string[] {
	return [
		...new Set([p.card, p.page, p.text, p.accent].map(c => c.slice(0, 7))),
	]
}
