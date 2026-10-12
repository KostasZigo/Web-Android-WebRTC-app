package com.example.kotlinhelloworld.videoCall

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.webrtc.IceCandidate
import org.webrtc.SessionDescription

class SdpNegotiatorTest {
    private class RecordingPeer : SdpPeer {
        val created = mutableListOf<SessionDescription.Type>()
        val local = mutableListOf<SessionDescription>()
        val remote = mutableListOf<SessionDescription>()
        val candidates = mutableListOf<IceCandidate>()
        var createResult: ((SDPCreateResult) -> Unit)? = null
        var localResult: ((String?) -> Unit)? = null
        var remoteResult: ((String?) -> Unit)? = null
        var acceptsCandidates = true

        override fun create(type: SessionDescription.Type, callback: (SDPCreateResult) -> Unit) {
            created.add(type)
            createResult = callback
        }
        override fun setLocal(description: SessionDescription, callback: (String?) -> Unit) {
            local.add(description)
            localResult = callback
        }
        override fun setRemote(description: SessionDescription, callback: (String?) -> Unit) {
            remote.add(description)
            remoteResult = callback
        }
        override fun addCandidate(candidate: IceCandidate): Boolean {
            candidates.add(candidate)
            return acceptsCandidates
        }
    }

    private class Call {
        val statuses = mutableListOf<VideoCallStatus>()
        val sent = mutableListOf<String>()
        val errors = mutableListOf<String>()
        var releases = 0
        val peer = RecordingPeer()
        val lifecycle = CallLifecycle(statuses::add) { releases++ }
        val negotiator = SdpNegotiator(peer, lifecycle, sent::add, errors::add)
    }

    @Test
    fun `offerer sends SDP only after its local description is accepted`() {
        val call = Call()
        call.negotiator.matched(true)

        assertEquals(listOf(SessionDescription.Type.OFFER), call.peer.created)
        call.peer.createResult?.invoke(SDPCreateSuccess(SessionDescription(SessionDescription.Type.OFFER, "offer")))
        assertTrue(call.sent.isEmpty())
        call.peer.localResult?.invoke(null)

        assertEquals(listOf("offer"), call.sent)
        assertEquals(0, call.releases)
    }

    @Test
    fun `answerer waits for the remote offer before answering and adding queued ICE`() {
        val call = Call()
        call.negotiator.matched(false)
        call.negotiator.receiveCandidate(ICEMessage(0, "video", "candidate:1"))
        call.negotiator.receiveDescription(SDPMessage("offer"))

        assertEquals(SessionDescription.Type.OFFER, call.peer.remote.single().type)
        assertTrue(call.peer.created.isEmpty())
        assertTrue(call.peer.candidates.isEmpty())
        call.peer.remoteResult?.invoke(null)

        assertEquals(listOf(SessionDescription.Type.ANSWER), call.peer.created)
        assertEquals("candidate:1", call.peer.candidates.single().sdp)
        call.peer.createResult?.invoke(SDPCreateSuccess(SessionDescription(SessionDescription.Type.ANSWER, "answer")))
        call.peer.localResult?.invoke(null)

        assertEquals(listOf("answer"), call.sent)
    }

    @Test
    fun `offerer accepts a browser answer and flushes its buffered ICE`() {
        val call = Call()
        call.negotiator.matched(true)
        call.negotiator.receiveCandidate(ICEMessage(1, null, "candidate:2"))
        call.negotiator.receiveDescription(AnswerMessage("answer"))
        assertEquals(SessionDescription.Type.ANSWER, call.peer.remote.single().type)
        call.peer.remoteResult?.invoke(null)

        assertEquals(1, call.peer.candidates.single().sdpMLineIndex)
        assertEquals("", call.peer.candidates.single().sdpMid)
        assertEquals(listOf(SessionDescription.Type.OFFER), call.peer.created)
        assertEquals(0, call.releases)
    }

