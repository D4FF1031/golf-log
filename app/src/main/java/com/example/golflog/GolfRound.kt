package com.example.golflog

import org.json.JSONObject

/** 1ラウンド分の記録。 */
data class GolfRound(
    val id: Long,
    val date: String,   // yyyy-MM-dd
    val place: String,
    val score: Int,
    val memo: String,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("id", id)
        .put("date", date)
        .put("place", place)
        .put("score", score)
        .put("memo", memo)

    companion object {
        fun fromJson(json: JSONObject) = GolfRound(
            id = json.getLong("id"),
            date = json.getString("date"),
            place = json.getString("place"),
            score = json.getInt("score"),
            memo = json.optString("memo", ""),
        )
    }
}
