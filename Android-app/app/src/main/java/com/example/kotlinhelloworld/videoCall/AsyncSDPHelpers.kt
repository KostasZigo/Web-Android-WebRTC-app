package com.example.kotlinhelloworld.videoCall

import org.webrtc.SdpObserver
import org.webrtc.SessionDescription


interface SDPCreateResult

data class SDPCreateSuccess(val descriptor: SessionDescription) : SDPCreateResult
data class SDPCreateFailure(val reason: String?) : SDPCreateResult

class SDPCreateCallback(private val callback: (SDPCreateResult) -> Unit) : SdpObserver {

    override fun onSetFailure(reason: String?) { }

    override fun onSetSuccess() { }

    override fun onCreateSuccess(descriptor: SessionDescription) = callback(SDPCreateSuccess(descriptor))

    override fun onCreateFailure(reason: String?) = callback(SDPCreateFailure(reason))
}

class SDPSetCallback(private val callback: (String?) -> Unit) : SdpObserver {

    override fun onSetFailure(reason: String?) = callback(reason)

    override fun onSetSuccess() = callback(null)

    override fun onCreateSuccess(descriptor: SessionDescription?) { }

    override fun onCreateFailure(reason: String?) { }
}