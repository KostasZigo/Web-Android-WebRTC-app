package com.example.kotlinhelloworld

import okhttp3.Request
import java.net.URI
import java.net.URISyntaxException
import java.util.Locale

internal object SignalingServerConfig {
    fun usableAddress(address: String, allowCleartext: Boolean): String? {
        val uri = try {
            URI(address)
        } catch (_: URISyntaxException) {
            return null
        }
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        if (scheme != "wss" && (scheme != "ws" || !allowCleartext)) return null
        if (uri.host.isNullOrBlank() || uri.rawUserInfo != null ||
            uri.rawQuery != null || uri.rawFragment != null ||
            uri.port == 0 || uri.port > 65535) return null
        return try {
            Request.Builder().url(address).build()
            address
        } catch (_: IllegalArgumentException) {
            null
        }
    }
}
