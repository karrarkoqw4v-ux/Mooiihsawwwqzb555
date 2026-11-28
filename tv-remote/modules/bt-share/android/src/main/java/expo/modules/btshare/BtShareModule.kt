package expo.modules.btshare

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.util.UUID
import kotlin.concurrent.thread

// مشاركة الملفات مع الكمبيوتر عبر البلوتوث (OBEX Object Push، نفس بروتوكول "Bluetooth File Transfer" في ويندوز)
class BtShareModule : Module() {
    private val oppUuid: UUID = UUID.fromString("00001105-0000-1000-8000-00805f9b34fb")

    @Volatile private var cancelled = false
    @Volatile private var busy = false

    private fun ctx(): Context = appContext.reactContext ?: throw IllegalStateException("no context")

    private fun adapter(): BluetoothAdapter? {
        val m = ctx().getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return m?.adapter
    }

    private fun kindOf(d: BluetoothDevice): String {
        val major = d.bluetoothClass?.majorDeviceClass
        return when (major) {
            BluetoothClass.Device.Major.COMPUTER -> "computer"
            BluetoothClass.Device.Major.PHONE -> "phone"
            BluetoothClass.Device.Major.AUDIO_VIDEO -> "audio"
            else -> "other"
        }
    }

    override fun definition() = ModuleDefinition {
        Name("BtShare")
        Events("progress")

        Function("isAvailable") { adapter() != null }
        Function("isEnabled") { adapter()?.isEnabled == true }

        // الأجهزة المقترنة (المسجلة) مع الجوال
        AsyncFunction("getPairedDevices") {
            val a = adapter() ?: throw IllegalStateException("NO_BLUETOOTH")
            val out = ArrayList<Map<String, Any>>()
            try {
                for (d in a.bondedDevices) {
                    out.add(mapOf("name" to (d.name ?: d.address), "address" to d.address, "kind" to kindOf(d)))
                }
            } catch (e: SecurityException) {
                throw IllegalStateException("NO_PERMISSION")
            }
            out
        }

        Function("cancel") { cancelled = true }

        // إرسال ملف (content:// أو file://) إلى كمبيوتر
        AsyncFunction("sendFile") { address: String, uri: String, name: String, size: Double, promise: Promise ->
            val resolver = ctx().contentResolver
            runTransfer(address, name, size.toLong(), { resolver.openInputStream(Uri.parse(uri)) ?: throw IllegalStateException("لا يمكن فتح الملف") }, promise)
        }

        // إرسال نص (رابط) كملف
        AsyncFunction("sendText") { address: String, name: String, text: String, promise: Promise ->
            val bytes = text.toByteArray(Charsets.UTF_8)
            runTransfer(address, name, bytes.size.toLong(), { ByteArrayInputStream(bytes) }, promise)
        }

        // بديل: نافذة المشاركة الخاصة بأندرويد (يختار المستخدم البلوتوث ثم الكمبيوتر)
        Function("shareViaSystem") { uris: List<String>, mime: String ->
            val list = ArrayList<Uri>(uris.map { Uri.parse(it) })
            val intent = if (list.size == 1) {
                Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, list[0])
            } else {
                Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, list)
            }
            intent.type = mime
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val chooser = Intent.createChooser(intent, "إرسال عبر")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx().startActivity(chooser)
        }
    }

    private fun runTransfer(address: String, name: String, size: Long, open: () -> InputStream, promise: Promise) {
        if (busy) { promise.reject("BUSY", "هناك إرسال جارٍ", null); return }
        busy = true
        cancelled = false
        thread(name = "bt-share") {
            var socket: BluetoothSocket? = null
            var lastActivity = System.currentTimeMillis()
            var finished = false
            try {
                val a = adapter() ?: throw IllegalStateException("NO_BLUETOOTH")
                a.cancelDiscovery()
                val device = a.getRemoteDevice(address)
                socket = device.createRfcommSocketToServiceRecord(oppUuid)
                val sock = socket
                // مؤقت حماية: إذا ما صار أي تقدم 60 ثانية نغلق الاتصال
                thread(name = "bt-watchdog", isDaemon = true) {
                    while (!finished) {
                        Thread.sleep(2000)
                        if (!finished && System.currentTimeMillis() - lastActivity > 60_000) {
                            try { sock.close() } catch (_: Exception) {}
                            return@thread
                        }
                    }
                }
                sock.connect()
                lastActivity = System.currentTimeMillis()
                val client = ObexClient(sock.inputStream, sock.outputStream)
                client.connect()
                lastActivity = System.currentTimeMillis()
                var lastEmit = 0L
                open().use { src ->
                    client.put(name, size, src, { sent ->
                        lastActivity = System.currentTimeMillis()
                        val now = System.currentTimeMillis()
                        if (now - lastEmit > 250 || (size in 0..sent)) {
                            lastEmit = now
                            sendEvent("progress", mapOf("sent" to sent.toDouble(), "total" to size.toDouble()))
                        }
                    }, { cancelled })
                }
                client.disconnect()
                promise.resolve(true)
            } catch (e: SecurityException) {
                promise.reject("NO_PERMISSION", "صلاحية البلوتوث غير ممنوحة", e)
            } catch (e: ObexException) {
                promise.reject("OBEX", e.message ?: "رفض الكمبيوتر الملف", e)
            } catch (e: java.io.IOException) {
                promise.reject("CONNECT", "تعذر الاتصال بالكمبيوتر. افتح على الكمبيوتر: إعدادات البلوتوث ← إرسال أو استقبال ملفات ← استقبال ملفات", e)
            } catch (e: Exception) {
                promise.reject("ERROR", e.message ?: "خطأ غير معروف", e)
            } finally {
                finished = true
                try { socket?.close() } catch (_: Exception) {}
                busy = false
            }
        }
    }
}
