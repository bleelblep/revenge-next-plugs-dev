package com.bleelblep.themes

import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Previews of an emoji pack that isn't downloaded: a few of its emoji, read straight out of the font
 * on GitHub with HTTP range requests -- a few KB instead of the whole 13-65 MB file.
 *
 * Two bitmap formats keep each emoji as a PNG, so one can be cut out of the file:
 *
 * - Apple's `sbix` (PoomSmart's EmojiFonts): the table directory, `cmap` (code point to glyph), one
 *   strike's two offsets for that glyph, then the PNG. Every EmojiFonts 17.0.0 pack stores PNGs
 *   (checked 2026-10-06), never Apple's own EMJC, which Android couldn't draw.
 * - Google's `CBLC`/`CBDT` (Android's own, what zFont's packs are): `CBLC` says where each glyph's
 *   image sits in `CBDT`, through one of five index formats; image formats 17, 18 and 19 are PNG.
 *
 * A vector font (`COLR`, Windows 11's) has no PNG inside. If it's small, the whole file is fetched
 * and Android draws the sample emoji from it ([vectorPreview]); a big one gets no preview. PNGs are
 * kept in `<cache>/<pack>/<hex>.png`.
 *
 * Single code points only: sequences (flags, families, skin tones) need the font's shaping tables.
 */
internal object Preview {
	/** Strike size wanted, in pixels per em; the largest at or under it is used. */
	private const val PPEM = 96

	private abstract class Index(val url: String, val glyphs: Map<Int, Int>) {
		abstract fun png(glyph: Int): ByteArray?
	}

	private class SbixIndex(url: String, glyphs: Map<Int, Int>, val strike: Long) : Index(url, glyphs) {
		override fun png(glyph: Int): ByteArray? = sbixPng(this, glyph)
	}

	/** One CBLC index subtable, read: its glyph range and how to find a glyph's image in CBDT. */
	private class SubTable(val first: Int, val last: Int, val indexFormat: Int, val imageFormat: Int, val imageData: Long, val data: ByteBuffer, val at: Int)

	private class CbdtIndex(url: String, glyphs: Map<Int, Int>, val cbdt: Long, val subtables: List<SubTable>) : Index(url, glyphs) {
		override fun png(glyph: Int): ByteArray? = cbdtPng(this, glyph)
	}

	private val indexes = ConcurrentHashMap<String, Index>()

	/** No bitmap table: the emoji are drawn as vectors. */
	private class VectorFont : Exception("a vector font")

	/** A vector font up to this size is downloaded whole for its preview. */
	private const val VECTOR_LIMIT = 8L * 1024 * 1024
	private const val VECTOR_PX = 96
	private val pool = Executors.newFixedThreadPool(4) { Thread(it, "themes-emoji-preview").apply { isDaemon = true } }

	/** The extracted plugin ZIP, where bundled packs (`bundled:<file>`) live. */
	@Volatile var installDir: File? = null

	/** The address GitHub's release link redirects to, so every range request skips the redirect. */
	private fun resolve(url: String): String {
		installDir?.let { dir -> bundledFile(dir, url)?.let { return it.toURI().toString() } }
		var next = URL(url)
		repeat(6) {
			val c = next.openConnection() as HttpURLConnection
			c.instanceFollowRedirects = false
			c.requestMethod = "HEAD"
			c.connectTimeout = 15_000
			c.readTimeout = 15_000
			c.setRequestProperty("User-Agent", "bleelblep-themes")
			val code = c.responseCode
			val location = c.getHeaderField("Location")
			c.disconnect()
			if (code !in 300..399 || location == null) return next.toString()
			next = URL(next, location)
		}
		error("too many redirects")
	}

	private fun range(url: String, start: Long, length: Int): ByteBuffer {
		if (url.startsWith("file:")) {
			java.io.RandomAccessFile(File(java.net.URI(url)), "r").use { file ->
				val bytes = ByteArray(length)
				file.seek(start)
				file.readFully(bytes)
				return ByteBuffer.wrap(bytes)
			}
		}
		val c = URL(url).openConnection() as HttpURLConnection
		c.connectTimeout = 15_000
		c.readTimeout = 20_000
		c.setRequestProperty("User-Agent", "bleelblep-themes")
		c.setRequestProperty("Range", "bytes=$start-${start + length - 1}")
		try {
			if (c.responseCode != 206) error("HTTP ${c.responseCode} for a range")
			val bytes = c.inputStream.use { it.readBytes() }
			if (bytes.size < length) error("short read")
			return ByteBuffer.wrap(bytes)
		} finally {
			c.disconnect()
		}
	}

	private fun u16(b: ByteBuffer, at: Int) = b.getShort(at).toInt() and 0xffff
	private fun u32(b: ByteBuffer, at: Int) = b.getInt(at).toLong() and 0xffffffffL

	private fun index(id: String, link: String, wanted: Collection<Int>): Index {
		indexes[id]?.let { cached -> if (wanted.all { it in cached.glyphs }) return cached }
		val url = resolve(link)
		val head = range(url, 0, 16)
		val font = if (head.getInt(0) == 0x74746366 /* ttcf */) u32(head, 12) else 0L
		val count = u16(range(url, font + 4, 2), 0)
		val dir = range(url, font + 12, count * 16)
		val tables = HashMap<String, Pair<Long, Int>>()
		for (i in 0 until count) {
			val at = i * 16
			val tag = String(ByteArray(4) { dir.get(at + it) }, Charsets.ISO_8859_1)
			tables[tag] = u32(dir, at + 8) to u32(dir, at + 12).toInt()
		}
		val (cmapAt, cmapLength) = tables["cmap"] ?: error("no cmap")

		// cmap format 12: groups of (start, end, first glyph).
		val cmap = range(url, cmapAt, cmapLength)
		val glyphs = HashMap<Int, Int>()
		for (i in 0 until u16(cmap, 2)) {
			val sub = u32(cmap, 4 + i * 8 + 4).toInt()
			if (u16(cmap, sub) != 12) continue
			val groups = u32(cmap, sub + 12).toInt()
			for (g in 0 until groups) {
				val at = sub + 16 + g * 12
				val start = u32(cmap, at).toInt()
				val end = u32(cmap, at + 4).toInt()
				val first = u32(cmap, at + 8).toInt()
				for (cp in wanted) if (cp in start..end) glyphs[cp] = first + cp - start
			}
		}

		tables["sbix"]?.let { (sbixAt, _) -> return sbixIndex(id, url, sbixAt, glyphs) }
		val cblc = tables["CBLC"]
		val cbdt = tables["CBDT"]
		if (cblc != null && cbdt != null) return cbdtIndex(id, url, cblc, cbdt.first, glyphs)
		throw VectorFont()
	}

	private fun sbixIndex(id: String, url: String, sbixAt: Long, glyphs: Map<Int, Int>): Index {
		val strikes = u32(range(url, sbixAt + 4, 4), 0).toInt()
		val offsets = range(url, sbixAt + 8, strikes * 4)
		var best = -1L
		var bestPpem = 0
		for (i in 0 until strikes) {
			val at = u32(offsets, i * 4)
			val ppem = u16(range(url, sbixAt + at, 2), 0)
			val better = if (bestPpem > PPEM) ppem < bestPpem else ppem in (bestPpem + 1)..PPEM
			if (best < 0 || better) {
				best = at
				bestPpem = ppem
			}
		}
		if (best < 0) error("no strikes")
		return SbixIndex(url, glyphs, sbixAt + best).also { indexes[id] = it }
	}

	/** The CBLC strike nearest [PPEM], its index subtables read whole (CBLC is small). */
	private fun cbdtIndex(id: String, url: String, cblcTable: Pair<Long, Int>, cbdtAt: Long, glyphs: Map<Int, Int>): Index {
		val cblc = range(url, cblcTable.first, cblcTable.second)
		val sizes = u32(cblc, 4).toInt()
		var best = -1
		var bestPpem = 0
		for (i in 0 until sizes) {
			val ppem = cblc.get(8 + i * 48 + 44).toInt() and 0xff
			val better = if (bestPpem > PPEM) ppem < bestPpem else ppem in (bestPpem + 1)..PPEM
			if (best < 0 || better) {
				best = i
				bestPpem = ppem
			}
		}
		if (best < 0) error("no bitmap sizes")
		val size = 8 + best * 48
		val arrayAt = u32(cblc, size).toInt()
		val count = u32(cblc, size + 8).toInt()
		val subtables = (0 until count).map { i ->
			val entry = arrayAt + i * 8
			val at = arrayAt + u32(cblc, entry + 4).toInt()
			SubTable(u16(cblc, entry), u16(cblc, entry + 2), u16(cblc, at), u16(cblc, at + 2), u32(cblc, at + 4), cblc, at + 8)
		}
		return CbdtIndex(url, glyphs, cbdtAt, subtables).also { indexes[id] = it }
	}

	/** Where [glyph]'s image is in CBDT and how long, from its CBLC subtable. */
	private fun cbdtPng(index: CbdtIndex, glyph: Int): ByteArray? {
		val sub = index.subtables.firstOrNull { glyph in it.first..it.last } ?: return null
		val b = sub.data
		val n = glyph - sub.first
		val (start, length) = when (sub.indexFormat) {
			1 -> u32(b, sub.at + n * 4) to (u32(b, sub.at + n * 4 + 4) - u32(b, sub.at + n * 4)).toInt()
			3 -> u16(b, sub.at + n * 2).toLong() to (u16(b, sub.at + n * 2 + 2) - u16(b, sub.at + n * 2))
			2 -> {
				val imageSize = u32(b, sub.at).toInt()
				n.toLong() * imageSize to imageSize
			}
			4 -> {
				val count = u32(b, sub.at).toInt()
				val i = (0 until count).firstOrNull { u16(b, sub.at + 4 + it * 4) == glyph } ?: return null
				u16(b, sub.at + 4 + i * 4 + 2).toLong() to (u16(b, sub.at + 4 + (i + 1) * 4 + 2) - u16(b, sub.at + 4 + i * 4 + 2))
			}
			5 -> {
				val imageSize = u32(b, sub.at).toInt()
				val count = u32(b, sub.at + 12).toInt()
				val i = (0 until count).firstOrNull { u16(b, sub.at + 16 + it * 2) == glyph } ?: return null
				i.toLong() * imageSize to imageSize
			}
			else -> return null
		}
		if (length <= 0) return null
		val data = range(index.url, index.cbdt + sub.imageData + start, length)
		// 17: small metrics (5) + length; 18: big metrics (8) + length; 19: length only.
		val skip = when (sub.imageFormat) {
			17 -> 5
			18 -> 8
			19 -> 0
			else -> return null
		}
		val pngLength = u32(data, skip).toInt()
		if (pngLength <= 0 || skip + 4 + pngLength > length) return null
		return data.array().copyOfRange(skip + 4, skip + 4 + pngLength)
	}

	private fun sbixPng(index: SbixIndex, glyph: Int, hops: Int = 0): ByteArray? {
		val offsets = range(index.url, index.strike + 4 + glyph * 4L, 8)
		val start = u32(offsets, 0)
		val length = (u32(offsets, 4) - start).toInt()
		if (length <= 8) return null
		val data = range(index.url, index.strike + start, length)
		val type = String(ByteArray(4) { data.get(4 + it) }, Charsets.ISO_8859_1)
		return when {
			type == "png " -> data.array().copyOfRange(8, length)
			// A glyph drawn the same as another: its data is that glyph's id.
			type == "dupe" && hops < 2 -> sbixPng(index, u16(data, 8), hops + 1)
			else -> null
		}
	}

	/**
	 * `file://` URIs of [codepoints] in the pack (null where the pack has none), from the cache in
	 * [dir] or downloaded into it.
	 */
	fun preview(id: String, link: String, codepoints: List<Int>, dir: File): List<String?> {
		val folder = File(dir, id).apply { mkdirs() }
		fun fileOf(cp: Int) = File(folder, "${Integer.toHexString(cp)}.png")
		val missing = codepoints.filter { !fileOf(it).isFile }
		if (missing.isNotEmpty()) {
			val index = try {
				index(id, link, missing)
			} catch (_: VectorFont) {
				vectorPreview(link, missing, folder, ::fileOf)
				null
			}
			if (index != null) drawFrom(index, missing, folder, ::fileOf)
		}
		return codepoints.map { cp -> fileOf(cp).takeIf { it.isFile }?.let { "file://${it.absolutePath}" } }
	}

	private fun drawFrom(index: Index, missing: List<Int>, folder: File, fileOf: (Int) -> File) {
		run {
			val jobs = missing.mapNotNull { cp ->
				val glyph = index.glyphs[cp] ?: return@mapNotNull null
				pool.submit {
					runCatching {
						index.png(glyph)?.let { bytes ->
							val part = File(folder, "${Integer.toHexString(cp)}.part")
							part.writeBytes(bytes)
							part.renameTo(fileOf(cp))
						}
					}.onFailure { Emoji.recordError(it) }
				}
			}
			for (job in jobs) runCatching { job.get(30, TimeUnit.SECONDS) }
		}
	}

	/**
	 * A vector font's preview: the whole file (when small enough), then each emoji drawn by Android
	 * into a PNG. An emoji that comes out empty is skipped, so a font this phone can't draw shows no
	 * preview rather than blanks.
	 */
	@android.annotation.SuppressLint("NewApi")
	private fun vectorPreview(link: String, missing: List<Int>, folder: File, fileOf: (Int) -> File) {
		if (!Emoji.supported) return
		val url = resolve(link)
		val font = File(folder, "font.part")
		try {
			val c = URL(url).openConnection() as HttpURLConnection
			c.connectTimeout = 15_000
			c.readTimeout = 30_000
			c.setRequestProperty("User-Agent", "bleelblep-themes")
			try {
				if (c.responseCode != 200) error("HTTP ${c.responseCode}")
				if (c.contentLengthLong > VECTOR_LIMIT) return
				c.inputStream.use { input -> font.outputStream().use { input.copyTo(it) } }
			} finally {
				c.disconnect()
			}
			val family = android.graphics.fonts.FontFamily.Builder(android.graphics.fonts.Font.Builder(font).build()).build()
			val face = android.graphics.Typeface.CustomFallbackBuilder(family).build()
			for (cp in missing) {
				runCatching {
					val bitmap = android.graphics.Bitmap.createBitmap(VECTOR_PX, VECTOR_PX, android.graphics.Bitmap.Config.ARGB_8888)
					try {
						val text = String(Character.toChars(cp))
						EmojiDrawable(text, VECTOR_PX, face).apply { setBounds(0, 0, VECTOR_PX, VECTOR_PX) }.draw(android.graphics.Canvas(bitmap))
						val pixels = IntArray(VECTOR_PX * VECTOR_PX)
						bitmap.getPixels(pixels, 0, VECTOR_PX, 0, 0, VECTOR_PX, VECTOR_PX)
						if (pixels.none { (it ushr 24) > 16 }) return@runCatching
						val part = File(folder, "${Integer.toHexString(cp)}.part")
						part.outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
						part.renameTo(fileOf(cp))
					} finally {
						bitmap.recycle()
					}
				}.onFailure { Emoji.recordError(it) }
			}
		} finally {
			font.delete()
		}
	}
}
