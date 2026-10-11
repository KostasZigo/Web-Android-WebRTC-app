package com.example.kotlinhelloworld

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import com.example.kotlinhelloworld.videoCall.VideoCallStatus

internal object CallUiPolicy {
    val requiredPermissions = listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)

    @SuppressLint("InlinedApi")
    fun permissionsForCall(localNetworkRequired: Boolean): List<String> =
        if (localNetworkRequired) requiredPermissions + Manifest.permission.ACCESS_LOCAL_NETWORK
        else requiredPermissions

    fun hasCallPermissions(permissions: Array<String>, grantResults: IntArray): Boolean {
        return deniedPermissions(permissions, grantResults, false).isEmpty()
    }

    fun deniedPermissions(
        permissions: Array<String>,
        grantResults: IntArray,
        localNetworkRequired: Boolean
    ): List<String> {
        val required = permissionsForCall(localNetworkRequired)
        if (permissions.size != grantResults.size) return required
        val resultsByPermission = permissions.zip(grantResults.toTypedArray()).toMap()
        return required.filter {
            resultsByPermission[it] != PackageManager.PERMISSION_GRANTED
        }
    }

    fun noticeFor(status: VideoCallStatus): Int? = when (status) {
        VideoCallStatus.FINISHED -> R.string.call_finished_message
        VideoCallStatus.ON_GOING_CALL -> R.string.call_busy_message
        else -> null
    }
}
