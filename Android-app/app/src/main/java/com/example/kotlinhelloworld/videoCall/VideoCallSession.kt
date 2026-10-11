package com.example.kotlinhelloworld.videoCall

import android.content.Context
import android.util.Log
import com.example.kotlinhelloworld.R
import okhttp3.OkHttpClient
import okhttp3.Request
import org.webrtc.AudioSource
import org.webrtc.Camera1Enumerator
import org.webrtc.Camera2Enumerator
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpTransceiver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoSink
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import java.util.concurrent.Executors

internal fun selectPreferredCamera(deviceNames: Array<String>, isFrontFacing: (String) -> Boolean): String? =
    deviceNames.firstOrNull(isFrontFacing) ?: deviceNames.firstOrNull()

enum class VideoCallStatus(val label: Int, val color: Int) {
    UNKNOWN(R.string.status_unknown, R.color.colorUnknown),
    CONNECTING(R.string.status_connecting, R.color.colorConnecting),
    MATCHING(R.string.status_matching, R.color.colorMatching),
    FAILED(R.string.status_failed, R.color.colorFailed),
    CONNECTED(R.string.status_connected, R.color.colorConnected),
    FINISHED(R.string.status_finished, R.color.colorConnected),
    ON_GOING_CALL(R.string.status_finished, R.color.colorConnected);
}

data class VideoRenderers(val local: VideoSink, val remote: VideoSink)

