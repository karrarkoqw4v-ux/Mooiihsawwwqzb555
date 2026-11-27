package com.rootmaster.app.root

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.rootmaster.app.core.AppLog
import com.rootmaster.engine.Integrity
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

data class MagiskRelease(val tag: String, val assetName: String, val url: String, val size: Long, val digest: String?)

sealed interface DownloadResult {
    data class Verified(val file: File, val sha256: String) : DownloadResult
    data class Failed(val reason: String) : DownloadResult
}

/**
 * Fetches the official Magisk app from the project's GitHub releases only. A file is handed to the
 * system installer only if its SHA-256 matches the digest published by GitHub for that asset.
 */
object MagiskInstaller {
    private const val API = "https://api.github.com/repos/topjohnwu/Magisk/releases/latest"
    private const val URL_PREFIX = "https://github.com/topjohnwu/Magisk/releases/download/"
    private const val UA = "RootMaster-Android"

    fun fetchLatest(): MagiskRelease? {
        val c = open(API)
        try {
            if (c.responseCode != 200) { AppLog.error("GitHub API HTTP ${c.responseCode}"); return null }
            val json = JSONObject(c.inputStream.bufferedReader().readText())
            val assets = json.getJSONArray("assets")
            for (i in 0 until assets.length()) {
                val a = assets.getJSONObject(i)
                val name = a.getString("name")
                val url = a.getString("browser_download_url")
                if (name.startsWith("Magisk-") && name.endsWith(".apk") && url.startsWith(URL_PREFIX)) {
                    val digest = if (a.has("digest") && !a.isNull("digest")) a.getString("digest") else null
                    return MagiskRelease(json.getString("tag_name"), name, url, a.getLong("size"), digest)
                }
            }
            AppLog.error("No official Magisk APK asset found in latest release")
            return null
        } catch (e: Exception) {
            AppLog.error("Release lookup failed: ${e.message}")
            return null
        } finally { c.disconnect() }
    }

    fun download(ctx: Context, rel: MagiskRelease, onProgress: (done: Long, total: Long) -> Unit): DownloadResult {
        if (rel.digest.isNullOrBlank())
            return DownloadResult.Failed("GitHub published no SHA-256 digest for this asset; integrity cannot be verified, so it will not be installed")
        if (!rel.url.startsWith(URL_PREFIX)) return DownloadResult.Failed("Unexpected download host")
        val dir = File(ctx.cacheDir, "magisk").apply { mkdirs() }
        val out = File(dir, rel.assetName)
        val md = MessageDigest.getInstance("SHA-256")
        val c = open(rel.url)
        try {
            if (c.responseCode != 200) return DownloadResult.Failed("HTTP ${c.responseCode}")
            val total = c.contentLengthLong.takeIf { it > 0 } ?: rel.size
            var done = 0L
            c.inputStream.use { ins -> out.outputStream().use { os ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                    val n = ins.read(buf); if (n < 0) break
                    os.write(buf, 0, n); md.update(buf, 0, n); done += n
                    onProgress(done, total)
                }
            } }
            val hex = md.digest().joinToString("") { "%02x".format(it) }
            if (!Integrity.digestMatches(rel.digest, hex)) {
                out.delete()
                return DownloadResult.Failed("SHA-256 mismatch (expected ${rel.digest}, got $hex); file deleted")
            }
            return DownloadResult.Verified(out, hex)
        } catch (e: Exception) {
            out.delete()
            return DownloadResult.Failed(e.message ?: e.javaClass.simpleName)
        } finally { c.disconnect() }
    }

    fun installIntent(ctx: Context, apk: File): Intent {
        val uri: Uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", apk)
        return Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    private fun open(url: String): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 15_000; readTimeout = 30_000; instanceFollowRedirects = true
        setRequestProperty("User-Agent", UA); setRequestProperty("Accept", "application/vnd.github+json")
    }
}
