package expo.modules.atvremote

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.math.BigInteger
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Principal
import java.security.PrivateKey
import java.security.cert.X509Certificate
import java.security.interfaces.RSAPublicKey
import java.util.Date
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.net.ssl.KeyManager
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.X509ExtendedKeyManager
import javax.net.ssl.X509TrustManager
import javax.security.auth.x500.X500Principal
import kotlin.concurrent.thread

/**
 * اتصال حقيقي بتلفزيونات Android TV / Google TV (بروتوكول Android TV Remote v2):
 * اكتشاف في الشبكة، اقتران برمز يظهر على التلفزيون، ثم تحكم كامل + لوحة مفاتيح.
 */
class AtvRemoteModule : Module() {
    private val alias = "tvraymond_atv_client"

    private class Control(val socket: SSLSocket, val session: AtvRemoteSession)

    @Volatile private var pairSocket: SSLSocket? = null
    @Volatile private var control: Control? = null

    private fun ctx(): Context = appContext.reactContext ?: throw IllegalStateException("no context")

    // ---------- مفتاح وشهادة هذا الجهاز (تُحفظ في ملفات التطبيق) ----------
    @Volatile private var cached: KeyStore? = null
    @Synchronized private fun keyStore(): KeyStore {
        cached?.let { return it }
        val dir = ctx().filesDir
        val kf = java.io.File(dir, "atv_key.der"); val cf = java.io.File(dir, "atv_cert.der")
        var key: PrivateKey? = null; var cert: X509Certificate? = null
        try { if (kf.exists() && cf.exists()) { key = SelfCert.decodeKey(kf.readBytes()); cert = SelfCert.decodeCert(cf.readBytes()) } } catch (_: Exception) {}
        if (key == null || cert == null) {
            val g = SelfCert.generate(); key = g.first; cert = g.second
            kf.writeBytes(SelfCert.encodeKey(key)); cf.writeBytes(cert.encoded)
        }
        val ks = KeyStore.getInstance("PKCS12"); ks.load(null, null)
        ks.setKeyEntry(alias, key, CharArray(0), arrayOf(cert))
        cached = ks
        return ks
    }

    private fun tls(host: String, port: Int): SSLSocket {
        val ks = keyStore()
        val km = object : X509ExtendedKeyManager() {
            override fun chooseClientAlias(keyType: Array<out String>?, issuers: Array<out Principal>?, socket: Socket?): String = alias
            override fun chooseEngineClientAlias(keyType: Array<out String>?, issuers: Array<out Principal>?, engine: javax.net.ssl.SSLEngine?): String = alias
            override fun getClientAliases(keyType: String?, issuers: Array<out Principal>?): Array<String> = arrayOf(alias)
            override fun getCertificateChain(a: String?): Array<X509Certificate> = ks.getCertificateChain(alias).map { it as X509Certificate }.toTypedArray()
            override fun getPrivateKey(a: String?): PrivateKey = ks.getKey(alias, CharArray(0)) as PrivateKey
            override fun getServerAliases(keyType: String?, issuers: Array<out Principal>?): Array<String>? = null
            override fun chooseServerAlias(keyType: String?, issuers: Array<out Principal>?, socket: Socket?): String? = null
        }
        val trustAll = object : X509TrustManager {   // التلفزيون يستخدم شهادة ذاتية التوقيع
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }
        val c = SSLContext.getInstance("TLSv1.2")
        c.init(arrayOf<KeyManager>(km), arrayOf(trustAll), null)
        val s = c.socketFactory.createSocket() as SSLSocket
        s.connect(InetSocketAddress(host, port), 5000)
        s.soTimeout = 10_000
        s.startHandshake()
        return s
    }

    private fun closeControl() {
        val c = control; control = null
        try { c?.socket?.close() } catch (_: Exception) {}
    }

