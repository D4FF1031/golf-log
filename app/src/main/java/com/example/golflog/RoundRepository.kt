package com.example.golflog

import android.content.Context
import org.json.JSONArray
import java.io.File

/**
 * 記録をアプリ内部ストレージの JSON ファイルに保存する、最小構成のリポジトリ。
 * 件数が増えたり検索・集計が必要になったら Room への置き換えを検討してください。
 */
class RoundRepository(context: Context) {
    private val file = File(context.filesDir, "rounds.json")

    fun loadAll(): List<GolfRound> {
        if (!file.exists()) return emptyList()
        return runCatching {
            val array = JSONArray(file.readText())
            List(array.length()) { GolfRound.fromJson(array.getJSONObject(it)) }
        }.getOrDefault(emptyList())
            .sortedWith(compareByDescending<GolfRound> { it.date }.thenByDescending { it.id })
    }

    fun add(round: GolfRound): List<GolfRound> {
        val updated = loadAll() + round
        save(updated)
        return loadAll()
    }

    fun delete(id: Long): List<GolfRound> {
        save(loadAll().filterNot { it.id == id })
        return loadAll()
    }

    private fun save(rounds: List<GolfRound>) {
        val array = JSONArray()
        rounds.forEach { array.put(it.toJson()) }
        // 書き込み途中で落ちてもデータが壊れないよう、一時ファイル経由で置き換える
        val tmp = File(file.parentFile, "${file.name}.tmp")
        tmp.writeText(array.toString())
        tmp.renameTo(file)
    }
}
