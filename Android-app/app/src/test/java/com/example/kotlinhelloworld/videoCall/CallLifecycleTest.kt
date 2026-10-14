package com.example.kotlinhelloworld.videoCall

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.webrtc.IceCandidate
import org.webrtc.PeerConnection

class CallLifecycleTest {
    @Test
    fun `a departing peer ends the call and releases it only once`() {
        val statuses = mutableListOf<VideoCallStatus>()
        var releases = 0
        val call = CallLifecycle(statuses::add) { releases++ }

        call.update(VideoCallStatus.MATCHING)
        call.update(VideoCallStatus.CONNECTING)
        call.update(VideoCallStatus.CONNECTED)
        call.update(VideoCallStatus.CONNECTED)
        call.update(VideoCallStatus.FINISHED)
        call.update(VideoCallStatus.FAILED)
        call.close()

        assertEquals(
            listOf(VideoCallStatus.MATCHING, VideoCallStatus.CONNECTING,
                VideoCallStatus.CONNECTED, VideoCallStatus.FINISHED),
            statuses
        )
        assertEquals(1, releases)
        assertTrue(!call.active)
    }

    @Test
    fun `a failed or busy call releases resources without later status changes`() {
        for (terminal in listOf(VideoCallStatus.FAILED, VideoCallStatus.ON_GOING_CALL)) {
            val statuses = mutableListOf<VideoCallStatus>()
            var releases = 0
            val call = CallLifecycle(statuses::add) { releases++ }

            call.update(VideoCallStatus.MATCHING)
            call.update(terminal)
            call.update(VideoCallStatus.CONNECTED)
            call.close()

            assertEquals(listOf(VideoCallStatus.MATCHING, terminal), statuses)
            assertEquals(1, releases)
        }
    }

    @Test
    fun `local hangup releases resources without showing a peer departure`() {
        val statuses = mutableListOf<VideoCallStatus>()
        var releases = 0
        val call = CallLifecycle(statuses::add) { releases++ }

        call.update(VideoCallStatus.CONNECTING)
        call.close()
        call.close()
        call.update(VideoCallStatus.FINISHED)

        assertEquals(listOf(VideoCallStatus.CONNECTING), statuses)
        assertEquals(1, releases)
    }

    @Test
    fun `terminal status still releases resources if a listener fails`() {
        var releases = 0
        val call = CallLifecycle({ throw IllegalStateException("Screen is gone") }) { releases++ }

        assertThrows(IllegalStateException::class.java) { call.update(VideoCallStatus.FAILED) }
        call.close()

        assertEquals(1, releases)
    }

    @Test
    fun `peer connection events report reconnecting connected and ended calls`() {
        val statuses = mutableListOf<VideoCallStatus>()
        val observer = VideoCallSession.SimpleRTCEventHandler({}, {}, statuses::add)

        observer.onIceConnectionChange(PeerConnection.IceConnectionState.DISCONNECTED)
        observer.onConnectionChange(PeerConnection.PeerConnectionState.CONNECTED)
        observer.onIceConnectionChange(PeerConnection.IceConnectionState.FAILED)
        observer.onConnectionChange(PeerConnection.PeerConnectionState.CLOSED)

        assertEquals(
            listOf(VideoCallStatus.CONNECTING, VideoCallStatus.CONNECTED,
                VideoCallStatus.FAILED, VideoCallStatus.FINISHED),
            statuses
        )
    }

    @Test
    fun `a local ICE candidate is forwarded once and null candidates are ignored`() {
        val forwarded = mutableListOf<IceCandidate>()
        val observer = VideoCallSession.SimpleRTCEventHandler(forwarded::add, {}, {})
        val candidate = IceCandidate("video", 0, "candidate:1 1 UDP 1 127.0.0.1 12345 typ host")

        observer.onIceCandidate(candidate)
        observer.onIceCandidate(null)

        assertEquals(listOf(candidate), forwarded)
    }

    @Test
    fun `closes the peer before media and releases every resource once`() {
        val actions = mutableListOf<String>()
        val resources = resources(actions)

        resources.release()
        resources.release()

        assertEquals(releaseOrder, actions)
    }

    @Test
    fun `an interrupted camera stop still releases the other resources`() {
        val actions = mutableListOf<String>()
        val resources = resources(actions) { throw InterruptedException("Camera stop interrupted") }

        assertThrows(InterruptedException::class.java) { resources.release() }
        resources.release()

        assertEquals(releaseOrder, actions)
    }

    @Test
    fun `peer closure errors do not leave the camera or rendering context behind`() {
        val actions = mutableListOf<String>()
        val resources = resources(actions, closeFailure = { throw IllegalStateException("Peer close failed") })

        assertThrows(IllegalStateException::class.java) { resources.release() }

        assertEquals(releaseOrder, actions)
    }

    private fun resources(
        actions: MutableList<String>,
        stopFailure: () -> Unit = {},
        closeFailure: () -> Unit = {}
    ): CallResources =
        CallResources(
            closePeer = { actions.add("close peer"); closeFailure() },
            detachVideo = { actions.add("detach video") },
            stopCamera = { actions.add("stop camera"); stopFailure() },
            disposeCapture = { actions.add("dispose capture") },
            disposeMedia = { actions.add("dispose media") },
            disposePeer = { actions.add("dispose peer") },
            releaseContext = { actions.add("release context") }
        )

    private val releaseOrder = listOf(
        "close peer", "detach video", "stop camera", "dispose capture",
        "dispose media", "dispose peer", "release context"
    )
}
