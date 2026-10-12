package com.example.kotlinhelloworld.videoCall

import android.content.Context
import android.util.Log
import com.example.kotlinhelloworld.R
import okhttp3.OkHttpClient
import okhttp3.Request
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.Camera1Enumerator
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.CapturerObserver
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
import org.webrtc.VideoFrame
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

class VideoCallSession private constructor(
    private val context: Context,
    private val request: Request,
    onStatusChanged: (VideoCallStatus) -> Unit,
    private val signaler: SignalingWebSocket,
    private val videoRenderers: VideoRenderers
) {
    private val eglBase = EglBase.create()
    private val client = OkHttpClient()
    private val executor = Executors.newSingleThreadExecutor()
    private val queueLock = Any()
    private val completionLock = Any()
    private val completionCallbacks = mutableListOf<() -> Unit>()
    private var resourcesReleased = false
    private var started = false
    private val lifecycle = CallLifecycle(onStatusChanged, this::release)

    private var peerConnection: PeerConnection? = null
    private var factory: PeerConnectionFactory? = null
    private var negotiator: SdpNegotiator? = null
    private var videoSource: VideoSource? = null
    private var audioSource: AudioSource? = null
    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var localVideoTrack: VideoTrack? = null
    private var audioTrack: AudioTrack? = null
    private var remoteVideoTrack: VideoTrack? = null
    private var captureStarted = false

    private val resources = CallResources(
        closePeer = { peerConnection?.close() },
        detachVideo = {
            try { localVideoTrack?.removeSink(videoRenderers.local) }
            finally { remoteVideoTrack?.removeSink(videoRenderers.remote) }
        },
        stopCamera = { if (captureStarted) videoCapturer?.stopCapture() },
        disposeCapture = {
            try { videoCapturer?.dispose() }
            finally { surfaceTextureHelper?.dispose() }
        },
        disposeMedia = {
            try { localVideoTrack?.dispose() }
            finally {
                try { audioTrack?.dispose() }
                finally {
                    try { videoSource?.dispose() }
                    finally { audioSource?.dispose() }
                }
            }
        },
        disposePeer = {
            try { peerConnection?.dispose() }
            finally { factory?.dispose() }
        },
        releaseContext = { eglBase.release() }
    )

    val renderContext: EglBase.Context
        get() = eglBase.eglBaseContext

    init {
        signaler.messageHandler = { message -> dispatch { handleMessage(message) } }
        signaler.errorHandler = { error -> dispatch { fail("Signaling failed", error) } }
        lifecycle.update(VideoCallStatus.MATCHING)
    }

    fun start() {
        val socket = synchronized(queueLock) {
            check(!started) { "Call has already started" }
            started = true
            if (!lifecycle.active) return
            executor.execute {
                if (lifecycle.active) {
                    try {
                        initialize()
                    } catch (denied: SecurityException) {
                        fail("Call permission was lost", denied)
                    } catch (invalid: IllegalStateException) {
                        fail("Could not initialize the call", invalid)
                    }
                }
            }
            client.newWebSocket(request, signaler)
        }
        signaler.track(socket)
    }

    private fun dispatch(action: () -> Unit) {
        synchronized(queueLock) {
            if (!lifecycle.active) return
            executor.execute { if (lifecycle.active) action() }
        }
    }

    private fun initialize() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .createPeerConnectionFactory()

        val config = PeerConnection.RTCConfiguration(
            listOf(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())
        )
        config.continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        config.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        val events = SimpleRTCEventHandler(
            onIceCandidate = { candidate ->
                dispatch { signaler.sendCandidate(candidate.sdpMLineIndex, candidate.sdpMid, candidate.sdp) }
            },
            onVideoTrack = { track -> dispatch { attachRemoteVideoTrack(track) } },
            onStatus = { status ->
                dispatch {
                    if (status == VideoCallStatus.FAILED) fail("Peer connection failed")
                    else lifecycle.update(status)
                }
            }
        )
        val connection = factory?.createPeerConnection(config, events)
        if (connection == null) return fail("Could not create peer connection")
        peerConnection = connection
        negotiator = SdpNegotiator(
            object : SdpPeer {
                override fun create(type: SessionDescription.Type, callback: (SDPCreateResult) -> Unit) {
                    val observer = SDPCreateCallback { result -> dispatch { callback(result) } }
                    if (type == SessionDescription.Type.OFFER) connection.createOffer(observer, MediaConstraints())
                    else connection.createAnswer(observer, MediaConstraints())
                }
                override fun setLocal(description: SessionDescription, callback: (String?) -> Unit) {
                    connection.setLocalDescription(SDPSetCallback { error -> dispatch { callback(error) } }, description)
                }
                override fun setRemote(description: SessionDescription, callback: (String?) -> Unit) {
                    connection.setRemoteDescription(SDPSetCallback { error -> dispatch { callback(error) } }, description)
                }
                override fun addCandidate(candidate: IceCandidate): Boolean = connection.addIceCandidate(candidate)
            },
            lifecycle,
            signaler::sendSDP,
            { reason -> Log.e(TAG, reason) }
        )
        setupMediaDevices()
    }

    private fun attachRemoteVideoTrack(track: VideoTrack) {
        if (remoteVideoTrack === track) return
        remoteVideoTrack?.removeSink(videoRenderers.remote)
        remoteVideoTrack = track
        track.setEnabled(true)
        track.addSink(videoRenderers.remote)
        lifecycle.update(VideoCallStatus.CONNECTED)
    }

    private fun setupMediaDevices() {
        val capturer = createCameraCapturer() ?: return fail("No camera available for the call")
        videoCapturer = capturer
        val source = factory?.createVideoSource(capturer.isScreencast)
            ?: return fail("Could not create video source")
        videoSource = source
        val helper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
            ?: return fail("Could not initialize camera capture")
        surfaceTextureHelper = helper
        val sourceObserver = source.capturerObserver
        capturer.initialize(helper, context, object : CapturerObserver {
            override fun onCapturerStarted(success: Boolean) {
                sourceObserver.onCapturerStarted(success)
                if (!success) dispatch { fail("Camera capture could not start") }
            }
            override fun onCapturerStopped() = sourceObserver.onCapturerStopped()
            override fun onFrameCaptured(frame: VideoFrame) = sourceObserver.onFrameCaptured(frame)
        })
        captureStarted = true
        try {
            capturer.startCapture(640, 480, 24)
        } catch (denied: SecurityException) {
            return fail("Camera permission was lost", denied)
        } catch (invalid: IllegalStateException) {
            return fail("Camera capture could not start", invalid)
        }

        val videoTrack = factory?.createVideoTrack(VIDEO_TRACK_LABEL, source)
            ?: return fail("Could not create video track")
        localVideoTrack = videoTrack
        videoTrack.addSink(videoRenderers.local)
        val microphone = factory?.createAudioSource(createAudioConstraints())
            ?: return fail("Could not create microphone source")
        audioSource = microphone
        val microphoneTrack = factory?.createAudioTrack(AUDIO_TRACK_LABEL, microphone)
            ?: return fail("Could not create microphone track")
        audioTrack = microphoneTrack
        if (peerConnection?.addTrack(videoTrack, listOf(STREAM_LABEL)) == null ||
            peerConnection?.addTrack(microphoneTrack, listOf(STREAM_LABEL)) == null) {
            fail("Could not add camera and microphone to the call")
        }
    }

    private fun createCameraCapturer(): VideoCapturer? {
        val events = object : CameraVideoCapturer.CameraEventsHandler {
            override fun onCameraError(error: String) { dispatch { fail("Camera error: $error") } }
            override fun onCameraDisconnected() { dispatch { fail("Camera disconnected") } }
            override fun onCameraFreezed(error: String) { dispatch { fail("Camera froze: $error") } }
            override fun onCameraOpening(cameraName: String) = Unit
            override fun onFirstFrameAvailable() = Unit
            override fun onCameraClosed() = Unit
        }
        val cameras = listOfNotNull(
            if (Camera2Enumerator.isSupported(context)) Camera2Enumerator(context) else null,
            Camera1Enumerator(true)
        )
        for (camera in cameras) {
            val device = selectPreferredCamera(camera.deviceNames, camera::isFrontFacing) ?: continue
            camera.createCapturer(device, events)?.let { return it }
        }
        return null
    }

    private fun createAudioConstraints(): MediaConstraints {
        val constraints = MediaConstraints()
        constraints.mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "false"))
        constraints.mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "false"))
        constraints.mandatory.add(MediaConstraints.KeyValuePair("googHighpassFilter", "false"))
        constraints.mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "false"))
        return constraints
    }

    private fun handleMessage(message: ClientMessage) {
        when (message) {
            is MatchMessage -> {
                lifecycle.update(VideoCallStatus.CONNECTING)
                negotiator?.matched(message.offer) ?: fail("Peer connection is not ready")
            }
            is SDPMessage, is AnswerMessage ->
                negotiator?.receiveDescription(message) ?: fail("Peer connection is not ready")
            is ICEMessage -> negotiator?.receiveCandidate(message) ?: fail("Peer connection is not ready")
            PeerLeft -> lifecycle.update(VideoCallStatus.FINISHED)
            OnGoingCall -> lifecycle.update(VideoCallStatus.ON_GOING_CALL)
        }
    }

    private fun fail(reason: String, error: Throwable? = null) {
        Log.e(TAG, reason, error)
        lifecycle.update(VideoCallStatus.FAILED)
    }

    fun terminate(onReleased: () -> Unit) {
        val done = synchronized(completionLock) {
            if (resourcesReleased) true else {
                completionCallbacks.add(onReleased)
                false
            }
        }
        if (done) onReleased()
        lifecycle.close()
    }

    private fun release() {
        signaler.close()
        synchronized(queueLock) {
            executor.execute {
                try {
                    resources.release()
                } catch (interrupted: InterruptedException) {
                    Log.e(TAG, "Camera stop interrupted", interrupted)
                    Thread.currentThread().interrupt()
                } catch (error: RuntimeException) {
                    Log.e(TAG, "Call resource cleanup failed", error)
                } finally {
                    try {
                        client.dispatcher.executorService.shutdown()
                        client.connectionPool.evictAll()
                    } finally {
                        val callbacks = synchronized(completionLock) {
                            resourcesReleased = true
                            completionCallbacks.toList().also { completionCallbacks.clear() }
                        }
                        callbacks.forEach { it() }
                    }
                }
            }
            executor.shutdown()
        }
    }

    internal class SimpleRTCEventHandler(
        private val onIceCandidate: (IceCandidate) -> Unit,
        private val onVideoTrack: (VideoTrack) -> Unit,
        private val onStatus: (VideoCallStatus) -> Unit
    ) : PeerConnection.Observer {
        override fun onIceCandidate(candidate: IceCandidate?) {
            if (candidate != null) onIceCandidate(candidate)
        }
        override fun onTrack(transceiver: RtpTransceiver?) {
            (transceiver?.receiver?.track() as? VideoTrack)?.let(onVideoTrack)
        }
        override fun onAddStream(stream: MediaStream?) {
            stream?.videoTracks?.firstOrNull()?.let(onVideoTrack)
        }
        override fun onRemoveStream(stream: MediaStream?) {
            if (stream != null) onStatus(VideoCallStatus.FINISHED)
        }
        override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
            when (newState) {
                PeerConnection.IceConnectionState.CONNECTED, PeerConnection.IceConnectionState.COMPLETED ->
                    onStatus(VideoCallStatus.CONNECTED)
                PeerConnection.IceConnectionState.DISCONNECTED -> onStatus(VideoCallStatus.CONNECTING)
                PeerConnection.IceConnectionState.FAILED -> onStatus(VideoCallStatus.FAILED)
                PeerConnection.IceConnectionState.CLOSED -> onStatus(VideoCallStatus.FINISHED)
                else -> Unit
            }
        }
        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
            when (newState) {
                PeerConnection.PeerConnectionState.CONNECTED -> onStatus(VideoCallStatus.CONNECTED)
                PeerConnection.PeerConnectionState.DISCONNECTED -> onStatus(VideoCallStatus.CONNECTING)
                PeerConnection.PeerConnectionState.FAILED -> onStatus(VideoCallStatus.FAILED)
                PeerConnection.PeerConnectionState.CLOSED -> onStatus(VideoCallStatus.FINISHED)
                else -> Unit
            }
        }
        override fun onDataChannel(channel: DataChannel?) = Unit
        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) = Unit
        override fun onSignalingChange(state: PeerConnection.SignalingState?) = Unit
        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) = Unit
        override fun onRenegotiationNeeded() = Unit
    }

    companion object {
        fun create(
            context: Context,
            url: String,
            videoRenderers: VideoRenderers,
            callback: (VideoCallStatus) -> Unit
        ): VideoCallSession = VideoCallSession(
            context, Request.Builder().url(url).build(), callback, SignalingWebSocket(), videoRenderers
        )

        private const val STREAM_LABEL = "remoteStream"
        private const val VIDEO_TRACK_LABEL = "remoteVideoTrack"
        private const val AUDIO_TRACK_LABEL = "remoteAudioTrack"
        private const val TAG = "VideoCallSession"
    }
}
