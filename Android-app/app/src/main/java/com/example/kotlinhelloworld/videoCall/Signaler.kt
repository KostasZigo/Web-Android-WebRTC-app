package com.example.kotlinhelloworld.videoCall

import android.util.Log
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.io.IOException

class SignalingWebSocket : WebSocketListener() {
    @Volatile private var webSocket: WebSocket? = null
    @Volatile private var closing = false

    var messageHandler: ((ClientMessage) -> Unit)? = null
    var errorHandler: ((Throwable) -> Unit)? = null

    @Synchronized
    override fun onOpen(webSocket: WebSocket, response: Response) {
        if (closing) {
            webSocket.close(1000, null)
        } else {
            this.webSocket = webSocket
        }
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
        if (closing) return
        val message = try {
            SignalingCodec.decode(text)
        } catch (invalid: InvalidSignalingMessage) {
            reportError(invalid)
            return
        }
        val handler = messageHandler
        if (handler == null) {
            reportError(IllegalStateException("No signaling message handler is attached"))
        } else {
            handler(message)
        }
    }

    @Synchronized
    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
        val unexpected = !closing
        closing = true
        this.webSocket = null
        if (unexpected) reportError(IOException("Signaling connection closed ($code): $reason"))
        webSocket.close(code, null)
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        this.webSocket = null
    }

    @Synchronized
    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        val unexpected = !closing
        closing = true
        this.webSocket = null
        if (unexpected) reportError(t)
    }

    private fun send(message: ClientMessage) {
        val payload = try {
            SignalingCodec.encode(message)
        } catch (invalid: InvalidSignalingMessage) {
            reportError(invalid)
            return
        }
        if (webSocket?.send(payload) != true) {
            reportError(IOException("Signaling connection is not open"))
        }
    }

    @Synchronized
    fun close() {
        closing = true
        webSocket?.close(1000, null)
        webSocket = null
    }

    fun sendSDP(sdp: String) {
        send(SDPMessage(sdp))
    }

    fun sendCandidate(label: Int, id: String, candidate: String) {
        send(ICEMessage(label, id, candidate))
    }

    private fun reportError(error: Throwable) {
        val handler = errorHandler
        if (handler == null) Log.e(TAG, "Signaling failed", error) else handler(error)
    }

    private companion object {
        const val TAG = "SignalingWebSocket"
    }
}
