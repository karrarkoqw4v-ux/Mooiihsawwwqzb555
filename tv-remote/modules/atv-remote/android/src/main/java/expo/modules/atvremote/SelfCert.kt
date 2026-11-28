package expo.modules.atvremote

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.math.BigInteger
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.Signature
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.security.spec.PKCS8EncodedKeySpec
import java.text.SimpleDateFormat
import java.util.Date
import java.util.TimeZone

/** مفتاح RSA برمجي + شهادة ذاتية التوقيع (بدون Keystore لأنه يفشل مع TLS في بعض الأجهزة). */
object SelfCert {
    private fun len(n: Int): ByteArray = when {
        n < 128 -> byteArrayOf(n.toByte())
        n < 256 -> byteArrayOf(0x81.toByte(), n.toByte())
        else -> byteArrayOf(0x82.toByte(), (n shr 8).toByte(), n.toByte())
    }
    private fun tlv(tag: Int, body: ByteArray): ByteArray {
        val o = ByteArrayOutputStream(); o.write(tag); o.write(len(body.size)); o.write(body); return o.toByteArray()
    }
    private fun cat(vararg p: ByteArray): ByteArray { val o = ByteArrayOutputStream(); p.forEach { o.write(it) }; return o.toByteArray() }
    private val sigAlg = tlv(0x30, cat(tlv(0x06, byteArrayOf(0x2A, 0x86.toByte(), 0x48, 0x86.toByte(), 0xF7.toByte(), 0x0D, 0x01, 0x01, 0x0B)), byteArrayOf(0x05, 0x00)))
    private fun name(cn: String) = tlv(0x30, tlv(0x31, tlv(0x30, cat(tlv(0x06, byteArrayOf(0x55, 0x04, 0x03)), tlv(0x0C, cn.toByteArray(Charsets.UTF_8))))))
    private fun utc(d: Date): ByteArray {
        val f = SimpleDateFormat("yyMMddHHmmss'Z'"); f.timeZone = TimeZone.getTimeZone("UTC")
        return tlv(0x17, f.format(d).toByteArray(Charsets.US_ASCII))
    }

    fun generate(cn: String = "TV Raymond"): Pair<PrivateKey, X509Certificate> {
        val gen = KeyPairGenerator.getInstance("RSA"); gen.initialize(2048)
        val kp = gen.generateKeyPair()
        val now = System.currentTimeMillis()
        val tbs = tlv(0x30, cat(
            tlv(0xA0, tlv(0x02, byteArrayOf(2))),
            tlv(0x02, BigInteger.valueOf(now).toByteArray()),
            sigAlg, name(cn),
            tlv(0x30, cat(utc(Date(now - 86_400_000L)), utc(Date(now + 20L * 365 * 86_400_000L)))),
            name(cn), kp.public.encoded,
        ))
        val s = Signature.getInstance("SHA256withRSA"); s.initSign(kp.private); s.update(tbs)
        val der = tlv(0x30, cat(tbs, sigAlg, tlv(0x03, cat(byteArrayOf(0), s.sign()))))
        val cert = CertificateFactory.getInstance("X.509").generateCertificate(ByteArrayInputStream(der)) as X509Certificate
        return kp.private to cert
    }

    fun encodeKey(k: PrivateKey): ByteArray = k.encoded
    fun decodeKey(b: ByteArray): PrivateKey = KeyFactory.getInstance("RSA").generatePrivate(PKCS8EncodedKeySpec(b))
    fun decodeCert(b: ByteArray): X509Certificate = CertificateFactory.getInstance("X.509").generateCertificate(ByteArrayInputStream(b)) as X509Certificate
}
