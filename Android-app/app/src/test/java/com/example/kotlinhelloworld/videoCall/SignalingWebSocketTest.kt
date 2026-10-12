package com.example.kotlinhelloworld.videoCall

import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okio.ByteString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class SignalingWebSocketTest {
    private class RecordingSocket : WebSocket {
        val sent = mutableListOf<String>()
        var canSend = true
        var closedWith: Int? = null
        var cancelled = false
        private val handshake = Request.Builder().url("https://example.test/").build()

        override fun request(): Request = handshake
        override fun queueSize(): Long = 0
        override fun send(text: String): Boolean {
            if (canSend) sent.add(text)
            return canSend
        }
        override fun send(bytes: ByteString): Boolean = error("No binary signaling messages")
        override fun close(code: Int, reason: String?): Boolean {
            closedWith = code
            return true
        }
        override fun cancel() { cancelled = true }
    }

    private fun response(socket: WebSocket): Response =
        Response.Builder()
            .request(socket.request())
            .protocol(Protocol.HTTP_1_1)
            .code(101)
            .message("Switching Protocols")
            .build()

    @Test
    fun `delivers valid messages and reports invalid ones without ending delivery`() {
        val socket = RecordingSocket()
        val signaler = SignalingWebSocket()
        val received = mutableListOf<ClientMessage>()
        val errors = mutableListOf<Throwable>()
        signaler.messageHandler = { received.add(it) }
        signaler.errorHandler = { errors.add(it) }

        signaler.onMessage(socket, """{"type":"matched","match":"peer","offer":false}""")
        signaler.onMessage(socket, """{"type":"ice","candidate":"candidate:1","label":"bad"}""")
        signaler.onMessage(socket, "{bad json")
        signaler.onMessage(socket, """{"type":"peer-left"}""")

        assertEquals(listOf(MatchMessage("peer", false), PeerLeft), received)
        assertEquals(listOf("Invalid ICE candidate", "Malformed signaling JSON"), errors.map { it.message })
    }

    @Test
    fun `reports sends without a connection and sends existing Android wire shapes when open`() {
        val socket = RecordingSocket()
        val signaler = SignalingWebSocket()
        val errors = mutableListOf<Throwable>()
        signaler.errorHandler = { errors.add(it) }

        signaler.sendSDP("v=0")
        signaler.onOpen(socket, response(socket))
        signaler.sendSDP("v=0")
        signaler.sendCandidate(0, "video", "candidate:1")
        signaler.sendCandidate(-1, "video", "candidate:2")
        socket.canSend = false
        signaler.sendSDP("v=1")

        assertEquals(2, socket.sent.size)
        assertSameWireMessage("""{"type":"sdp","sdp":"v=0"}""", socket.sent[0])
        assertSameWireMessage(
            """{"type":"ice","candidate":"candidate:1","id":"video","label":0}""",
            socket.sent[1]
        )
        assertEquals(
            listOf("Signaling connection is not open", "Invalid ICE candidate", "Signaling connection is not open"),
            errors.map { it.message }
        )
    }

    @Test
    fun `reports a missing receiver instead of dropping a valid message`() {
        val socket = RecordingSocket()
        val signaler = SignalingWebSocket()
        val errors = mutableListOf<Throwable>()
        signaler.errorHandler = { errors.add(it) }

        signaler.onMessage(socket, """{"type":"peer-left"}""")

        assertEquals("No signaling message handler is attached", errors.single().message)
    }

    @Test
    fun `hangup cancels a pending handshake and closes late connections`() {
        val pending = RecordingSocket()
        val signaler = SignalingWebSocket()
        val errors = mutableListOf<Throwable>()
        signaler.errorHandler = { errors.add(it) }

        signaler.track(pending)
        signaler.close()
        signaler.onFailure(pending, IOException("cancelled"), null)

        assertTrue(pending.cancelled)
        assertTrue(errors.isEmpty())

        val late = RecordingSocket()
        signaler.onOpen(late, response(late))
        assertEquals(1000, late.closedWith)
    }

    @Test
    fun `reports unexpected disconnects but not an intentional hangup`() {
        val socket = RecordingSocket()
        val signaler = SignalingWebSocket()
        val errors = mutableListOf<Throwable>()
        signaler.errorHandler = { errors.add(it) }

        signaler.onOpen(socket, response(socket))
        signaler.onClosing(socket, 1011, "server failed")
        signaler.onClosed(socket, 1011, "server failed")
        signaler.onFailure(socket, IOException("later failure"), null)
        assertEquals(1011, socket.closedWith)
        assertEquals("Signaling connection closed (1011): server failed", errors.single().message)
        assertTrue(errors.single() is IOException)

        val nextSocket = RecordingSocket()
        val next = SignalingWebSocket()
        val nextErrors = mutableListOf<Throwable>()
        next.errorHandler = { nextErrors.add(it) }
        next.onFailure(nextSocket, IOException("network down"), null)
        assertEquals("network down", nextErrors.single().message)

        val waitingSocket = RecordingSocket()
        val ended = SignalingWebSocket()
        ended.errorHandler = { nextErrors.add(it) }
        ended.close()
        ended.onOpen(waitingSocket, response(waitingSocket))
        ended.onFailure(waitingSocket, IOException("closed"), null)
        ended.onClosing(waitingSocket, 1000, "normal")
        assertEquals(1000, waitingSocket.closedWith)
        assertFalse(nextErrors.any { it.message == "closed" })
    }
}