    @Test
    fun `offerer recognizes an Android top-level SDP as an answer`() {
        val call = Call()
        call.negotiator.matched(true)
        call.negotiator.receiveDescription(SDPMessage("android-answer"))
        call.peer.remoteResult?.invoke(null)

        assertEquals(SessionDescription.Type.ANSWER, call.peer.remote.single().type)
        assertEquals(listOf(SessionDescription.Type.OFFER), call.peer.created)
        assertEquals(0, call.releases)
    }

    @Test
    fun `a rejected queued ICE candidate does not start an answer`() {
        val call = Call()
        call.negotiator.matched(false)
        call.negotiator.receiveCandidate(ICEMessage(0, "video", "candidate:1"))
        call.negotiator.receiveDescription(SDPMessage("offer"))
        call.peer.acceptsCandidates = false
        call.peer.remoteResult?.invoke(null)

        assertEquals(listOf(VideoCallStatus.FAILED), call.statuses)
        assertEquals(1, call.releases)
        assertTrue(call.peer.created.isEmpty())
    }

    @Test
    fun `failed remote SDP ends the call without retrying an offer`() {
        val call = Call()
        call.negotiator.matched(false)
        call.negotiator.receiveDescription(SDPMessage("offer"))
        call.peer.remoteResult?.invoke("Invalid SDP")
        call.peer.remoteResult?.invoke(null)
        call.negotiator.receiveCandidate(ICEMessage(0, "video", "candidate:1"))

        assertEquals(listOf(VideoCallStatus.FAILED), call.statuses)
        assertEquals(1, call.releases)
        assertEquals(listOf("Could not set remote SDP: Invalid SDP"), call.errors)
        assertTrue(call.peer.created.isEmpty())
        assertTrue(call.peer.candidates.isEmpty())
    }

    @Test
    fun `creation local SDP and ICE failures end the call without sending SDP`() {
        for (failure in listOf("create", "local", "ice")) {
            val call = Call()
            call.negotiator.matched(true)
            when (failure) {
                "create" -> call.peer.createResult?.invoke(SDPCreateFailure("Could not create offer"))
                "local" -> {
                    call.peer.createResult?.invoke(SDPCreateSuccess(
                        SessionDescription(SessionDescription.Type.OFFER, "offer")
                    ))
                    call.peer.localResult?.invoke("Cannot set SDP")
                }
                "ice" -> {
                    call.peer.acceptsCandidates = false
                    call.negotiator.receiveDescription(SDPMessage("answer"))
                    call.peer.remoteResult?.invoke(null)
                    call.negotiator.receiveCandidate(ICEMessage(0, "video", "candidate:1"))
                }
            }
            assertEquals(listOf(VideoCallStatus.FAILED), call.statuses)
            assertEquals(1, call.releases)
            assertTrue(call.sent.isEmpty())
        }
    }

    @Test
    fun `SDP before matching conflicting answers and duplicate offers fail`() {
        val unmatched = Call()
        unmatched.negotiator.receiveDescription(SDPMessage("offer"))
        assertEquals(1, unmatched.releases)

        val wrongAnswer = Call()
        wrongAnswer.negotiator.matched(false)
        wrongAnswer.negotiator.receiveDescription(AnswerMessage("answer"))
        assertEquals(1, wrongAnswer.releases)
        assertTrue(wrongAnswer.peer.remote.isEmpty())

        val duplicate = Call()
        duplicate.negotiator.matched(false)
        duplicate.negotiator.receiveDescription(SDPMessage("offer"))
        duplicate.negotiator.receiveDescription(SDPMessage("offer again"))
        assertEquals(1, duplicate.releases)
        assertEquals(1, duplicate.peer.remote.size)
    }

    @Test
    fun `an SDP set failure without a reason still fails the call`() {
        val result = mutableListOf<String?>()
        val observer = SDPSetCallback(result::add)

        observer.onSetFailure(null)
        observer.onSetSuccess()

        assertEquals(listOf("Unknown SDP error", null), result)
    }
}
