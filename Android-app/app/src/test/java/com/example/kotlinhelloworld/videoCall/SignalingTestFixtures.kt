package com.example.kotlinhelloworld.videoCall

import org.json.JSONObject
import org.junit.Assert.assertEquals

internal fun signalingFixture(name: String): String =
    requireNotNull(Thread.currentThread().contextClassLoader?.getResource("$name.json")) {
        "Missing shared signaling fixture: $name"
    }.readText()

internal fun assertSameWireMessage(expected: String, actual: String) {
    val expectedJson = JSONObject(expected)
    val actualJson = JSONObject(actual)
    val expectedKeys = expectedJson.keys().asSequence().toSet()
    assertEquals(expectedKeys, actualJson.keys().asSequence().toSet())
    expectedKeys.forEach { key ->
        assertEquals(key, expectedJson.get(key), actualJson.get(key))
    }
}
