package com.example.kotlinhelloworld

import android.Manifest
import android.content.pm.PackageManager
import com.example.kotlinhelloworld.videoCall.VideoCallStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CallUiPolicyTest {
    @Test
    fun `starts calls only when camera and microphone are granted`() {
        assertTrue(CallUiPolicy.hasCallPermissions(
            arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
            intArrayOf(PackageManager.PERMISSION_GRANTED, PackageManager.PERMISSION_GRANTED)
        ))
        assertTrue(CallUiPolicy.hasCallPermissions(
            arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA),
            intArrayOf(PackageManager.PERMISSION_GRANTED, PackageManager.PERMISSION_GRANTED)
        ))
    }

    @Test
    fun `does not start when either permission is denied`() {
        val permissions = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        assertFalse(CallUiPolicy.hasCallPermissions(
            permissions,
            intArrayOf(PackageManager.PERMISSION_DENIED, PackageManager.PERMISSION_GRANTED)
        ))
        assertFalse(CallUiPolicy.hasCallPermissions(
            permissions,
            intArrayOf(PackageManager.PERMISSION_GRANTED, PackageManager.PERMISSION_DENIED)
        ))
    }

    @Test
    fun `does not start on missing or incomplete permission responses`() {
        assertFalse(CallUiPolicy.hasCallPermissions(emptyArray(), intArrayOf()))
        assertFalse(CallUiPolicy.hasCallPermissions(
            arrayOf(Manifest.permission.CAMERA),
            intArrayOf(PackageManager.PERMISSION_GRANTED)
        ))
        assertFalse(CallUiPolicy.hasCallPermissions(
            arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
            intArrayOf(PackageManager.PERMISSION_GRANTED)
        ))
    }

    @Test
    fun `shows a reason when a call ends or the other pair is busy`() {
        assertEquals(R.string.call_finished_message, CallUiPolicy.noticeFor(VideoCallStatus.FINISHED))
        assertEquals(R.string.call_busy_message, CallUiPolicy.noticeFor(VideoCallStatus.ON_GOING_CALL))
    }

    @Test
    fun `keeps active and failed statuses on the call screen`() {
        VideoCallStatus.values()
            .filterNot { it == VideoCallStatus.FINISHED || it == VideoCallStatus.ON_GOING_CALL }
            .forEach { assertNull(CallUiPolicy.noticeFor(it)) }
    }
}
