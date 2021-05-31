package com.example.kotlinhelloworld


import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import kotlinx.android.synthetic.main.activity_main.*
import org.jetbrains.anko.toast
import android.content.Intent
import android.widget.Button

class MainActivity : AppCompatActivity() {


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        connectButton.setOnClickListener{}
        val connectButton: Button = findViewById(R.id.connectButton)
        connectButton.setOnClickListener {
            toast("Hello")
            startVideoCall()
        }
    }

    private fun startVideoCall() {
        startActivity(Intent(this, VideoCallActivity::class.java))
    }

}


