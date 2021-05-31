# Android and Web video call application with WebRTC 

Hybrid application for real-time peer to peer communication between Android and Web through signaling NodeJS server. Web part is developed with Angular framework and the Android part with Kotlin on Android Studio.


## Motivation

The project was inspired and developed within the framework of an internship and it aims to tackle the lack of easy access documentation about WebRTC on native android development and it's compatibility with web applications.

## Requirements
+ [Node.js](https://nodejs.org/)
+ [Angular](https://angular.io)
+ [Javascript/Typescript](https://www.javascript.com)
+ [Android Studio](https://developer.android.com/studio)
+ [Kotlin](https://kotlinlang.org/)



##  Getting Started

	Get the project from the repository
	git clone https://github.com/KostasZigo/Web-Android-WebRTC-app.git
    cd Web-Android-WebRTC-app
    
    Then you have to install npm on Web and server of the project 
    cd Web-app
    npm install
    
    cd server
    npm install 

	Start server with:
    yarn run start
    
    Start Web app with: 
    ng serve --open
    
Alternative you can find docker files for both web and server applications and build the images with Docker. There is also a docker-compose.yml in the server folder, that allows you to build both images into one environment.

**Important Note** 
You have to change the BACKEND_URL at VideoCallActivity.kt of Android application and use your own IP. The same thing must be done for Web application at WS_ENDPOINT of data.service.ts .

## Usage

#### Android Usage
 1. Run the Android app and press the ***CONNECT*** button.
 2. You will connect to the first available user and communication will be started.
 3. You can press the red button to hang up at any time.

#### Web Usage
 1. Enter localhost:4200 from your browser to connect to the application.
 2. In order to open your camera press the ***Start*** button and to close it press the ***Stop*** button.
 3. Press the ***Call*** button to start the communication with the first available user.
 4. Press the ***Hangup*** button to stop the communication.

## Reference

+ [droid roulette](https://github.com/agilityfeat/droid-roulette)
+ [Wolfgang Liegel](https://github.com/wliegel/youtube_webrtc_tutorial) - [Angular WebRTC]

## Contributors

+ [Konstantinos Zigogiannis Mplionas](https://github.com/KostasZigo)
+ [Konstantinos Kyratsous](https://github.com/KonstantinosKyratsous)
+ [Vasiliki Kanakari](https://github.com/vasilikikan)
