package expo.modules.atvremote

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream

/** كاتب protobuf بسيط (بنمط proto3: القيم الصفرية لا تُكتب). */
class PbWriter {
    private val out = ByteArrayOutputStream()

    fun varint(value: Long) {
        var v = value
        while (true) {
            if (v and 0x7FL.inv() == 0L) { out.write(v.toInt()); return }
            out.write(((v and 0x7F) or 0x80).toInt())
            v = v ushr 7
        }
    }
    private fun tag(field: Int, wire: Int) = varint(((field shl 3) or wire).toLong())

    fun int(field: Int, v: Int): PbWriter { if (v != 0) { tag(field, 0); varint(v.toLong()) }; return this }
    fun bool(field: Int, v: Boolean): PbWriter { if (v) { tag(field, 0); varint(1) }; return this }
    fun string(field: Int, s: String): PbWriter { if (s.isNotEmpty()) bytes(field, s.toByteArray(Charsets.UTF_8)); return this }
    fun bytes(field: Int, b: ByteArray): PbWriter { tag(field, 2); varint(b.size.toLong()); out.write(b); return this }
    /** رسالة متداخلة: تُكتب دائماً حتى لو كانت فارغة، مثل Python عند الإسناد إلى حقل فرعي */
    fun msg(field: Int, build: PbWriter.() -> Unit): PbWriter { bytes(field, PbWriter().apply(build).toByteArray()); return this }
    fun toByteArray(): ByteArray = out.toByteArray()
}

class PbField(val number: Int, val wire: Int, val value: Long, val data: ByteArray?)

/** قارئ protobuf: يرجع كل الحقول على المستوى الأول */
class PbMessage(raw: ByteArray) {
    val fields = ArrayList<PbField>()
    init {
        var i = 0
        fun varint(): Long {
            var shift = 0; var r = 0L
            while (true) {
                if (i >= raw.size) throw IllegalArgumentException("truncated varint")
                val b = raw[i++].toInt() and 0xFF
                r = r or ((b and 0x7F).toLong() shl shift)
                if (b and 0x80 == 0) return r
                shift += 7
                if (shift > 63) throw IllegalArgumentException("varint too long")
            }
        }
        while (i < raw.size) {
            val t = varint().toInt()
            val num = t ushr 3
            when (t and 7) {
                0 -> fields.add(PbField(num, 0, varint(), null))
                1 -> { if (i + 8 > raw.size) throw IllegalArgumentException("truncated"); fields.add(PbField(num, 1, 0, raw.copyOfRange(i, i + 8))); i += 8 }
                2 -> { val n = varint().toInt(); if (n < 0 || i + n > raw.size) throw IllegalArgumentException("truncated"); fields.add(PbField(num, 2, 0, raw.copyOfRange(i, i + n))); i += n }
                5 -> { if (i + 4 > raw.size) throw IllegalArgumentException("truncated"); fields.add(PbField(num, 5, 0, raw.copyOfRange(i, i + 4))); i += 4 }
                else -> throw IllegalArgumentException("bad wire type")
            }
        }
    }
    fun has(n: Int) = fields.any { it.number == n }
    fun int(n: Int): Int = fields.lastOrNull { it.number == n && it.wire == 0 }?.value?.toInt() ?: 0
    fun bool(n: Int): Boolean = int(n) != 0
    fun bytes(n: Int): ByteArray? = fields.lastOrNull { it.number == n && it.wire == 2 }?.data
    fun string(n: Int): String = bytes(n)?.toString(Charsets.UTF_8) ?: ""
    fun msg(n: Int): PbMessage? = bytes(n)?.let { PbMessage(it) }
}

/** كل رسالة: طول (varint) ثم المحتوى */
object Frames {
    fun write(out: OutputStream, payload: ByteArray) {
        val w = PbWriter(); w.varint(payload.size.toLong())
        out.write(w.toByteArray()); out.write(payload); out.flush()
    }

    fun read(inp: InputStream): ByteArray {
        var shift = 0; var len = 0L
        while (true) {
            val b = inp.read()
            if (b < 0) throw java.io.EOFException("closed")
            len = len or ((b and 0x7F).toLong() shl shift)
            if (b and 0x80 == 0) break
            shift += 7
            if (shift > 35) throw java.io.IOException("bad length")
        }
        if (len < 0 || len > 1_000_000) throw java.io.IOException("bad frame length $len")
        val buf = ByteArray(len.toInt())
        var off = 0
        while (off < buf.size) {
            val r = inp.read(buf, off, buf.size - off)
            if (r < 0) throw java.io.EOFException("closed")
            off += r
        }
        return buf
    }
}