class VideoCallSession(
        private val context: Context,
        private val onStatusChangedListener: (VideoCallStatus) -> Unit,
        private val signaler: SignalingWebSocket,
        private val videoRenderers: VideoRenderers)  {

    private var peerConnection : PeerConnection? = null
    private var factory : PeerConnectionFactory? = null
    private var isOfferingPeer = false
    private var videoSource : VideoSource? = null
    private var audioSource : AudioSource? = null
    private val eglBase = EglBase.create()
    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var localVideoTrack: VideoTrack? = null
    private var remoteVideoTrack: VideoTrack? = null

    val renderContext: EglBase.Context
        get() = eglBase.eglBaseContext

    class SimpleRTCEventHandler(
            private val onIceCandidateCb: (IceCandidate) -> Unit,
            private val onVideoTrackCb: (VideoTrack) -> Unit,
            private val onRemoveStreamCb: () -> Unit) : PeerConnection.Observer {

        override fun onIceCandidate(candidate: IceCandidate?) {
            if(candidate != null) onIceCandidateCb(candidate)
        }

        override fun onAddStream(stream: MediaStream?) {
            stream?.videoTracks?.firstOrNull()?.let(onVideoTrackCb)
        }

        override fun onRemoveStream(stream: MediaStream?) {
            if (stream != null) onRemoveStreamCb()
        }

        override fun onTrack(transceiver: RtpTransceiver?) {
            (transceiver?.receiver?.track() as? VideoTrack)?.let(onVideoTrackCb)
        }

        override fun onDataChannel(chan: DataChannel?) { Log.w(TAG, "onDataChannel: $chan") }

        override fun onIceConnectionReceivingChange(p0: Boolean) { Log.w(TAG, "onIceConnectionReceivingChange: $p0") }

        override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) { Log.w(TAG, "onIceConnectionChange: $newState") }

        override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) { Log.w(TAG, "onIceGatheringChange: $newState") }

        override fun onSignalingChange(newState: PeerConnection.SignalingState?) { Log.w(TAG, "onSignalingChange: $newState") }

        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) { Log.w(TAG, "onIceCandidatesRemoved: $candidates") }

        override fun onRenegotiationNeeded() { Log.w(TAG, "onRenegotiationNeeded") }

    }

    init {
        signaler.messageHandler = this::onMessage
        signaler.errorHandler = { error ->
            Log.e(TAG, "Signaling failed", error)
            onStatusChangedListener(VideoCallStatus.FAILED)
        }
        this.onStatusChangedListener(VideoCallStatus.MATCHING)
        executor.execute(this::init)
    }

    private fun init() {
        val initializationOptions = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(initializationOptions)

        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .createPeerConnectionFactory()

        val iceServers = arrayListOf(
                PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )

        val rtcCfg = PeerConnection.RTCConfiguration(iceServers)
        rtcCfg.continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        rtcCfg.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        val rtcEvents = SimpleRTCEventHandler(this::handleLocalIceCandidate, this::attachRemoteVideoTrack, this::removeRemoteStream)
        peerConnection = factory?.createPeerConnection(rtcCfg, rtcEvents)
        if (peerConnection == null) {
            Log.e(TAG, "Could not create peer connection")
            onStatusChangedListener(VideoCallStatus.FAILED)
            return
        }
        setupMediaDevices()
    }

    private fun start() {
        executor.execute(this::maybeCreateOffer)
    }

    private fun maybeCreateOffer() {
        if(isOfferingPeer) {

            peerConnection?.createOffer(SDPCreateCallback(this::createDescriptorCallback), MediaConstraints())
        }
    }

    private fun handleLocalIceCandidate(candidate: IceCandidate) {
        Log.w(TAG, "Local ICE candidate: $candidate")
        signaler.sendCandidate(candidate.sdpMLineIndex, candidate.sdpMid, candidate.sdp)
    }

    private fun attachRemoteVideoTrack(track: VideoTrack) {
        executor.execute {
            if (remoteVideoTrack === track) return@execute
            remoteVideoTrack?.removeSink(videoRenderers.remote)
            remoteVideoTrack = track
            track.setEnabled(true)
            track.addSink(videoRenderers.remote)
            onStatusChangedListener(VideoCallStatus.CONNECTED)
        }
    }

    private fun removeRemoteStream() {
        onStatusChangedListener(VideoCallStatus.FINISHED)
    }

    private fun handleRemoteCandidate(label: Int, id: String?, strCandidate: String) {
        Log.i(TAG, "Got remote ICE candidate $strCandidate")
        executor.execute {
            val candidate = IceCandidate(id ?: "", label, strCandidate)
            peerConnection?.addIceCandidate(candidate)
        }
    }

    private fun setupMediaDevices() {
        val capturer = createCameraCapturer()
        if (capturer == null) {
            Log.e(TAG, "No camera available for the call")
            onStatusChangedListener(VideoCallStatus.FAILED)
            return
        }
        videoCapturer = capturer
        val source = factory?.createVideoSource(capturer.isScreencast)
        if (source == null) {
            Log.e(TAG, "Could not create video source")
            onStatusChangedListener(VideoCallStatus.FAILED)
            return
        }
        videoSource = source
        val helper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        surfaceTextureHelper = helper
        capturer.initialize(helper, context, source.capturerObserver)
        capturer.startCapture(640, 480, 24)

        val videoTrack = factory?.createVideoTrack(VIDEO_TRACK_LABEL, source)
        if (videoTrack == null) {
            Log.e(TAG, "Could not create video track")
            onStatusChangedListener(VideoCallStatus.FAILED)
            return
        }
        localVideoTrack = videoTrack
        videoTrack.addSink(videoRenderers.local)

        val microphoneSource = factory?.createAudioSource(createAudioConstraints())
        if (microphoneSource == null) {
            Log.e(TAG, "Could not create microphone source")
            onStatusChangedListener(VideoCallStatus.FAILED)
            return
        }
        audioSource = microphoneSource
        val audioTrack = factory?.createAudioTrack(AUDIO_TRACK_LABEL, microphoneSource)
        if (audioTrack == null || peerConnection?.addTrack(videoTrack, listOf(STREAM_LABEL)) == null ||
            peerConnection?.addTrack(audioTrack, listOf(STREAM_LABEL)) == null) {
            Log.e(TAG, "Could not add camera and microphone to the call")
            onStatusChangedListener(VideoCallStatus.FAILED)
        }
    }

    private fun createCameraCapturer(): VideoCapturer? {
        val cameras = listOfNotNull(
            if (Camera2Enumerator.isSupported(context)) Camera2Enumerator(context) else null,
            Camera1Enumerator(true)
        )
        for (camera in cameras) {
            val device = selectPreferredCamera(camera.deviceNames, camera::isFrontFacing) ?: continue
            camera.createCapturer(device, null)?.let { return it }
        }
        return null
    }

    private fun createAudioConstraints(): MediaConstraints {
        val audioConstraints = MediaConstraints()
        audioConstraints.mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "false"))
        audioConstraints.mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "false"))
        audioConstraints.mandatory.add(MediaConstraints.KeyValuePair("googHighpassFilter", "false"))
        audioConstraints.mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "false"))
        return audioConstraints
    }

    private fun handleRemoteDescriptor(sdp: String) {
        if(isOfferingPeer) {
            peerConnection?.setRemoteDescription(SDPSetCallback({ setError ->
                if (setError != null) {
                    Log.e(TAG, "setRemoteDescription failed: $setError")
                }
            }), SessionDescription(SessionDescription.Type.ANSWER, sdp))
        } else {
            peerConnection?.setRemoteDescription(SDPSetCallback({ setError ->
                if (setError != null) {
                    Log.e(TAG, "Receiving offer setRemoteDescription failed: $setError")
                    isOfferingPeer = true
                    start()
                } else {
                    peerConnection?.createAnswer(SDPCreateCallback(this::createDescriptorCallback), MediaConstraints())
                }
            }), SessionDescription(SessionDescription.Type.OFFER, sdp))
        }
    }

    private fun createDescriptorCallback(result: SDPCreateResult) {
        when(result) {
            is SDPCreateSuccess -> {
                peerConnection?.setLocalDescription(SDPSetCallback({ setResult ->
                    Log.i(TAG, "SetLocalDescription: $setResult")
                }), result.descriptor)
                signaler.sendSDP(result.descriptor.description)
            }
            is SDPCreateFailure -> Log.e(TAG, "Error creating offer: ${result.reason}")
        }
    }

    private fun onMessage(message: ClientMessage) {
        when(message) {
            is MatchMessage -> {
                onStatusChangedListener(VideoCallStatus.CONNECTING)
                isOfferingPeer = message.offer
                start()
            }
            is SDPMessage -> {

                handleRemoteDescriptor(message.sdp)
            }
            is AnswerMessage -> {
                handleRemoteDescriptor(message.sdp)
            }
            is ICEMessage -> {
                handleRemoteCandidate(message.label, message.id, message.candidate)
            }
            is PeerLeft -> {
                onStatusChangedListener(VideoCallStatus.FINISHED)
            }
            is OnGoingCall -> {
                onStatusChangedListener(VideoCallStatus.ON_GOING_CALL)
            }
        }
    }

    fun terminate() {
        signaler.close()
        try {
            videoCapturer?.stopCapture()
        } catch (interrupted: InterruptedException) {
            Log.e(TAG, "Camera stop interrupted", interrupted)
            Thread.currentThread().interrupt()
        }

        localVideoTrack?.removeSink(videoRenderers.local)
        remoteVideoTrack?.removeSink(videoRenderers.remote)
        videoCapturer?.dispose()
        surfaceTextureHelper?.dispose()
        videoSource?.dispose()

        audioSource?.dispose()

        peerConnection?.dispose()

        factory?.dispose()

        eglBase.release()
    }


    companion object {

        fun connect(context: Context, url: String, videoRenderers: VideoRenderers, callback: (VideoCallStatus) -> Unit) : VideoCallSession {
            val websocketHandler = SignalingWebSocket()
            val session = VideoCallSession(context, callback, websocketHandler, videoRenderers)
            val client = OkHttpClient()
            val request = Request.Builder().url(url).build()
            Log.i(TAG, "Connecting to $url")
            client.newWebSocket(request, websocketHandler)
            client.dispatcher.executorService.shutdown()
            return session
        }

        private val STREAM_LABEL = "remoteStream"
        private val VIDEO_TRACK_LABEL = "remoteVideoTrack"
        private val AUDIO_TRACK_LABEL = "remoteAudioTrack"
        private val TAG = "VideoCallSession"
        private val executor = Executors.newSingleThreadExecutor()
    }

}