package com.example.kotlinhelloworld

import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.example.kotlinhelloworld.databinding.ActivityVideoCallBinding
import com.example.kotlinhelloworld.videoCall.VideoCallSession
import com.example.kotlinhelloworld.videoCall.VideoCallStatus
import com.example.kotlinhelloworld.videoCall.VideoRenderers
import org.webrtc.RendererCommon

class VideoCallActivity : AppCompatActivity() {
    private lateinit var binding: ActivityVideoCallBinding
    private var videoSession: VideoCallSession? = null
    private var audioManager: AudioManager? = null
    private var savedMicrophoneState: Boolean? = null
    private var savedAudioMode: Int? = null
    private var exitNoticeShown = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityVideoCallBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.hangupButton.setOnClickListener {
            finish()
        }

        handlePermissions()
    }

    override fun onDestroy() {
        try {
            videoSession?.terminate()
            videoSession = null
            binding.pipVideo.release()
            binding.remoteVideo.release()
        } finally {
            audioManager?.let { manager ->
                savedAudioMode?.let { manager.mode = it }
                savedMicrophoneState?.let { manager.isMicrophoneMute = it }
            }
            super.onDestroy()
        }
    }

    private fun onStatusChanged(newStatus: VideoCallStatus) {
        Log.d(TAG, "New call status: $newStatus")
        runOnUiThread {
            if (isFinishing || isDestroyed || exitNoticeShown) return@runOnUiThread
            val notice = CallUiPolicy.noticeFor(newStatus)
            if (notice != null) {
                showExitNotice(notice)
            } else {
                binding.statusText.setText(newStatus.label)
                binding.statusText.setTextColor(ContextCompat.getColor(this, newStatus.color))
            }
        }
    }

    private fun handlePermissions() {
        if (CallUiPolicy.requiredPermissions.all {
                ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
            }) {
            startVideoSession()
        } else {
            ActivityCompat.requestPermissions(
                this,
                CallUiPolicy.requiredPermissions.toTypedArray(),
                CAMERA_AUDIO_PERMISSION_REQUEST
            )
        }
    }

    private fun startVideoSession() {
        if (videoSession != null || isFinishing || isDestroyed) return
        val manager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager = manager
        savedAudioMode = manager.mode
        savedMicrophoneState = manager.isMicrophoneMute
        manager.mode = AudioManager.MODE_IN_COMMUNICATION
        manager.isMicrophoneMute = false

        val session = VideoCallSession.connect(
            this,
            BACKEND_URL,
            VideoRenderers(binding.pipVideo, binding.remoteVideo),
            this::onStatusChanged
        )
        videoSession = session

        binding.pipVideo.apply {
            init(session.renderContext, null)
            setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
            setZOrderMediaOverlay(true)
            setEnableHardwareScaler(true)
        }
        binding.remoteVideo.apply {
            init(session.renderContext, null)
            setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
            setEnableHardwareScaler(true)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != CAMERA_AUDIO_PERMISSION_REQUEST || isFinishing || isDestroyed) return
        if (CallUiPolicy.hasCallPermissions(permissions, grantResults)) {
            startVideoSession()
        } else {
            showExitNotice(R.string.call_permission_required)
        }
    }

    private fun showExitNotice(message: Int) {
        if (exitNoticeShown || isFinishing || isDestroyed) return
        exitNoticeShown = true
        AlertDialog.Builder(this)
            .setMessage(message)
            .setPositiveButton(android.R.string.ok) { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .show()
    }

    companion object {
        private const val CAMERA_AUDIO_PERMISSION_REQUEST = 1
        private const val TAG = "VideoCallActivity"
        private const val BACKEND_URL = "ws://192.168.1.4:8000/"
    }
}