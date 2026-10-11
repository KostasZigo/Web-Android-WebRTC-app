package com.example.kotlinhelloworld

import android.Manifest
import android.content.pm.PackageManager
import com.example.kotlinhelloworld.videoCall.VideoCallStatus

internal object CallUiPolicy {
    val requiredPermissions = listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)

    fun hasCallPermissions(permissions: Array<String>, grantResults: IntArray): Boolean {
        if (permissions.size != grantResults.size) return false
        val resultsByPermission = permissions.zip(grantResults.toTypedArray()).toMap()
        return requiredPermissions.all {
            resultsByPermission[it] == PackageManager.PERMISSION_GRANTED
        }
    }

    fun noticeFor(status: VideoCallStatus): Int? = when (status) {
        VideoCallStatus.FINISHED -> R.string.call_finished_message
        VideoCallStatus.ON_GOING_CALL -> R.string.call_busy_message
        else -> null
    }
}
