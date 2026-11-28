package expo.modules.btshare

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream

class ObexException(message: String, val code: Int = -1) : Exception(message)

class ObexPacket(val code: Int, val body: ByteArray)

/**
 * عميل OBEX Object Push (OPP): البروتوكول الذي يستقبل به الكمبيوتر الملفات عبر البلوتوث.
 * كلاس بدون أي اعتماد على أندرويد حتى يمكن اختباره على JVM.
 */
class ObexClient(
    private val input: InputStream,
    private val output: OutputStream,
    private val wantedMaxPacket: Int = 0x2000,
) {
    /** أكبر حزمة يقبلها الجهاز المقابل (تُحدَّث بعد CONNECT) */
    var maxPacket: Int = 255
        private set

    companion object {
        const val OP_CONNECT = 0x80
        const val OP_DISCONNECT = 0x81
        const val OP_PUT = 0x02
        const val OP_PUT_FINAL = 0x82
        const val OP_ABORT = 0xFF
        const val RSP_CONTINUE = 0x90
        const val RSP_OK = 0xA0
        const val HDR_NAME = 0x01
        const val HDR_LENGTH = 0xC3
        const val HDR_BODY = 0x48
        const val HDR_END_OF_BODY = 0x49

        fun nameHeader(name: String): ByteArray {
            val chars = (name + "\u0000").toByteArray(Charsets.UTF_16BE)
            val len = 3 + chars.size
            val out = ByteArrayOutputStream()
            out.write(HDR_NAME); out.write(len shr 8); out.write(len and 0xFF); out.write(chars)
            return out.toByteArray()
        }

        fun lengthHeader(size: Long): ByteArray {
            val v = size.coerceIn(0L, 0xFFFFFFFFL)
            return byteArrayOf(
                HDR_LENGTH.toByte(),
                (v shr 24).toByte(), (v shr 16).toByte(), (v shr 8).toByte(), v.toByte(),
            )
        }

        fun bodyHeader(data: ByteArray, end: Boolean): ByteArray {
            val len = 3 + data.size
            val out = ByteArrayOutputStream(len)
            out.write(if (end) HDR_END_OF_BODY else HDR_BODY)
            out.write(len shr 8); out.write(len and 0xFF); out.write(data)
            return out.toByteArray()
        }

        fun packet(opcode: Int, headers: ByteArray): ByteArray {
            val len = 3 + headers.size
            require(len <= 0xFFFF) { "packet too large" }
            val out = ByteArrayOutputStream(len)
            out.write(opcode); out.write(len shr 8); out.write(len and 0xFF); out.write(headers)
            return out.toByteArray()
        }

        fun connectPacket(maxPacket: Int): ByteArray =
            byteArrayOf(
                OP_CONNECT.toByte(), 0x00, 0x07, 0x10, 0x00,
                (maxPacket shr 8).toByte(), maxPacket.toByte(),
            )
    }

    private fun readFully(n: Int): ByteArray {
        val buf = ByteArray(n)
        var off = 0
        while (off < n) {
            val r = input.read(buf, off, n - off)
            if (r < 0) throw ObexException("انقطع الاتصال بالكمبيوتر")
            off += r
        }
        return buf
    }

    fun readPacket(): ObexPacket {
        val head = readFully(3)
        val code = head[0].toInt() and 0xFF
        val len = ((head[1].toInt() and 0xFF) shl 8) or (head[2].toInt() and 0xFF)
        if (len < 3) throw ObexException("حزمة غير صالحة من الكمبيوتر")
        return ObexPacket(code, readFully(len - 3))
    }

    private fun send(bytes: ByteArray) { output.write(bytes); output.flush() }

    fun connect() {
        send(connectPacket(wantedMaxPacket))
        val r = readPacket()
        if (r.code != RSP_OK) throw ObexException("الكمبيوتر رفض الاتصال (0x${r.code.toString(16)})", r.code)
        // الجسم: [version, flags, maxPacketHi, maxPacketLo, ...]
        if (r.body.size >= 4) {
            val m = ((r.body[2].toInt() and 0xFF) shl 8) or (r.body[3].toInt() and 0xFF)
            maxPacket = m.coerceIn(255, 0xFFFF)
        }
        maxPacket = minOf(maxPacket, wantedMaxPacket)
    }

    private fun readUpTo(src: InputStream, n: Int): ByteArray {
        val buf = ByteArray(n)
        var off = 0
        while (off < n) {
            val r = src.read(buf, off, n - off)
            if (r < 0) break
            off += r
        }
        return if (off == n) buf else buf.copyOf(off)
    }

    /**
     * يرسل ملفاً كاملاً. size = -1 إذا كان الحجم غير معروف.
     * progress تُستدعى بعدد البايتات المرسلة، وisCancelled للإلغاء.
     */
    fun put(
        name: String,
        size: Long,
        source: InputStream,
        progress: (Long) -> Unit = {},
        isCancelled: () -> Boolean = { false },
    ) {
        val firstHeaders = nameHeader(name) + (if (size >= 0) lengthHeader(size) else ByteArray(0))
        val chunkFirst = maxPacket - (3 + firstHeaders.size + 3)
        val chunkNext = maxPacket - (3 + 3)
        if (chunkFirst < 1) throw ObexException("اسم الملف طويل جداً")

        var first = true
        var sent = 0L
        var cur = readUpTo(source, chunkFirst)
        while (true) {
            if (isCancelled()) { abort(); throw ObexException("تم الإلغاء") }
            val curCap = if (first) chunkFirst else chunkNext
            val next = if (cur.size == curCap) readUpTo(source, chunkNext) else ByteArray(0)
            val last = next.isEmpty()
            val headers = (if (first) firstHeaders else ByteArray(0)) + bodyHeader(cur, last)
            send(packet(if (last) OP_PUT_FINAL else OP_PUT, headers))
            val r = readPacket()
            val expected = if (last) RSP_OK else RSP_CONTINUE
            if (r.code != expected) throw ObexException("الكمبيوتر رفض الملف (0x${r.code.toString(16)})", r.code)
            sent += cur.size
            progress(sent)
            if (last) break
            cur = next
            first = false
        }
    }

    fun abort() {
        try { send(packet(OP_ABORT, ByteArray(0))); readPacket() } catch (_: Exception) {}
    }

    fun disconnect() {
        try { send(packet(OP_DISCONNECT, ByteArray(0))); readPacket() } catch (_: Exception) {}
    }
}
