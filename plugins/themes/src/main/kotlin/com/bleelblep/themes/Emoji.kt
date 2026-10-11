// SPDX-License-Identifier: GPL-3.0-only
// The message, reaction and picker hooks and the drawable/span classes are adapted from System Emoji
// by contrabags (contrabag/revenge-next-plugins, plugins/system-emoji, GPL-3.0, read at 784a147),
// with changes: they draw with an emoji pack's font instead of the system's. See NOTICE.md.

package com.bleelblep.themes

import android.annotation.SuppressLint
import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.fonts.Font
import android.graphics.fonts.FontFamily
import android.graphics.fonts.FontStyle
import android.graphics.text.TextRunShaper
import android.os.Build
import android.text.SpannableString
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ReplacementSpan
import android.widget.ImageView
import java.io.File
import java.util.ArrayDeque
import java.util.WeakHashMap
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Emoji packs: one emoji font (a PoomSmart/EmojiFonts `.ttc`, Apple's `sbix` format) drawn in place
 * of Discord's emoji everywhere it can be reached.
 *
 * - **Messages, reactions, the emoji picker:** Discord draws these from images, not a font. The
 *   hooks below (after System Emoji) draw the pack's glyph instead. They follow the pack live.
 * - **Everything typed or shown as text** (the message box, names, embeds): the pack's font is
 *   added as a fallback to every typeface Discord builds, after its own fonts and before the
 *   system's emoji. React Native caches typefaces; choosing a pack empties that cache, so a reload
 *   shows it in text drawn afterwards.
 *
 * Android 10+ (the fallback API); older phones keep Discord's emoji.
 *
 * **Emoji a pack doesn't have.** Packs stop at the Unicode version their maker drew, and some leave
 * out sequences (families, skin tones, flags). Each emoji is checked first ([covers]); one the pack
 * doesn't have is left to Discord's own drawing. Text keeps the phone's either way: a font can only
 * fall back to another font.
 */
internal object Emoji {
	val supported get() = Build.VERSION.SDK_INT >= 29

	/** The pack in use now (loaded), its id; null = Discord's own emoji. */
	@Volatile var activeId: String? = null
		private set
	/** The pack loaded at process start: what text typefaces were built with. */
	@Volatile var textId: String? = null
		private set
	@Volatile private var family: FontFamily? = null
	/** Emoji size in messages, 1 = Discord's. Applies with or without a pack; reactions keep theirs. */
	@Volatile var scale = 1f
	@Volatile private var typeface: Typeface? = null
	/** The pack's own font and file, to tell its glyphs from the fallbacks'. */
	@Volatile private var packFont: Font? = null
	@Volatile private var packFile: File? = null

	/** Per emoji: whether the pack draws it itself. Cleared whenever the pack changes. */
	private val coverage = ConcurrentHashMap<String, Boolean>()
	/** False when this phone can't tell (older Android, or the self-test failed): draw everything. */
	@Volatile private var canCheck = false
	private val fallbacks = AtomicInteger()

	private val hooks = mutableListOf<XC_MethodHook.Unhook>()
	private val textFallbacks = AtomicInteger()
	private val errors = AtomicInteger()
	private val messageReplacements = AtomicInteger()
	private val pickerReplacements = AtomicInteger()
	@Volatile private var lastError = ""
	@Volatile var messagesActive = false
		private set
	@Volatile var pickerActive = false
		private set
	@Volatile var textActive = false
		private set

	fun recordError(error: Throwable) {
		errors.incrementAndGet()
		lastError = "${error.javaClass.simpleName}: ${error.message ?: "unknown error"}"
	}

	fun status(): Map<String, Any?> = mapOf(
		"supported" to supported,
		"active" to activeId,
		"scale" to scale.toDouble(),
		"text" to textId,
		"messagesActive" to messagesActive,
		"pickerActive" to pickerActive,
		"textActive" to textActive,
		"textFallbacks" to textFallbacks.get(),
		"messageReplacements" to messageReplacements.get(),
		"pickerReplacements" to pickerReplacements.get(),
		"coverageChecked" to canCheck,
		"fallbacks" to fallbacks.get(),
		"errors" to errors.get(),
		"lastError" to lastError,
	)

	// ---------------------------------------------------------------------------------------------
	// The pack's font
	// ---------------------------------------------------------------------------------------------

	/** Loads [file] as the pack in use; null = back to Discord's emoji. Returns whether it loaded. */
	@SuppressLint("NewApi")
	fun use(id: String?, file: File?, atStart: Boolean = false): Boolean {
		coverage.clear()
		canCheck = false
		if (id == null || file == null || !supported || !file.isFile) {
			activeId = null
			family = null
			typeface = null
			packFont = null
			packFile = null
			if (atStart) textId = null
			return id == null
		}
		return try {
			val font = Font.Builder(file).setTtcIndex(0).build()
			val built = FontFamily.Builder(font).build()
			family = built
			typeface = Typeface.CustomFallbackBuilder(built).setSystemFallback("sans-serif").build()
			packFont = font
			packFile = file
			activeId = id
			if (atStart) textId = id
			// Every pack has the grinning face. If the check can't see that, it can't be trusted on
			// this phone, and everything is drawn with the pack as before.
			canCheck = Build.VERSION.SDK_INT >= 31 && runCatching { shapesAsPack("\uD83D\uDE00") }.getOrDefault(false)
			coverage.clear()
			true
		} catch (error: Throwable) {
			recordError(error)
			activeId = null
			family = null
			typeface = null
			packFont = null
			packFile = null
			false
		}
	}

	/**
	 * Whether the pack draws [text] itself: shaped as exactly one glyph, from the pack's own font.
	 * Anything else means a fallback font drew it, or a sequence the pack doesn't join came apart.
	 * Tried as given and without variation selectors, since packs differ on whether their sequences
	 * include U+FE0F.
	 */
	fun covers(text: String): Boolean {
		if (!canCheck) return true
		return coverage.getOrPut(text) {
			runCatching {
				shapesAsPack(text) || text.replace("\uFE0F", "").replace("\uFE0E", "").let { it != text && it.isNotEmpty() && shapesAsPack(it) }
			}.getOrDefault(true)
		}
	}

	@SuppressLint("NewApi")
	private fun shapesAsPack(text: String): Boolean {
		val face = typeface ?: return false
		val own = packFont ?: return false
		return drawnBy(text, face, own, packFile?.absolutePath)
	}

	/** Whether [text] shapes as exactly one glyph from [own] (or another font from the same [file]). */
	@SuppressLint("NewApi")
	private fun drawnBy(text: String, face: Typeface, own: Font, file: String?): Boolean {
		val paint = Paint().apply { typeface = face; textSize = 64f }
		val glyphs = TextRunShaper.shapeTextRun(text, 0, text.length, 0, text.length, 0f, 0f, false, paint)
		if (glyphs.glyphCount() != 1) return false
		val used = glyphs.getFont(0)
		return used == own || (file != null && used.file?.absolutePath == file)
	}

	/** A pack loaded on its own, to look at whether or not it's in use. */
	class Standalone(val font: Font, val face: Typeface, val file: File)

	/** [file]'s font with only the phone's fonts behind it: never the pack in use. */
	@SuppressLint("NewApi")
	fun standalone(file: File): Standalone {
		building.set(true)
		try {
			val font = Font.Builder(file).build()
			return Standalone(font, Typeface.CustomFallbackBuilder(FontFamily.Builder(font).build()).build(), file)
		} finally {
			building.remove()
		}
	}

	/**
	 * Which of [texts] [pack] draws itself, the same test as [covers]; null when this phone can't
	 * tell (Android 11 and older have no way to ask which font drew a glyph).
	 */
	fun coverageOf(pack: Standalone, texts: List<String>): List<Boolean>? {
		if (Build.VERSION.SDK_INT < 31) return null
		val file = pack.file.absolutePath
		return texts.map { text ->
			runCatching {
				drawnBy(text, pack.face, pack.font, file) ||
					text.replace("\uFE0F", "").replace("\uFE0E", "").let { it != text && it.isNotEmpty() && drawnBy(it, pack.face, pack.font, file) }
			}.getOrDefault(false)
		}
	}

	/** The typeface to draw [text] with in messages, reactions and the picker; null = Discord's own. */
	private fun faceFor(text: String, pack: Typeface): Typeface? {
		if (covers(text)) return pack
		fallbacks.incrementAndGet()
		// An emoji the pack doesn't have always falls back to Discord's own drawing.
		return null
	}

	fun currentTypeface(): Typeface? = typeface

	/**
	 * Draws "😀" with the pack and counts the pixels that came out coloured: a check that this
	 * phone can draw the pack's format at all (Apple's `sbix` bitmaps).
	 */
	fun probe(text: String = "😀"): Map<String, Any?> {
		val face = typeface ?: return mapOf("ok" to false, "reason" to "no pack loaded")
		val size = 96
		val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
		return try {
			EmojiDrawable(text, size, face).apply { setBounds(0, 0, size, size) }.draw(Canvas(bitmap))
			var inked = 0
			var coloured = 0
			val pixels = IntArray(size * size)
			bitmap.getPixels(pixels, 0, size, 0, 0, size, size)
			for (p in pixels) {
				if ((p ushr 24) < 16) continue
				inked++
				val r = (p shr 16) and 0xff
				val g = (p shr 8) and 0xff
				val b = p and 0xff
				if (maxOf(r, g, b) - minOf(r, g, b) > 40) coloured++
			}
			mapOf("ok" to (coloured > 200), "inked" to inked, "coloured" to coloured)
		} catch (error: Throwable) {
			recordError(error)
			mapOf("ok" to false, "reason" to (error.message ?: error.javaClass.simpleName))
		} finally {
			bitmap.recycle()
		}
	}

	// ---------------------------------------------------------------------------------------------
	// Text: the pack as a fallback on Discord's typefaces
	// ---------------------------------------------------------------------------------------------

	/** Set while we build a typeface ourselves, so our own builder isn't hooked again. */
	private val building = ThreadLocal<Boolean>()

	@SuppressLint("NewApi")
	fun installText() {
		if (!supported) return
		// Discord's and Revenge's font loaders build a list of fonts this way (comma-separated names).
		val build = Typeface.CustomFallbackBuilder::class.java.getDeclaredMethod("build")
		hooks += XposedBridge.hookMethod(build, object : XC_MethodHook() {
			override fun beforeHookedMethod(param: MethodHookParam) {
				if (building.get() == true) return
				val fam = family ?: return
				try {
					(param.thisObject as Typeface.CustomFallbackBuilder).addCustomFallback(fam)
					textFallbacks.incrementAndGet()
				} catch (error: Throwable) {
					recordError(error)
				}
			}
		})
		// A single font file or asset: built again with the pack behind it.
		val fromFile = Typeface::class.java.getDeclaredMethod("createFromFile", String::class.java)
		hooks += XposedBridge.hookMethod(fromFile, object : XC_MethodHook() {
			override fun afterHookedMethod(param: MethodHookParam) {
				val path = param.args[0] as? String ?: return
				val original = param.result as? Typeface ?: return
				rebuild(original) { Font.Builder(File(path)) }?.let { param.result = it }
			}
		})
		val fromFileObj = Typeface::class.java.getDeclaredMethod("createFromFile", File::class.java)
		hooks += XposedBridge.hookMethod(fromFileObj, object : XC_MethodHook() {
			override fun afterHookedMethod(param: MethodHookParam) {
				val file = param.args[0] as? File ?: return
				val original = param.result as? Typeface ?: return
				rebuild(original) { Font.Builder(file) }?.let { param.result = it }
			}
		})
		val fromAsset = Typeface::class.java.getDeclaredMethod("createFromAsset", AssetManager::class.java, String::class.java)
		hooks += XposedBridge.hookMethod(fromAsset, object : XC_MethodHook() {
			override fun afterHookedMethod(param: MethodHookParam) {
				val assets = param.args[0] as? AssetManager ?: return
				val path = param.args[1] as? String ?: return
				val original = param.result as? Typeface ?: return
				rebuild(original) { Font.Builder(assets, path) }?.let { param.result = it }
			}
		})
		textActive = true
	}

	@SuppressLint("NewApi")
	private fun rebuild(original: Typeface, font: () -> Font.Builder): Typeface? {
		val fam = family ?: return null
		if (building.get() == true) return null
		building.set(true)
		return try {
			val own = FontFamily.Builder(font().build()).build()
			val slant = if (original.isItalic) FontStyle.FONT_SLANT_ITALIC else FontStyle.FONT_SLANT_UPRIGHT
			Typeface.CustomFallbackBuilder(own)
				.addCustomFallback(fam)
				.setStyle(FontStyle(original.weight, slant))
				.build()
				.also { textFallbacks.incrementAndGet() }
		} catch (error: Throwable) {
			recordError(error)
			null
		} finally {
			building.remove()
		}
	}

	/**
	 * React Native keeps every typeface it made; emptying its cache lets a JS reload pick up a new
	 * pack in the text that's drawn afterwards. Best effort: the field names aren't public.
	 */
	fun clearReactFontCache(loader: ClassLoader) {
		for (name in listOf(
			"com.facebook.react.common.assets.ReactFontManager",
			"com.facebook.react.views.text.ReactFontManager",
		)) {
			runCatching {
				val cls = Class.forName(name, false, loader)
				val instance = runCatching { cls.getMethod("getInstance").invoke(null) }.getOrNull()
					?: runCatching {
						val companion = cls.getDeclaredField("Companion").apply { isAccessible = true }.get(null)
						companion.javaClass.getMethod("getInstance").invoke(companion)
					}.getOrNull()
					?: return@runCatching
				for (field in cls.declaredFields) {
					if (!Map::class.java.isAssignableFrom(field.type)) continue
					field.isAccessible = true
					(field.get(instance) as? MutableMap<*, *>)?.clear()
				}
			}
		}
	}

	// ---------------------------------------------------------------------------------------------
	// Messages and reactions (after System Emoji)
	// ---------------------------------------------------------------------------------------------

	private val depth = ThreadLocal<Int>()
	private val messageScopes = ThreadLocal<ArrayDeque<MessageScope>>()

	fun installMessages(loader: ClassLoader) {
		fun cls(name: String) = Class.forName(name, false, loader)
		val reactionView = cls("com.discord.reactions.ReactionView")
		val unicodeClass = cls("com.discord.emoji.RenderableEmoji\$Unicode")
		val surrogates = unicodeClass.getDeclaredField("surrogates").apply { isAccessible = true }
		check(surrogates.type == String::class.java) { "Unexpected Unicode.surrogates type" }
		val reactionMethod = reactionView.getDeclaredMethod(
			"setReaction",
			cls("com.discord.reactions.ReactionView\$Reaction"),
			cls("com.discord.reactions.ReactionView\$ReactionsTheme"),
		)
		val builderClass = cls("com.facebook.drawee.span.DraweeSpanStringBuilder")
		check(SpannableStringBuilder::class.java.isAssignableFrom(builderClass)) { "Unexpected emoji span builder" }
		val renderer = cls("com.discord.emoji.RenderableEmojiKt").getDeclaredMethod(
			"renderEmojiInto",
			builderClass,
			cls("com.discord.emoji.RenderableEmoji"),
			cls("android.content.Context"),
			Integer.TYPE,
			java.lang.Boolean.TYPE,
			Integer.TYPE,
			cls("kotlin.jvm.functions.Function1"),
		)
		check(renderer.returnType == Void.TYPE) { "Unexpected renderEmojiInto return type" }
		check(reactionMethod.returnType == Void.TYPE) { "Unexpected setReaction return type" }

		val contextClass = cls("com.discord.chat.presentation.textutils.RenderContext")
		val spoilerExists = contextClass.getDeclaredMethod("spoilerExists")
		val spoilerIsRevealed = contextClass.getDeclaredMethod("spoilerIsRevealed")
		val getTheme = contextClass.getDeclaredMethod("getTheme")
		val getBackground = getTheme.returnType.getMethod("getSpoilerRevealedBackground")
		check(getBackground.returnType == Integer.TYPE)
		val messageMethod = cls("com.discord.chat.presentation.textutils.EmojiRendererKt").getDeclaredMethod(
			"renderEmoji",
			builderClass,
			cls("com.discord.chat.bridge.contentnode.EmojiContentNode"),
			contextClass,
		)
		check(messageMethod.returnType == Void.TYPE)

		hooks += XposedBridge.hookMethod(reactionMethod, object : XC_MethodHook() {
			override fun beforeHookedMethod(param: MethodHookParam) {
				depth.set((depth.get() ?: 0) + 1)
			}

			override fun afterHookedMethod(param: MethodHookParam) {
				val remaining = (depth.get() ?: 1) - 1
				if (remaining <= 0) depth.remove() else depth.set(remaining)
			}
		})
		hooks += XposedBridge.hookMethod(messageMethod, object : XC_MethodHook() {
			override fun beforeHookedMethod(param: MethodHookParam) {
				val scopes = messageScopes.get() ?: ArrayDeque<MessageScope>().also { messageScopes.set(it) }
				var scope = MessageScope(false)
				try {
					val context = param.args[2]
					val hasSpoiler = spoilerExists.invoke(context) as Boolean
					val revealed = hasSpoiler && spoilerIsRevealed.invoke(context) as Boolean
					// A hidden spoiler keeps Discord's own drawing, which knows how to hide it.
					val allowed = (!hasSpoiler || revealed) && scopes.none { !it.allowed }
					val background = if (allowed && revealed) getBackground.invoke(getTheme.invoke(context)) as Int else null
					scope = MessageScope(allowed, background)
				} catch (error: Throwable) {
					recordError(error)
				}
				scopes.push(scope)
			}

			override fun afterHookedMethod(param: MethodHookParam) {
				val scopes = messageScopes.get() ?: return
				if (!scopes.isEmpty()) scopes.pop()
				if (scopes.isEmpty()) messageScopes.remove()
			}
		})
		hooks += XposedBridge.hookMethod(renderer, object : XC_MethodHook() {
			override fun beforeHookedMethod(param: MethodHookParam) {
				val scope = messageScopes.get()?.peek()
				// Message emoji (not reactions) at the chosen size, also when Discord draws them.
				if (scope != null && scale != 1f) {
					(param.args[3] as? Int)?.let { param.args[3] = (it * scale).toInt().coerceAtLeast(1) }
				}
				val face = typeface ?: return
				if (scope?.allowed == false) return
				if (scope == null && (depth.get() ?: 0) == 0) return
				val emoji = param.args[1]
				if (!unicodeClass.isInstance(emoji)) return
				val builder = param.args[0] as? SpannableStringBuilder ?: return
				val originalLength = builder.length
				try {
					val text = surrogates.get(emoji) as? String ?: return
					if (text.isEmpty() || text == "©" || text == "®" || text == "™") return
					val sizePx = param.args[3] as? Int ?: return
					if (sizePx <= 0) return
					val alignment = param.args[5] as? Int ?: return
					// Not in the pack: Discord draws its own, unless the phone's emoji were chosen.
					val drawWith = faceFor(text, face) ?: return
					val span = SpannableString(text)
					span.setSpan(
						EmojiSpan(EmojiDrawable(text, sizePx, drawWith), sizePx, alignment, scope?.background),
						0, span.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
					)
					builder.append(span)
					param.result = null
					messageReplacements.incrementAndGet()
				} catch (error: Throwable) {
					if (builder.length > originalLength) builder.delete(originalLength, builder.length)
					recordError(error)
				}
			}
		})
		messagesActive = true
	}

	// ---------------------------------------------------------------------------------------------
	// The emoji picker (after System Emoji)
	// ---------------------------------------------------------------------------------------------

	private val pickerCells = WeakHashMap<Any, PickerCell>()

	fun installPicker(loader: ClassLoader) {
		fun cls(name: String) = Class.forName(name, false, loader)
		val holderClass = cls("com.discord.emoji_picker.EmojiPickerViewHolder\$Emoji")
		val itemClass = cls("com.discord.emoji_picker.EmojiPickerItem\$Emoji")
		val unicodeClass = cls("com.discord.emoji.UnicodeEmojis\$Emoji")
		val viewClass = cls("com.facebook.drawee.view.SimpleDraweeView")
		val hierarchyClass = cls("com.facebook.drawee.generic.GenericDraweeHierarchy")
		fun field(owner: Class<*>, name: String) = owner.getDeclaredField(name).apply { isAccessible = true }
		val itemField = field(holderClass, "emojiItem")
		val viewField = field(holderClass, "emojiView")
		val sizeField = field(holderClass, "emojiSize")
		val urlField = field(holderClass, "emojiUrl")
		val unicodeField = field(itemClass, "unicode")
		check(unicodeField.type == unicodeClass && urlField.type == String::class.java)
		check(ImageView::class.java.isAssignableFrom(viewClass))
		val getSurrogates = unicodeClass.getDeclaredMethod("getSurrogates").apply { isAccessible = true }
		val getHierarchy = viewClass.getMethod("getHierarchy")
		val setController = viewClass.getMethod("setController", cls("com.facebook.drawee.interfaces.DraweeController"))
		val setImage = hierarchyClass.declaredMethods.single {
			it.returnType == Void.TYPE && it.parameterTypes.contentEquals(
				arrayOf(Drawable::class.java, java.lang.Float.TYPE, java.lang.Boolean.TYPE),
			)
		}.apply { isAccessible = true }
		val updateImage = holderClass.getDeclaredMethod("updateImage", java.lang.Boolean.TYPE, java.lang.Boolean.TYPE)
		check(updateImage.returnType == Void.TYPE)

		hooks += XposedBridge.hookMethod(updateImage, object : XC_MethodHook() {
			override fun beforeHookedMethod(param: MethodHookParam) {
				val face = typeface ?: return
				val holder = param.thisObject
				try {
					val item = itemField.get(holder) ?: return
					val unicode = unicodeField.get(item)
					if (unicode == null) {
						synchronized(pickerCells) { pickerCells.remove(holder) }
						return
					}
					val text = getSurrogates.invoke(unicode) as? String ?: return
					val size = (sizeField.get(holder) as? Number)?.toInt() ?: return
					if (text.isEmpty() || size <= 0) return
					// Not in the pack: Discord's own image, which its own updateImage loads.
					val drawWith = faceFor(text, face)
					if (drawWith == null) {
						synchronized(pickerCells) { pickerCells.remove(holder) }
						return
					}
					val view = viewField.get(holder) as ImageView
					val hierarchy = getHierarchy.invoke(view)
					check(hierarchyClass.isInstance(hierarchy))
					val cached = synchronized(pickerCells) { pickerCells[holder] }
					val cell = if (cached != null && cached.text == text && cached.size == size && cached.face === drawWith) cached
					else PickerCell(text, size, drawWith, PickerDrawable(EmojiDrawable(text, size, drawWith), size))
					setController.invoke(view, *arrayOf<Any?>(null))
					urlField.set(holder, null)
					view.background = null
					setImage.invoke(hierarchy, cell.drawable, 1f, true)
					synchronized(pickerCells) { pickerCells[holder] = cell }
					param.result = null
					pickerReplacements.incrementAndGet()
				} catch (error: Throwable) {
					runCatching { urlField.set(holder, null) }
					synchronized(pickerCells) { pickerCells.remove(holder) }
					recordError(error)
				}
			}
		})
		pickerActive = true
	}

	/** One emoji as a PNG data URI, for JS-drawn emoji (the reaction bar, menus). */
	fun artwork(text: String, size: Int): String? {
		val pack = typeface ?: return null
		if (text.isEmpty() || text.length > 64 || size !in 16..256) return null
		// Null hands it back to Discord's own artwork, like messages.
		val face = faceFor(text, pack) ?: return null
		val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
		return try {
			EmojiDrawable(text, size, face).apply { setBounds(0, 0, size, size) }.draw(Canvas(bitmap))
			val output = java.io.ByteArrayOutputStream()
			check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output))
			"data:image/png;base64," + android.util.Base64.encodeToString(output.toByteArray(), android.util.Base64.NO_WRAP)
		} catch (error: Throwable) {
			recordError(error)
			null
		} finally {
			bitmap.recycle()
		}
	}

	fun uninstall() {
		hooks.asReversed().forEach { runCatching { it.unhook() } }
		hooks.clear()
		messagesActive = false
		pickerActive = false
		textActive = false
		synchronized(pickerCells) { pickerCells.clear() }
	}
}

