@file:JvmName("ThemesPlugin")

package com.bleelblep.themes

import android.graphics.Typeface
import io.github.revenge.plugins.plugin
import io.github.revenge.xposed.api.registerNativeAsyncMethod
import io.github.revenge.xposed.api.registerNativeMethod
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Themes' native half: emoji packs only (Emoji.kt). Colours, fonts and icon packs are all JS.
 *
 * JS owns the list of packs and their links; native downloads the files (13-65 MB, too big for a
 * base64 round trip through JS), keeps them in `<storageDir>/emoji/<id>.ttc`, and remembers the one
 * in use in `emoji.json` so it is loaded at process start, before Discord builds a typeface.
 */

private const val SELECTION_FILE = "emoji.json"

private object Download {
	@Volatile var id: String? = null
	@Volatile var bytes = 0L
	@Volatile var total = 0L
	@Volatile var error: String? = null
	@Volatile var cancelled = false
}

/** Streams [url] into [target] through a `.part` file, following redirects; [progress] gets the
 * bytes and the total as they arrive, and [cancelled] may end it early. */
private fun fetchTo(
	url: String,
	target: File,
	progress: ((bytes: Long, total: Long) -> Unit)? = null,
	cancelled: () -> Boolean = { false },
) {
	val part = File(target.parentFile, "${target.name}.part")
	var next = URL(url)
	var connection: HttpURLConnection
	var hops = 0
	while (true) {
		connection = next.openConnection() as HttpURLConnection
		connection.instanceFollowRedirects = false
		connection.connectTimeout = 20_000
		connection.readTimeout = 30_000
		connection.setRequestProperty("User-Agent", "bleelblep-themes")
		val code = connection.responseCode
		if (code in 300..399) {
			val location = connection.getHeaderField("Location") ?: error("HTTP $code without a location")
			connection.disconnect()
			next = URL(next, location)
			if (++hops > 6) error("too many redirects")
			continue
		}
		if (code != 200) error("HTTP $code")
		break
	}
	val total = connection.contentLengthLong.coerceAtLeast(0)
	var bytes = 0L
	progress?.invoke(bytes, total)
	try {
		connection.inputStream.use { input ->
			part.outputStream().use { output ->
				val buffer = ByteArray(64 * 1024)
				while (true) {
					if (cancelled()) error("cancelled")
					val read = input.read(buffer)
					if (read < 0) break
					output.write(buffer, 0, read)
					bytes += read
					progress?.invoke(bytes, total)
				}
			}
		}
		if (total > 0 && part.length() != total) error("download was cut short")
		if (!part.renameTo(target)) {
			part.copyTo(target, overwrite = true)
			part.delete()
		}
	} finally {
		connection.disconnect()
		if (part.exists()) part.delete()
	}
}

/** An emoji pack's download, its progress in [Download] for `emojiState`. */
private fun download(url: String, target: File) {
	fetchTo(
		url,
		target,
		progress = { bytes, total ->
			Download.bytes = bytes
			Download.total = total
		},
		cancelled = { Download.cancelled },
	)
}

private val safeId = Regex("^[a-z0-9-]{1,40}$")

/** A short name for [text]'s preview files and font family, safe for React Native. */
private fun fontHash(text: String): String {
	var hash = 5381
	for (char in text) hash = (hash * 33) xor char.code
	return (hash and 0x7fffffff).toString(36)
}

/** A pack that ships inside the plugin ZIP (`assets/emoji/<file>`), not one on the web. */
internal const val BUNDLED = "bundled:"
private val safeFile = Regex("^[A-Za-z0-9._-]{1,60}$")

/** [link] as a file in the extracted ZIP when it names a bundled pack, else null. */
internal fun bundledFile(installDir: File, link: String): File? {
	if (!link.startsWith(BUNDLED)) return null
	val name = link.removePrefix(BUNDLED)
	require(safeFile.matches(name)) { "bad bundled file" }
	return File(installDir, "emoji/$name")
}

