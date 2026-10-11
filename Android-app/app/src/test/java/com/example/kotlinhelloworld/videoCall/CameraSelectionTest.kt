package com.example.kotlinhelloworld.videoCall

import android.Manifest
import android.content.pm.PackageManager
import com.example.kotlinhelloworld.CallUiPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class CameraSelectionTest {
    @Test
    fun `uses the front camera when one is available`() {
        assertEquals("front", selectPreferredCamera(arrayOf("back", "front")) { it == "front" })
    }

    @Test
    fun `uses another camera when there is no front camera`() {
        assertEquals("external", selectPreferredCamera(arrayOf("external", "back")) { false })
    }

    @Test
    fun `does not select a camera when there are no devices`() {
        assertNull(selectPreferredCamera(emptyArray()) { true })
    }

    @Test
    fun `Android 17 calls need local network access as well as camera and microphone`() {
        val permissions = CallUiPolicy.permissionsForCall(localNetworkRequired = true).toTypedArray()
        val granted = intArrayOf(
            PackageManager.PERMISSION_GRANTED,
            PackageManager.PERMISSION_GRANTED,
            PackageManager.PERMISSION_GRANTED
        )
        assertEquals(emptyList<String>(), CallUiPolicy.deniedPermissions(permissions, granted, true))
        assertEquals(
            listOf(Manifest.permission.ACCESS_LOCAL_NETWORK),
            CallUiPolicy.deniedPermissions(
                permissions,
                intArrayOf(
                    PackageManager.PERMISSION_GRANTED,
                    PackageManager.PERMISSION_GRANTED,
                    PackageManager.PERMISSION_DENIED
                ),
                true
            )
        )
        assertEquals(
            listOf(Manifest.permission.ACCESS_LOCAL_NETWORK),
            CallUiPolicy.deniedPermissions(
                arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
                granted.copyOf(2),
                true
            )
        )
    }

    @Test
    fun `older Android calls do not request local network access`() {
        val permissions = CallUiPolicy.permissionsForCall(localNetworkRequired = false)
        assertEquals(
            listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
            permissions
        )
        assertFalse(Manifest.permission.ACCESS_LOCAL_NETWORK in permissions)
    }
}