private data class MessageScope(val allowed: Boolean, val background: Int? = null)

private data class PickerCell(val text: String, val size: Int, val face: Typeface, val drawable: Drawable)

private class PickerDrawable(private val glyph: EmojiDrawable, private val size: Int) : Drawable() {
	init { setBounds(0, 0, size, size) }
	override fun getIntrinsicWidth(): Int = size
	override fun getIntrinsicHeight(): Int = size
	override fun onBoundsChange(bounds: Rect) { glyph.bounds = bounds }
	override fun draw(canvas: Canvas) { glyph.draw(canvas) }
	override fun setAlpha(alpha: Int) { glyph.alpha = alpha; invalidateSelf() }
	override fun setColorFilter(colorFilter: ColorFilter?) { glyph.colorFilter = colorFilter; invalidateSelf() }
	@Deprecated("Deprecated in Java")
	override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}

private class EmojiSpan(
	private val drawable: Drawable,
	private val sizePx: Int,
	private val alignment: Int,
	background: Int? = null,
) : ReplacementSpan() {
	private val backgroundPaint = background?.let { Paint().apply { color = it } }
	private fun slotTop(metrics: Paint.FontMetricsInt): Int = when (alignment) {
		0 -> metrics.descent - sizePx
		2 -> metrics.ascent + (metrics.descent - metrics.ascent - sizePx) / 2
		else -> -sizePx
	}

	override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int {
		if (fm != null) {
			val top = slotTop(fm)
			val bottom = top + sizePx
			fm.ascent = minOf(fm.ascent, top)
			fm.top = minOf(fm.top, top)
			fm.descent = maxOf(fm.descent, bottom)
			fm.bottom = maxOf(fm.bottom, bottom)
		}
		return sizePx
	}

	override fun draw(canvas: Canvas, text: CharSequence, start: Int, end: Int, x: Float, top: Int, y: Int, bottom: Int, paint: Paint) {
		val saved = canvas.save()
		try {
			canvas.translate(x, (y + slotTop(paint.fontMetricsInt)).toFloat())
			backgroundPaint?.let { canvas.drawRect(0f, 0f, sizePx.toFloat(), sizePx.toFloat(), it) }
			drawable.draw(canvas)
		} finally {
			canvas.restoreToCount(saved)
		}
	}
}

