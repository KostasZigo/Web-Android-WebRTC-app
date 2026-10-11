package com.example.kotlinhelloworld.videoCall

import org.json.JSONException
import org.json.JSONObject

sealed class ClientMessage

data class SDPMessage(val sdp: String) : ClientMessage()
data class AnswerMessage(val sdp: String) : ClientMessage()
data class ICEMessage(val label: Int, val id: String?, val candidate: String) : ClientMessage()
data class MatchMessage(val match: String, val offer: Boolean) : ClientMessage()
object PeerLeft : ClientMessage()
object OnGoingCall : ClientMessage()

internal class InvalidSignalingMessage(message: String, cause: Throwable? = null) :
    IllegalArgumentException(message, cause)

internal object SignalingCodec {
    fun decode(text: String): ClientMessage {
        val message = try {
            JSONObject(text)
        } catch (malformed: JSONException) {
            throw InvalidSignalingMessage("Malformed signaling JSON", malformed)
        }
        return when (message.opt("type")) {
            "matched" -> {
                val match = requiredText(message, "match", "Invalid match message")
                val offer = message.opt("offer") as? Boolean
                    ?: throw InvalidSignalingMessage("Invalid match message")
                MatchMessage(match, offer)
            }
            "on-going-call" -> OnGoingCall
            "peer-left" -> PeerLeft
            "sdp", "answer" -> decodeDescription(message)
            "ice" -> decodeCandidate(message)
            else -> throw InvalidSignalingMessage("Unsupported signaling message")
        }
    }

    fun encode(message: ClientMessage): String = when (message) {
        is SDPMessage -> encodeDescription(message.sdp)
        is AnswerMessage -> encodeDescription(message.sdp)
        is ICEMessage -> {
            if (message.label < 0 || message.candidate.isBlank()) {
                throw InvalidSignalingMessage("Invalid ICE candidate")
            }
            JSONObject()
                .put("type", "ice")
                .put("candidate", message.candidate)
                .put("id", message.id)
                .put("label", message.label)
                .toString()
        }
        PeerLeft -> JSONObject().put("type", "peer-left").toString()
        else -> throw InvalidSignalingMessage("Cannot send a server-only signaling message")
    }

    private fun encodeDescription(sdp: String): String {
        if (sdp.isBlank()) throw InvalidSignalingMessage("Invalid SDP message")
        return JSONObject().put("type", "sdp").put("sdp", sdp).toString()
    }

    private fun decodeDescription(message: JSONObject): ClientMessage {
        val nested = optionalObject(message, "data", "Invalid SDP message")
        val nestedSdp = nested?.opt("sdp")
        val topLevelSdp = message.opt("sdp")
        if ((nested?.has("sdp") == true && nestedSdp !is String) ||
            (message.has("sdp") && topLevelSdp !is String)) {
            throw InvalidSignalingMessage("Invalid SDP message")
        }
        val sdp = (nestedSdp ?: topLevelSdp) as? String
        if (sdp.isNullOrBlank() || (topLevelSdp is String && topLevelSdp != sdp)) {
            throw InvalidSignalingMessage("Invalid SDP message")
        }
        val nestedType = nested?.opt("type")
        if (nested?.has("type") == true && nestedType != "offer" && nestedType != "answer" ||
            message.opt("type") == "answer" && nestedType == "offer") {
            throw InvalidSignalingMessage("Invalid SDP type")
        }
        return if (message.opt("type") == "answer" || nestedType == "answer") {
            AnswerMessage(sdp)
        } else {
            SDPMessage(sdp)
        }
    }

    private fun decodeCandidate(message: JSONObject): ICEMessage {
        val nested = optionalObject(message, "data", "Invalid ICE candidate")
        val candidateFields = nested ?: message
        val candidate = requiredText(candidateFields, "candidate", "Invalid ICE candidate")
        val midKey = if (nested == null) "id" else "sdpMid"
        val indexKey = if (nested == null) "label" else "sdpMLineIndex"
        val midValue = candidateFields.opt(midKey)
        if (candidateFields.has(midKey) && midValue !== JSONObject.NULL && midValue !is String) {
            throw InvalidSignalingMessage("Invalid ICE candidate")
        }
        val index = candidateFields.opt(indexKey) as? Number
            ?: throw InvalidSignalingMessage("Invalid ICE candidate")
        val indexValue = index.toDouble()
        if (indexValue !in 0.0..Int.MAX_VALUE.toDouble() || indexValue % 1.0 != 0.0) {
            throw InvalidSignalingMessage("Invalid ICE candidate")
        }
        return ICEMessage(indexValue.toInt(), midValue as? String, candidate)
    }

    private fun optionalObject(message: JSONObject, key: String, error: String): JSONObject? =
        if (message.has(key)) message.opt(key) as? JSONObject
            ?: throw InvalidSignalingMessage(error)
        else null

    private fun requiredText(message: JSONObject, key: String, error: String): String =
        (message.opt(key) as? String)?.takeUnless(String::isBlank)
            ?: throw InvalidSignalingMessage(error)
}
