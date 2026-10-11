import {
	BLUR,
	DIM,
	pickFromGallery,
	removeBackground,
	setBlur,
	setDim,
	setLink,
} from '../lib/customBackground'
import { toast } from '../lib/state'
import { confirmDestructive } from '../vendor/confirm'
import { FieldRow } from '../vendor/fieldGroup'
import { dangerIcon, rowIcon } from './icon'
import type { CustomBackground } from '../types'

/**
 * Appearance > Your background: one image behind the chat for every theme. Gallery or link, a
 * preview with the dimming applied, dim and blur sliders, and Remove (danger row, asks first).
 */
export function YourBackground({
	background,
}: {
	background: CustomBackground | null | undefined
}) {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { React } = revenge.react
	const { Image, View } = revenge.react.ReactNative
	const { Button, Slider, TableRow, TableRowGroup, TextInput } = revenge.discord
		.design.Design as any

	const [link, setLinkText] = React.useState('')
	const [linkError, setLinkError] = React.useState<string | undefined>()
	const [broken, setBroken] = React.useState(false)
	const [picking, setPicking] = React.useState(false)

	// A new image gets a fresh chance to load.
	const uri = background?.uri
	React.useEffect(() => setBroken(false), [uri])

	const pick = async () => {
		if (picking) return
		setPicking(true)
		try {
			if (await pickFromGallery()) toast('Chat background set')
		} catch (error) {
			toast(`Couldn't open the gallery: ${(error as Error)?.message ?? error}`)
		} finally {
			setPicking(false)
		}
	}

	const applyLink = () => {
		const error = setLink(link)
		setLinkError(error)
		if (!error) {
			setLinkText('')
			toast('Chat background set')
		}
	}

	const dim = background?.dim ?? DIM.default
	const blur = background?.blur ?? BLUR.default

	return (
		<>
			<TableRowGroup
				title="Your background"
				description="One picture behind the chat, whatever theme you use. It replaces a theme's own background. Open a chat again to see a change."
				hasIcons
			>
				{uri ? (
					<FieldRow
						label="Preview"
						description={
							broken
								? "This image can't be loaded any more. Pick it again."
								: undefined
						}
					>
						<View
							style={{
								height: 180,
								borderRadius: 12,
								overflow: 'hidden',
								backgroundColor: '#000000',
							}}
						>
							{broken ? null : (
								<Image
									source={{ uri }}
									resizeMode="cover"
									blurRadius={blur || undefined}
									onError={() => setBroken(true)}
									style={{ width: '100%', height: '100%' }}
								/>
							)}
							<View
								pointerEvents="none"
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									right: 0,
									bottom: 0,
									backgroundColor: `rgba(0,0,0,${dim})`,
								}}
							/>
						</View>
					</FieldRow>
				) : null}
				<TableRow
					label={uri ? 'Choose another picture' : 'Choose from gallery'}
					subLabel="Kept in Discord's own storage, so it stays even if you delete the photo"
					icon={rowIcon('ImageIcon', 'ic_image')}
					arrow
					disabled={picking}
					onPress={pick}
				/>
				<FieldRow label="Or use an image link">
					<TextInput
						placeholder="https://…"
						value={link}
						onChange={(value: string) => {
							setLinkText(value)
							setLinkError(undefined)
						}}
						status={linkError ? 'error' : undefined}
						errorMessage={linkError}
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<Button
						text="Use this link"
						size="sm"
						variant="secondary"
						disabled={!link.trim()}
						onPress={applyLink}
					/>
				</FieldRow>
			</TableRowGroup>

			{uri ? (
				<TableRowGroup title="Adjust">
					<FieldRow label={`Dim — ${Math.round(dim * 100)}%`}>
						<Slider
							step={0.05}
							value={dim}
							minimumValue={DIM.min}
							maximumValue={DIM.max}
							onValueChange={(value: number) => setDim(value)}
						/>
					</FieldRow>
					<FieldRow label={blur ? `Blur — ${blur}` : 'Blur — off'}>
						<Slider
							step={1}
							value={blur}
							minimumValue={BLUR.min}
							maximumValue={BLUR.max}
							onValueChange={(value: number) => setBlur(value)}
						/>
					</FieldRow>
				</TableRowGroup>
			) : null}

			{uri ? (
				<TableRowGroup hasIcons>
					<TableRow
						label="Remove background"
						variant="danger"
						icon={dangerIcon('TrashIcon', 'ic_trash')}
						onPress={() =>
							confirmDestructive({
								title: 'Remove background?',
								body: "The chat goes back to the theme's own background, or none.",
								action: 'Remove',
								onConfirm: removeBackground,
							})
						}
					/>
				</TableRowGroup>
			) : null}
		</>
	)
}
