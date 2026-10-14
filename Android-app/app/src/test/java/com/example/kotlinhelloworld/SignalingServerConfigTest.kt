package com.example.kotlinhelloworld

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class SignalingServerConfigTest {
    @Test
    fun `accepts a developer configured secure gateway`() {
        assertEquals(
            "wss://calls.example.com/signaling/",
            SignalingServerConfig.usableAddress("wss://calls.example.com/signaling/", false)
        )
        assertEquals(
            "wss://staging.example.com:8443/",
            SignalingServerConfig.usableAddress("wss://staging.example.com:8443/", false)
        )
    }

    @Test
    fun `debug build can reach the Compose server via the emulator host`() {
        val emulatorUrl = "ws://10.0.2.2:8000/"
        assertEquals(emulatorUrl, SignalingServerConfig.usableAddress(emulatorUrl, true))
        assertNull(SignalingServerConfig.usableAddress(emulatorUrl, false))
        assertNotNull(
            SignalingServerConfig.usableAddress(BuildConfig.SIGNALING_SERVER_URL, BuildConfig.DEBUG)
        )
    }

    @Test
    fun `rejects a missing placeholder or unusable build address`() {
        listOf(
            "", " ", "REPLACE_WITH_PRODUCTION_WSS_URL",
            " wss://calls.example.com/signaling/ ", "10.0.2.2:8000",
            "https://calls.example.com/signaling/",
            "wss:///signaling/", "wss://calls.example.com:0/",
            "wss://calls.example.com:99999/", "wss://calls.example.com/space here"
        ).forEach { address ->
            assertNull(address, SignalingServerConfig.usableAddress(address, true))
        }
    }

    @Test
    fun `rejects credentials and tokens in a build address`() {
        listOf(
            "wss://user:password@calls.example.com/signaling/",
            "wss://calls.example.com/signaling/?token=secret",
            "wss://calls.example.com/signaling/#secret"
        ).forEach { address ->
            assertNull(address, SignalingServerConfig.usableAddress(address, false))
        }
    }
}
