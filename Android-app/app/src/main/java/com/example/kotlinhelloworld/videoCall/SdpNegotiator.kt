package com.example.kotlinhelloworld.videoCall

import org.webrtc.IceCandidate
import org.webrtc.SessionDescription

internal interface SdpPeer {
    fun create(type: SessionDescription.Type, callback: (SDPCreateResult) -> Unit)
    fun setLocal(description: SessionDescription, callback: (String?) -> Unit)
    fun setRemote(description: SessionDescription, callback: (String?) -> Unit)
    fun addCandidate(candidate: IceCandidate): Boolean
}

internal class SdpNegotiator(
    private val peer: SdpPeer,
    private val lifecycle: CallLifecycle,
    private val sendSdp: (String) -> Unit,
    private val onError: (String) -> Unit
) {
    private var offering: Boolean? = null
    private var remotePending = false
    private var remoteReady = false
    private val pendingCandidates = ArrayDeque<IceCandidate>()

    fun matched(offer: Boolean) {
        if (!lifecycle.active) return
        if (offering != null) return fail("Call was already matched")
        offering = offer
        if (offer) create(SessionDescription.Type.OFFER)
    }

    fun receiveDescription(message: ClientMessage) {
        if (!lifecycle.active) return
        val role = offering ?: return fail("Received SDP before matching")
        if (remotePending || remoteReady) return fail("Received a second remote SDP")
        val type = when (message) {
            is AnswerMessage -> SessionDescription.Type.ANSWER
            is SDPMessage -> if (role) SessionDescription.Type.ANSWER else SessionDescription.Type.OFFER
            else -> return fail("Received a non-SDP description")
        }
        if (type == SessionDescription.Type.ANSWER && !role) {
            return fail("Received an answer without a local offer")
        }
        val sdp = when (message) {
            is AnswerMessage -> message.sdp
            is SDPMessage -> message.sdp
            else -> return
        }
        remotePending = true
        peer.setRemote(SessionDescription(type, sdp)) { error ->
            if (!lifecycle.active) return@setRemote
            remotePending = false
            if (error != null) return@setRemote fail("Could not set remote SDP: $error")
            remoteReady = true
            while (pendingCandidates.isNotEmpty()) {
                if (!addCandidate(pendingCandidates.removeFirst())) return@setRemote
            }
            if (type == SessionDescription.Type.OFFER) create(SessionDescription.Type.ANSWER)
        }
    }

    fun receiveCandidate(message: ICEMessage) {
        if (!lifecycle.active) return
        if (offering == null) return fail("Received ICE before matching")
        val candidate = IceCandidate(message.id ?: "", message.label, message.candidate)
        if (remoteReady) addCandidate(candidate) else pendingCandidates.add(candidate)
    }

    private fun addCandidate(candidate: IceCandidate): Boolean {
        if (peer.addCandidate(candidate)) return true
        fail("Could not add remote ICE candidate")
        return false
    }

    private fun create(type: SessionDescription.Type) {
        peer.create(type) { result ->
            if (!lifecycle.active) return@create
            when (result) {
                is SDPCreateFailure -> fail("Could not create $type: ${result.reason}")
                is SDPCreateSuccess -> {
                    if (result.descriptor.type != type) return@create fail("Unexpected SDP type")
                    peer.setLocal(result.descriptor) { error ->
                        if (!lifecycle.active) return@setLocal
                        if (error != null) fail("Could not set local SDP: $error")
                        else sendSdp(result.descriptor.description)
                    }
                }
                else -> fail("Unexpected SDP creation result")
            }
        }
    }

    private fun fail(reason: String) {
        onError(reason)
        lifecycle.update(VideoCallStatus.FAILED)
    }
}