val themesPlugin = plugin {
	start {
		val dir = File(storageDir, "emoji").apply { mkdirs() }
		// The extracted plugin ZIP. RevengeXposed 1.7.1 (API 1.1.0) names it `pluginDir`; read by
		// reflection so older hosts, where it sits at the same place, still work.
		val installDir: File = runCatching { javaClass.getMethod("getPluginDir").invoke(this) as File }
			.getOrElse { File(appInfo.dataDir, "files/revenge/plugins/dist/${manifest.id}") }
		Preview.installDir = installDir
		val selection = File(storageDir, SELECTION_FILE)
		fun fileOf(id: String) = File(dir, "$id.ttc")
		fun installed() = dir.listFiles()?.filter { it.name.endsWith(".ttc") }?.map { it.name.removeSuffix(".ttc") } ?: emptyList()
		fun selected(): String? = runCatching { JSONObject(selection.readText()).optString("pack").ifEmpty { null } }.getOrNull()
		fun save(id: String?, scale: Float) = runCatching {
			selection.writeText(
				JSONObject()
					.put("pack", id ?: "")
					.put("scale", scale.toDouble())
					.toString(),
			)
		}.onFailure { log.w("could not save the emoji settings: ${it.message}") }
		fun saveSelected(id: String?) = save(id, Emoji.scale)
		Emoji.scale = runCatching { JSONObject(selection.readText()).optDouble("scale", 1.0).toFloat() }.getOrDefault(1f)
			.coerceIn(0.5f, 3f)

		// The pack chosen last time, before Discord builds any typeface.
		val atStart = selected()
		if (atStart != null && !Emoji.use(atStart, fileOf(atStart), atStart = true)) {
			log.w("emoji pack $atStart did not load; Discord's emoji stay")
		}
		if (Emoji.supported) {
			runCatching { Emoji.installText() }.onFailure { Emoji.recordError(it); log.w("emoji text hooks: $it") }
			runCatching { Emoji.installMessages(classLoader) }.onFailure { Emoji.recordError(it); log.w("emoji message hooks: $it") }
			runCatching { Emoji.installPicker(classLoader) }.onFailure { Emoji.recordError(it); log.w("emoji picker hooks: $it") }
		}

		fun state(): Map<String, Any?> = Emoji.status() + mapOf(
			"installed" to installed(),
			"selected" to selected(),
			"downloading" to Download.id,
			"bytes" to Download.bytes.toDouble(),
			"total" to Download.total.toDouble(),
			"downloadError" to Download.error,
		)

		registerNativeMethod("${manifest.id}.emojiState") { _ -> state() }

		// [id, url]: starts a download in the background; poll emojiState for progress.
		registerNativeMethod("${manifest.id}.emojiDownload") { args ->
			val id = args.getOrNull(0) as? String ?: error("no pack id")
			val url = args.getOrNull(1) as? String ?: error("no link")
			require(safeId.matches(id)) { "bad pack id" }
			val bundled = bundledFile(installDir, url)
			require(bundled != null || url.startsWith("https://")) { "links must be https" }
			if (Download.id != null) error("another pack is downloading")
			if (bundled != null) {
				// Already on the phone: a copy, no download.
				Download.error = null
				runCatching {
					require(bundled.isFile) { "this Themes build is missing ${bundled.name}" }
					val part = File(dir, "$id.ttc.part")
					bundled.copyTo(part, overwrite = true)
					if (!part.renameTo(fileOf(id))) {
						part.copyTo(fileOf(id), overwrite = true)
						part.delete()
					}
				}.onFailure {
					Download.error = it.message ?: it.javaClass.simpleName
					log.w("emoji pack $id copy failed: ${Download.error}")
				}
				return@registerNativeMethod state()
			}
			Download.id = id
			Download.bytes = 0
			Download.total = 0
			Download.error = null
			Download.cancelled = false
			Thread({
				try {
					download(url, fileOf(id))
				} catch (error: Throwable) {
					Download.error = error.message ?: error.javaClass.simpleName
					log.w("emoji pack $id download failed: ${Download.error}")
				} finally {
					Download.id = null
				}
			}, "themes-emoji-download").apply { isDaemon = true }.start()
			state()
		}

		registerNativeMethod("${manifest.id}.emojiCancel") { _ ->
			Download.cancelled = true
			state()
		}

		// [id or null]: uses a downloaded pack now (messages, reactions, picker) and from the next
		// start (text). Returns the state, with `probe` saying whether this phone can draw it.
		registerNativeMethod("${manifest.id}.emojiSelect") { args ->
			val id = (args.getOrNull(0) as? String)?.takeIf { it.isNotEmpty() }
			if (id == null) {
				Emoji.use(null, null)
				saveSelected(null)
				Emoji.clearReactFontCache(classLoader)
				return@registerNativeMethod state()
			}
			require(safeId.matches(id)) { "bad pack id" }
			val file = fileOf(id)
			if (!file.isFile) error("that pack isn't downloaded")
			if (!Emoji.use(id, file)) error("couldn't load that pack's font")
			val probe = Emoji.probe()
			if (probe["ok"] != true) {
				// This phone can't draw it: go back to what was in use, and say so.
				val previous = selected()
				Emoji.use(previous, previous?.let(::fileOf))
				return@registerNativeMethod state() + mapOf("probe" to probe)
			}
			saveSelected(id)
			Emoji.clearReactFontCache(classLoader)
			state() + mapOf("probe" to probe)
		}

		registerNativeMethod("${manifest.id}.emojiRemove") { args ->
			val id = args.getOrNull(0) as? String ?: error("no pack id")
			require(safeId.matches(id)) { "bad pack id" }
			if (selected() == id) {
				Emoji.use(null, null)
				saveSelected(null)
			}
			fileOf(id).delete()
			state()
		}

		// [scale]: message emoji size, 1 = Discord's. Rows drawn afterwards use it.
		registerNativeMethod("${manifest.id}.emojiScale") { args ->
			val value = (args.getOrNull(0) as? Number)?.toFloat() ?: 1f
			Emoji.scale = value.coerceIn(0.5f, 3f)
			save(selected(), Emoji.scale)
			state()
		}

		// [id, url, codepoints]: file:// URIs of those emoji in a pack that needn't be downloaded
		// (Preview.kt reads them out of the font on GitHub); null where the pack has none.
		val previews = File(storageDir, "emoji-previews")
		registerNativeAsyncMethod("${manifest.id}.emojiPreview") { args ->
			val id = args.getOrNull(0) as? String ?: error("no pack id")
			val url = args.getOrNull(1) as? String ?: error("no link")
			require(safeId.matches(id)) { "bad pack id" }
			require(url.startsWith(BUNDLED) || url.startsWith("https://")) { "links must be https" }
			val codepoints = (args.getOrNull(2) as? List<*>)?.mapNotNull { (it as? Number)?.toInt() }?.take(24) ?: emptyList()
			Preview.preview(id, url, codepoints, previews)
		}

		registerNativeMethod("${manifest.id}.emojiProbe") { _ -> Emoji.probe() }

		/** Gives React Native [family], drawing with [face]; false when its font manager can't be reached. */
		fun registerRnFamily(family: String, face: Typeface): Boolean {
			return runCatching {
				val manager = classLoader.loadClass("com.facebook.react.common.assets.ReactFontManager")
				val instance = runCatching { manager.getMethod("getInstance").invoke(null) }.getOrNull()
					?: manager.getField("Companion").get(null).let { it.javaClass.getMethod("getInstance").invoke(it) }
				manager.getMethod("addCustomFont", String::class.java, Typeface::class.java).invoke(instance, family, face)
				true
			}.getOrElse {
				log.w("could not give React Native the $family font: ${it.message}")
				false
			}
		}

		// [id, texts]: { family, checked, covered[] } for a downloaded pack's All emoji page. `family`
		// is a React Native font family that draws only that pack (registered here), so the page
		// shows the pack's own art whether or not it's in use; `checked` is false where this phone
		// can't tell what the pack is missing, and then every emoji counts as covered.
		val looked = HashMap<String, Pair<Long, Emoji.Standalone>>()
		registerNativeAsyncMethod("${manifest.id}.emojiCoverage") { args ->
			val id = args.getOrNull(0) as? String ?: error("no pack id")
			require(safeId.matches(id)) { "bad pack id" }
			val texts = (args.getOrNull(1) as? List<*>).orEmpty().filterIsInstance<String>().take(6000)
			val file = fileOf(id)
			require(file.isFile) { "that pack isn't downloaded" }
			val pack = synchronized(looked) {
				looked[id]?.takeIf { it.first == file.lastModified() }?.second
					?: Emoji.standalone(file).also { looked[id] = file.lastModified() to it }
			}
			val family = "bleelblep-themes-emoji-$id"
			val registered = registerRnFamily(family, pack.face)
			val covered = Emoji.coverageOf(pack, texts)
			mapOf(
				"family" to family.takeIf { registered },
				"checked" to (covered != null),
				"covered" to (covered ?: texts.map { true }),
			)
		}

		// [id, url]: a React Native font family that draws an installed font's regular weight, so its
		// preview shows before the font is in use (fonts only reach Discord's text after a reload). The
		// file is downloaded fresh each session, like the WebView preview's own fetch.
		val fontPreviewDir = File(storageDir, "font-previews").apply { mkdirs() }
		val fontPreviewNames = HashMap<String, String>()
		registerNativeAsyncMethod("${manifest.id}.fontPreview") { args ->
			val id = args.getOrNull(0) as? String ?: error("no font id")
			val url = args.getOrNull(1) as? String ?: error("no link")
			require(url.startsWith("https://")) { "links must be https" }
			fontPreviewNames[id]?.let { return@registerNativeAsyncMethod it }
			val name = fontHash(id)
			val ext = if (url.substringBefore('?').substringBefore('#').endsWith(".otf", ignoreCase = true)) ".otf" else ".ttf"
			val file = File(fontPreviewDir, "$name$ext")
			fetchTo(url, file)
			val family = "bleelblep-themes-font-$name"
			if (!registerRnFamily(family, Emoji.standalone(file).face)) error("couldn't register the preview font")
			fontPreviewNames[id] = family
			family
		}

		// [text, pixels]: a PNG data URI of one emoji in the pack, for JS-drawn emoji.
		registerNativeMethod("${manifest.id}.emojiArtwork") { args ->
			val text = args.getOrNull(0) as? String ?: return@registerNativeMethod null
			val size = (args.getOrNull(1) as? Number)?.toInt() ?: return@registerNativeMethod null
			Emoji.artwork(text, size)
		}
	}

	stop {
		Download.cancelled = true
		Emoji.uninstall()
		Emoji.use(null, null)
		registerNativeMethod("${manifest.id}.emojiState") { _ -> mapOf("supported" to false) }
		registerNativeMethod("${manifest.id}.emojiArtwork") { _ -> null }
	}
}
