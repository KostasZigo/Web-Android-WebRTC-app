package com.example.kotlinhelloworld

import android.widget.EditText
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.assertion.ViewAssertions.doesNotExist
import androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivityTest {
    @Test
    fun connectsWithoutAskingForAServerAddress() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val monitor = instrumentation.addMonitor(VideoCallActivity::class.java.name, null, false)
        try {
            ActivityScenario.launch(MainActivity::class.java).use {
                onView(isAssignableFrom(EditText::class.java)).check(doesNotExist())
                onView(withId(R.id.connectButton)).perform(click())
                val call = instrumentation.waitForMonitorWithTimeout(monitor, 10_000)
                assertNotNull("Connect should open the call screen", call)
                instrumentation.runOnMainSync { call.finish() }
            }
        } finally {
            instrumentation.removeMonitor(monitor)
        }
    }
}
