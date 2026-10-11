package com.example.kotlinhelloworld.videoCall

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SignalingCodecTest {
    @Test
    fun `reads browser and Android offer and answer examples`() {
        val offer = "v=0\r\na=setup:actpass\r\n"
        val answer = "v=0\r\na=setup:active\r\n"

        assertEquals(SDPMessage(offer), SignalingCodec.decode(signalingFixture("browser-offer")))
        assertEquals(SDPMessage(offer), SignalingCodec.decode(signalingFixture("android-offer")))
        assertEquals(AnswerMessage(answer), SignalingCodec.decode(signalingFixture("browser-answer")))
        assertEquals(SDPMessage(answer), SignalingCodec.decode(signalingFixture("android-answer")))
        assertEquals(
            AnswerMessage(answer),
            SignalingCodec.decode(
                JSONObject().put("type", "sdp")
                    .put("data", JSONObject().put("type", "answer").put("sdp", answer))
                    .toString()
            )
        )
    }

    @Test
    fun `reads browser and Android ICE and preserves media-line details`() {
        assertEquals(
            ICEMessage(0, "video", "candidate:1 1 udp 1 192.0.2.1 5000 typ host"),
            SignalingCodec.decode(signalingFixture("android-ice"))
        )
        assertEquals(
            ICEMessage(0, "video", "candidate:2 1 udp 1 192.0.2.2 5001 typ host"),
            SignalingCodec.decode(signalingFixture("browser-ice"))
        )
        assertEquals(
            ICEMessage(1, null, "candidate:3"),
            SignalingCodec.decode(
                """{"type":"ice","data":{"candidate":"candidate:3","sdpMid":null,"sdpMLineIndex":1}}"""
            )
        )
    }

    @Test
    fun `reads match busy and peer departure notices`() {
        assertEquals(
            MatchMessage("other-peer", false),
            SignalingCodec.decode("""{"type":"matched","match":"other-peer","offer":false}""")
        )
        assertEquals(OnGoingCall, SignalingCodec.decode("""{"type":"on-going-call"}"""))
        assertEquals(PeerLeft, SignalingCodec.decode("""{"type":"peer-left"}"""))
    }

    @Test
    fun `sends Android shaped SDP answer ICE and hangup messages`() {
        val answer = "v=0\r\na=setup:active\r\n"
        assertSameWireMessage(
            signalingFixture("android-offer"),
            SignalingCodec.encode(SDPMessage("v=0\r\na=setup:actpass\r\n"))
        )
        assertSameWireMessage(signalingFixture("android-answer"), SignalingCodec.encode(AnswerMessage(answer)))
        assertSameWireMessage(
            signalingFixture("android-ice"),
            SignalingCodec.encode(SignalingCodec.decode(signalingFixture("android-ice")))
        )
        assertEquals(
            PeerLeft,
            SignalingCodec.decode(SignalingCodec.encode(PeerLeft))
        )
    }

    @Test
    fun `rejects broken or conflicting wire messages instead of guessing`() {
        val invalid = listOf(
            "{bad json",
            "[]",
            """{"type":"other"}""",
            """{"type":"matched","match":"peer"}""",
            """{"type":"matched","match":"","offer":true}""",
            """{"type":"matched","match":"peer","offer":"true"}""",
            """{"type":"sdp","sdp":""}""",
            """{"type":"sdp","sdp":"first","data":{"type":"offer","sdp":"second"}}""",
            """{"type":"answer","data":{"type":"offer","sdp":"v=0"}}""",
            """{"type":"sdp","data":null,"sdp":"v=0"}""",
            """{"type":"sdp","data":{"type":"pranswer","sdp":"v=0"}}""",
            """{"type":"sdp","data":{"type":"offer","sdp":"v=0"},"sdp":3}""",
            """{"type":"sdp","data":{"type":"offer","sdp":3}}""",
            """{"type":"ice","label":0,"id":"video"}""",
            """{"type":"ice","candidate":"candidate:1","label":"0"}""",
            """{"type":"ice","candidate":"candidate:1","label":0,"id":3}""",
            """{"type":"ice","candidate":"candidate:1","label":-1}""",
            """{"type":"ice","candidate":"candidate:1","label":0.5}""",
            """{"type":"ice","candidate":"candidate:1","label":2147483648}""",
            """{"type":"ice","data":"not an object","candidate":"candidate:1","label":0}""",
            """{"type":"ice","data":{"candidate":"candidate:1","sdpMid":true,"sdpMLineIndex":0}}""",
            """{"type":"ice","candidate":"candidate:1","label":0,"data":{}}"""
        )
        invalid.forEach { payload ->
            assertThrows(payload, InvalidSignalingMessage::class.java) {
                SignalingCodec.decode(payload)
            }
        }
    }

    @Test
    fun `rejects invalid outgoing payloads and server-only messages`() {
        listOf(
            SDPMessage(""), ICEMessage(-1, "video", "candidate:1"), ICEMessage(0, "video", ""),
            OnGoingCall, MatchMessage("peer", false)
        )
            .forEach { message ->
                assertThrows(InvalidSignalingMessage::class.java) {
                    SignalingCodec.encode(message)
                }
            }
    }
}