/** One emoji drawn from [face], scaled to fit its box. */
internal class EmojiDrawable(private val emoji: String, sizePx: Int, face: Typeface) : Drawable() {
	private val glyphPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
		typeface = face
		textSize = sizePx.toFloat()
	}
	private val ink = Rect()

	init {
		setBounds(0, 0, sizePx, sizePx)
		glyphPaint.getTextBounds(emoji, 0, emoji.length, ink)
		if (ink.isEmpty) {
			val metrics = glyphPaint.fontMetricsInt
			ink.set(0, metrics.ascent, kotlin.math.ceil(glyphPaint.measureText(emoji)).toInt(), metrics.descent)
		}
		check(!ink.isEmpty) { "Emoji has no drawable bounds" }
	}

	override fun draw(canvas: Canvas) {
		val box = bounds
		if (box.isEmpty) return
		val scale = minOf(1f, box.width().toFloat() / ink.width(), box.height().toFloat() / ink.height())
		val saved = canvas.save()
		try {
			canvas.clipRect(box)
			canvas.translate(box.exactCenterX(), box.exactCenterY())
			canvas.scale(scale, scale)
			canvas.drawText(emoji, -ink.exactCenterX(), -ink.exactCenterY(), glyphPaint)
		} finally {
			canvas.restoreToCount(saved)
		}
	}

	override fun setAlpha(alpha: Int) { glyphPaint.alpha = alpha; invalidateSelf() }
	override fun setColorFilter(colorFilter: ColorFilter?) { glyphPaint.colorFilter = colorFilter; invalidateSelf() }
	@Deprecated("Deprecated in Java")
	override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}
