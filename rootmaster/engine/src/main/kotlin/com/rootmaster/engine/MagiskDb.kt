package com.rootmaster.engine

enum class PolicyAction(val value: Int) {
    INTERACTIVE(0), DENY(1), ALLOW(2);

    companion object {
        fun from(v: Int?): PolicyAction? = entries.firstOrNull { it.value == v }
    }
}

data class SuPolicy(val uid: Int, val policy: PolicyAction?, val untilEpoch: Long, val logging: Boolean, val notification: Boolean)

data class SuLogEntry(
    val fromUid: Int, val packageName: String, val appName: String,
    val command: String, val toUid: Int, val action: Int, val timeEpoch: Long,
)

/** Parsing of `magisk --sqlite` output and construction of safe SQL (integers only, never free text). */
object MagiskDb {
    const val SELECT_POLICIES = "SELECT uid,policy,until,logging,notification FROM policies"
    const val SELECT_LOGS =
        "SELECT from_uid,package_name,app_name,command,to_uid,action,time FROM logs ORDER BY time DESC LIMIT 100"

    fun setPolicySql(uid: Int, action: PolicyAction): String {
        require(uid in 0..999_999) { "bad uid" }
        return "REPLACE INTO policies (uid,policy,until,logging,notification) VALUES($uid,${action.value},0,1,1)"
    }

    fun revokeSql(uid: Int): String {
        require(uid in 0..999_999) { "bad uid" }
        return "DELETE FROM policies WHERE uid=$uid"
    }

    private val marker = Regex("""(?:^|\|)([A-Za-z_]+)=""")

    /** One output row looks like `key=value|key=value`. Values may contain '|' so keys are located first. */
    fun parseRow(line: String): Map<String, String> {
        val hits = marker.findAll(line).toList()
        val out = LinkedHashMap<String, String>()
        for ((i, m) in hits.withIndex()) {
            val end = if (i + 1 < hits.size) hits[i + 1].range.first else line.length
            out[m.groupValues[1]] = line.substring(m.range.last + 1, end)
        }
        return out
    }

    fun parsePolicies(output: String): List<SuPolicy> = output.lineSequence()
        .map { parseRow(it.trim()) }
        .filter { it.containsKey("uid") }
        .mapNotNull { r ->
            val uid = r["uid"]?.toIntOrNull() ?: return@mapNotNull null
            SuPolicy(
                uid, PolicyAction.from(r["policy"]?.toIntOrNull()),
                r["until"]?.toLongOrNull() ?: 0L,
                r["logging"] == "1", r["notification"] == "1",
            )
        }.toList()

    fun parseLogs(output: String): List<SuLogEntry> = output.lineSequence()
        .map { parseRow(it.trim()) }
        .filter { it.containsKey("from_uid") }
        .mapNotNull { r ->
            val uid = r["from_uid"]?.toIntOrNull() ?: return@mapNotNull null
            SuLogEntry(
                uid, r["package_name"].orEmpty(), r["app_name"].orEmpty(), r["command"].orEmpty(),
                r["to_uid"]?.toIntOrNull() ?: 0, r["action"]?.toIntOrNull() ?: -1, r["time"]?.toLongOrNull() ?: 0L,
            )
        }.toList()
}
