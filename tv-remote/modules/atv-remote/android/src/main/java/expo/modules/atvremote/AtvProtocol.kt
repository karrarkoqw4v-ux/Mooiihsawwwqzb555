package expo.modules.atvremote

import java.math.BigInteger
import java.security.MessageDigest

/** بروتوكول الاقتران (Polo) مع Android TV على المنفذ 6467. متحقق منه مقابل مكتبة androidtvremote2. */
object Polo {
    const val STATUS_OK = 200
    const val ENC_HEX = 3
    const val ROLE_INPUT = 1

    private fun outer(build: PbWriter.() -> Unit): ByteArray =
        PbWriter().apply { int(1, 2); int(2, STATUS_OK); build() }.toByteArray()

    fun pairingRequest(clientName: String): ByteArray = outer { msg(10) { string(1, "atvremote"); string(2, clientName) } }

    fun options(): ByteArray = outer {
        msg(20) {
            msg(1) { int(1, ENC_HEX); int(2, 6) }
            int(3, ROLE_INPUT)
        }
    }

    fun configuration(): ByteArray = outer {
        msg(30) {
            msg(1) { int(1, ENC_HEX); int(2, 6) }
            int(2, ROLE_INPUT)
        }
    }

    fun secret(hash: ByteArray): ByteArray = outer { msg(40) { bytes(1, hash) } }

    enum class Kind { PAIRING_REQUEST_ACK, OPTIONS, CONFIGURATION_ACK, SECRET_ACK, ERROR, OTHER }

    fun kindOf(raw: ByteArray): Kind {
        val m = PbMessage(raw)
        if (m.int(2) != STATUS_OK) return Kind.ERROR
        return when {
            m.has(11) -> Kind.PAIRING_REQUEST_ACK
            m.has(20) -> Kind.OPTIONS
            m.has(31) -> Kind.CONFIGURATION_ACK
            m.has(41) -> Kind.SECRET_ACK
            else -> Kind.OTHER
        }
    }

    private fun bigBytes(v: BigInteger): ByteArray {
        val b = v.toByteArray()
        return if (b.size > 1 && b[0] == 0.toByte()) b.copyOfRange(1, b.size) else b   // بدون صفر البداية
    }

    /**
     * يحسب السر من شهادتي الطرفين والرمز الظاهر على التلفزيون (6 خانات hex).
     * يرجع null إذا كان الرمز خاطئاً (البايت الأول هو checksum).
     */
    fun computeSecret(clientMod: BigInteger, clientExp: BigInteger, serverMod: BigInteger, serverExp: BigInteger, code: String): ByteArray? {
        val c = code.trim()
        if (c.length != 6 || !c.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) return null
        val md = MessageDigest.getInstance("SHA-256")
        md.update(bigBytes(clientMod)); md.update(bigBytes(clientExp))
        md.update(bigBytes(serverMod)); md.update(bigBytes(serverExp))
        md.update(ByteArray(2) { i -> c.substring(2 + i * 2, 4 + i * 2).toInt(16).toByte() })
        val h = md.digest()
        return if ((h[0].toInt() and 0xFF) == c.substring(0, 2).toInt(16)) h else null
    }
}

/** بروتوكول التحكم (المنفذ 6466): مفاتيح، نص، تشغيل تطبيقات، لوحة المفاتيح. */
class AtvRemoteSession(private val send: (ByteArray) -> Unit, private val listener: Listener) {
    interface Listener {
        fun onStarted(on: Boolean) {}
        fun onKeyboard(text: String) {}
        fun onError() {}
    }

    companion object {
        const val F_PING = 1
        const val F_KEY = 2
        const val F_IME = 4
        const val F_POWER = 32
        const val F_VOLUME = 64
        const val F_APP_LINK = 512
        const val ALL = F_PING or F_KEY or F_IME or F_POWER or F_VOLUME or F_APP_LINK
        const val DIR_SHORT = 3
    }

    private var features = ALL
    @Volatile var imeCounter = 0
    @Volatile var fieldCounter = 0
    @Volatile var started = false
    @Volatile var configured = false
    var model: String = ""
    var vendor: String = ""

    fun handle(raw: ByteArray) {
        val m = try { PbMessage(raw) } catch (_: Exception) { return }
        when {
            m.has(1) -> { // remote_configure
                val cfg = m.msg(1)!!
                val info = cfg.msg(2)
                model = info?.string(1) ?: ""; vendor = info?.string(2) ?: ""
                features = features and cfg.int(1)
                configured = true
                send(PbWriter().msg(1) {
                    int(1, features)
                    msg(2) { int(3, 1); string(4, "1"); string(5, "atvremote"); string(6, "1.0.0") }
                }.toByteArray())
            }
            m.has(2) -> send(PbWriter().msg(2) { int(1, features) }.toByteArray())          // remote_set_active
            m.has(20) -> {                                                                   // remote_ime_key_inject
                val inj = m.msg(20)!!
                imeCounter = inj.msg(1)?.int(1) ?: imeCounter
                val tf = inj.msg(2)
                fieldCounter = tf?.int(1) ?: fieldCounter
                listener.onKeyboard(tf?.string(2) ?: "")
            }
            m.has(22) -> {                                                                   // remote_ime_show_request
                val tf = m.msg(22)!!.msg(2)
                if (tf != null) fieldCounter = tf.int(1)
                listener.onKeyboard(tf?.string(2) ?: "")
            }
            m.has(21) -> {                                                                   // remote_ime_batch_edit
                val b = m.msg(21)!!
                if (imeCounter == 0) imeCounter = b.int(1)
                if (fieldCounter == 0) fieldCounter = b.int(2)
            }
            m.has(40) -> { started = m.msg(40)!!.bool(1); listener.onStarted(started) }      // remote_start
            m.has(8) -> send(PbWriter().msg(9) { int(1, m.msg(8)!!.int(1)) }.toByteArray())  // ping -> pong
            m.has(3) -> listener.onError()                                                  // remote_error
        }
    }

    fun sendKey(code: Int, direction: Int = DIR_SHORT) {
        send(PbWriter().msg(10) { int(1, code); int(2, direction) }.toByteArray())
    }

    fun sendText(text: String) {
        if (text.isEmpty()) return
        val len = text.length
        send(PbWriter().msg(21) {
            int(1, imeCounter); int(2, fieldCounter)
            msg(3) { int(1, 1); msg(2) { int(1, len); int(2, len); string(3, text) } }
        }.toByteArray())
    }

    fun launch(appLink: String) {
        send(PbWriter().msg(90) { string(1, appLink) }.toByteArray())
    }
}