    override fun definition() = ModuleDefinition {
        Name("AtvRemote")
        Events("found", "keyboard", "closed")

        // ---------- الاكتشاف: mDNS + مسح المنفذ 6466 ----------
        AsyncFunction("discover") { timeoutMs: Int, promise: Promise ->
            thread(name = "atv-discover") {
                val found = ConcurrentHashMap<String, MutableMap<String, Any>>()
                fun add(host: String, name: String?, mac: String?) {
                    val isNew = !found.containsKey(host)
                    val m = found.getOrPut(host) { mutableMapOf("host" to host, "name" to "Android TV", "mac" to "", "brand" to "androidtv") }
                    if (!name.isNullOrBlank()) m["name"] = name
                    if (!mac.isNullOrBlank()) m["mac"] = mac
                    if (isNew || !name.isNullOrBlank()) sendEvent("found", HashMap(m))
                }
                var nsdState = "off"
                var scanBase = "none"
                var lock: WifiManager.MulticastLock? = null
                var nsd: NsdManager? = null
                var listener: NsdManager.DiscoveryListener? = null
                try {
                    try {
                        val wifi = ctx().applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                        lock = wifi.createMulticastLock("tvraymond"); lock.setReferenceCounted(false); lock.acquire()
                    } catch (_: Exception) {}
                    try {
                        nsd = ctx().getSystemService(Context.NSD_SERVICE) as NsdManager
                        val pending = java.util.concurrent.LinkedBlockingQueue<NsdServiceInfo>()
                        val resolving = java.util.concurrent.atomic.AtomicBoolean(false)
                        lateinit var next: () -> Unit
                        next = {
                            if (resolving.compareAndSet(false, true)) {
                                val info = pending.poll()
                                if (info == null) resolving.set(false) else {
                                    @Suppress("DEPRECATION")
                                    nsd!!.resolveService(info, object : NsdManager.ResolveListener {
                                        override fun onResolveFailed(si: NsdServiceInfo?, code: Int) { resolving.set(false); next() }
                                        override fun onServiceResolved(si: NsdServiceInfo) {
                                            @Suppress("DEPRECATION")
                                            val h = si.host?.hostAddress
                                            val mac = si.attributes?.get("bt")?.toString(Charsets.UTF_8)
                                            if (h != null) add(h, si.serviceName, mac)
                                            resolving.set(false); next()
                                        }
                                    })
                                }
                            }
                        }
                        listener = object : NsdManager.DiscoveryListener {
                            override fun onDiscoveryStarted(t: String?) { nsdState = "started" }
                            override fun onDiscoveryStopped(t: String?) {}
                            override fun onStartDiscoveryFailed(t: String?, e: Int) { nsdState = "failed:$e" }
                            override fun onStopDiscoveryFailed(t: String?, e: Int) {}
                            override fun onServiceLost(s: NsdServiceInfo?) {}
                            override fun onServiceFound(s: NsdServiceInfo) { pending.add(s); next() }
                        }
                        nsd.discoverServices("_androidtvremote2._tcp", NsdManager.PROTOCOL_DNS_SD, listener)
                    } catch (e: Exception) { nsdState = "error:${e.javaClass.simpleName}" }

                    // مسح الشبكة المحلية (بديل مضمون إذا فشل mDNS)
                    val base = localBase()
                    if (base != null) scanBase = base
                    if (base != null) {
                        val pool = Executors.newFixedThreadPool(64)
                        for (i in 1..254) {
                            val ip = "$base.$i"
                            pool.execute {
                                try {
                                    Socket().use { s -> s.connect(InetSocketAddress(ip, 6466), 450) }
                                    add(ip, null, null)
                                } catch (_: Exception) {}
                            }
                        }
                        pool.shutdown()
                        pool.awaitTermination(timeoutMs.toLong(), TimeUnit.MILLISECONDS)
                        pool.shutdownNow()
                    }
                    val left = timeoutMs - 2500
                    if (left > 0) Thread.sleep(left.toLong().coerceAtMost(3000))   // ننتظر ردود mDNS المتأخرة
                } finally {
                    try { if (listener != null) nsd?.stopServiceDiscovery(listener) } catch (_: Exception) {}
                    try { lock?.release() } catch (_: Exception) {}
                }
                promise.resolve(mapOf("devices" to found.values.map { HashMap(it) }, "base" to scanBase, "nsd" to nsdState))
            }
        }

        // ---------- الاقتران ----------
        AsyncFunction("pairStart") { host: String, promise: Promise ->
            thread(name = "atv-pair-start") {
                try {
                    try { pairSocket?.close() } catch (_: Exception) {}
                    val s = tls(host, 6467); pairSocket = s
                    val out = s.outputStream; val inp = s.inputStream
                    Frames.write(out, Polo.pairingRequest("TV Raymond"))
                    while (true) {
                        when (Polo.kindOf(Frames.read(inp))) {
                            Polo.Kind.PAIRING_REQUEST_ACK -> Frames.write(out, Polo.options())
                            Polo.Kind.OPTIONS -> Frames.write(out, Polo.configuration())
                            Polo.Kind.CONFIGURATION_ACK -> { promise.resolve(true); return@thread }
                            Polo.Kind.ERROR -> throw IllegalStateException("رفض التلفزيون طلب الاقتران")
                            else -> {}
                        }
                    }
                } catch (e: java.net.SocketTimeoutException) {
                    promise.reject("TIMEOUT", "التلفزيون لم يرد. تأكد أنه شغال وبنفس الشبكة.", e)
                } catch (e: Exception) {
                    promise.reject("PAIR_START", e.message ?: "تعذر بدء الاقتران", e)
                }
            }
        }

        AsyncFunction("pairFinish") { code: String, promise: Promise ->
            thread(name = "atv-pair-finish") {
                val s = pairSocket
                try {
                    if (s == null) throw IllegalStateException("NO_SESSION")
                    val mine = keyStore().getCertificate(alias).publicKey as RSAPublicKey
                    val theirs = s.session.peerCertificates[0].publicKey as RSAPublicKey
                    val secret = Polo.computeSecret(mine.modulus, mine.publicExponent, theirs.modulus, theirs.publicExponent, code)
                    if (secret == null) { promise.reject("BAD_CODE", "الرمز غير صحيح", null); return@thread }
                    Frames.write(s.outputStream, Polo.secret(secret))
                    while (true) {
                        when (Polo.kindOf(Frames.read(s.inputStream))) {
                            Polo.Kind.SECRET_ACK -> { promise.resolve(true); return@thread }
                            Polo.Kind.ERROR -> { promise.reject("BAD_CODE", "الرمز غير صحيح", null); return@thread }
                            else -> {}
                        }
                    }
                } catch (e: Exception) {
                    promise.reject("PAIR_FINISH", e.message ?: "فشل الاقتران", e)
                } finally {
                    try { s?.close() } catch (_: Exception) {}
                    pairSocket = null
                }
            }
        }

        // ---------- التحكم ----------
        AsyncFunction("connect") { host: String, promise: Promise ->
            thread(name = "atv-connect") {
                try {
                    closeControl()
                    val s = tls(host, 6466)
                    s.soTimeout = 0
                    val out = s.outputStream; val inp = s.inputStream
                    val lock = Any()
                    val session = AtvRemoteSession(
                        { bytes -> synchronized(lock) { Frames.write(out, bytes) } },
                        object : AtvRemoteSession.Listener {
                            override fun onKeyboard(text: String) { sendEvent("keyboard", mapOf("text" to text)) }
                        },
                    )
                    val c = Control(s, session); control = c
                    thread(name = "atv-reader", isDaemon = true) {
                        try { while (true) session.handle(Frames.read(inp)) } catch (_: Exception) {}
                        if (control === c) { control = null; sendEvent("closed", mapOf("host" to host)) }
                        try { s.close() } catch (_: Exception) {}
                    }
                    val deadline = System.currentTimeMillis() + 8000
                    while (!session.configured && control === c && System.currentTimeMillis() < deadline) Thread.sleep(50)
                    if (!session.configured) { closeControl(); promise.reject("NOT_PAIRED", "التلفزيون ما رد. اقترن به أول.", null); return@thread }
                    promise.resolve(mapOf("model" to session.model, "vendor" to session.vendor))
                } catch (e: Exception) {
                    closeControl()
                    promise.reject("NOT_PAIRED", e.message ?: "تعذر الاتصال بالتلفزيون", e)
                }
            }
        }

        AsyncFunction("key") { code: Int -> try { control?.session?.sendKey(code) } catch (_: Exception) {} }
        AsyncFunction("text") { text: String -> try { control?.session?.sendText(text) } catch (_: Exception) {} }
        AsyncFunction("launch") { link: String -> try { control?.session?.launch(link) } catch (_: Exception) {} }
        Function("disconnect") { closeControl() }
    }

    /** أول ثلاث خانات من عنوان IPv4 للشبكة اللاسلكية */
    private fun localBase(): String? {
        try {
            for (ni in NetworkInterface.getNetworkInterfaces()) {
                if (!ni.isUp || ni.isLoopback) continue
                for (a in ni.inetAddresses) {
                    val h = a.hostAddress ?: continue
                    if (a is java.net.Inet4Address && a.isSiteLocalAddress) return h.substringBeforeLast('.')
                }
            }
        } catch (_: Exception) {}
        return null
    }
}
