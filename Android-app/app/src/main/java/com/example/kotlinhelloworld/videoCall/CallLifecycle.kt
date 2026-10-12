package com.example.kotlinhelloworld.videoCall

internal class CallLifecycle(
    private val onStatus: (VideoCallStatus) -> Unit,
    private val onRelease: () -> Unit
) {
    @Volatile private var ended = false
    private var status: VideoCallStatus? = null

    val active: Boolean
        get() = !ended

    @Synchronized
    fun update(next: VideoCallStatus) {
        if (ended || status == next) return
        status = next
        if (next == VideoCallStatus.FAILED || next == VideoCallStatus.FINISHED ||
            next == VideoCallStatus.ON_GOING_CALL) {
            ended = true
        }
        try {
            onStatus(next)
        } finally {
            if (ended) onRelease()
        }
    }

    @Synchronized
    fun close() {
        if (ended) return
        ended = true
        onRelease()
    }
}

internal class CallResources(
    private val closePeer: () -> Unit,
    private val detachVideo: () -> Unit,
    private val stopCamera: () -> Unit,
    private val disposeCapture: () -> Unit,
    private val disposeMedia: () -> Unit,
    private val disposePeer: () -> Unit,
    private val releaseContext: () -> Unit
) {
    private var released = false

    @Synchronized
    fun release() {
        if (released) return
        released = true
        try {
            closePeer()
        } finally {
            try {
                detachVideo()
            } finally {
                try {
                    stopCamera()
                } finally {
                    try {
                        disposeCapture()
                    } finally {
                        try {
                            disposeMedia()
                        } finally {
                            try {
                                disposePeer()
                            } finally {
                                releaseContext()
                            }
                        }
                    }
                }
            }
        }
    }
}
