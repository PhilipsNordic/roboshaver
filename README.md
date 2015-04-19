## Introduction ##

This application enables over-the-internet control of a lynxmotion robotic arm in real-time using **webRTC** and [hydna](https://hydna.com) for signaling. This application works as an interface between the web-client found in **public/index.html** and the AL5D Robotic arm from [lynx motion](http://www.lynxmotion.com). Commands are sent over [hydna](https://hydna.com) from the web-client **public/index.html** to the **receiver.js** node application which tells the robotarm to move.


## Installation ##

**Note:** this has been tested on macosx, the usbserial interface might work differently on other platforms. 

1. Clone this repository
2. This application uses hydna for real-time communication and signaling, (it's possibly to use other real-time libraries/services but hydna saves time and you don't need to setup your own server). Go to [hydna.com](https://hydna.com) and create a free domain. Once you have your domain enter it's name as instructed in **receiver.js** for **CONTROL_CHANNEL**.
3. Copy the contents of **behavior.be** and paste it into your hydna domains behavior box found in your domains control panel. Now change the **VIEW_PASSWORD** and **CONTROL_PASSWORD** to your choosen passwords. Save changes by pressing Save and deploy.
4. Ensure you have **node.js** installed on your system
5. Navigate to your repository directory and in your terminal write:

    ```
    npm install
    ```
6. Install the correct drivers for your system to enable usb-serial communication with the ssc32u [http://www.ftdichip.com/Drivers/VCP.htm](http://www.ftdichip.com/Drivers/VCP.htm)
7. When the drivers are installed, connect your robotarm by usb, turn on the power and in your terminal issue the following command:

    ```
    ls /dev/cu.*
    ```
You will now get a list with the connected usb devices, if the **ssc32u** was detected and drivers properly installed we should see: 

    ```
    /dev/cu.usbserial-A1028AKN
    ```
8. To start the program type:

    ```
    node receiver.js
    ```
9. Upload the contents of the **public** folder to your hosting of choice or run the web application locally by running a local server on your machine.
installing local server:

    ```
    npm install http-server -g
    ```
example of running locally:

    ```
    http-server -p 8000
    open http://localhost:8000
    ```
10. Press "Control arm" password is: **CONTROL_PASSWORD** you entered in the behaviors in step 3. If everything has been done according to the instructions the arm should move into "action" position and be ready to be controlled in the web-interface. To enable video stream with 3rd party choose your camera in upper right corner, press "use selected" and enter **VIEW_PASSWORD**.

11. Remember to turn off the arm after max 30 min of use. Let it rest for a minute or two before turning it on again.

