$(function() {

// replace below with your hydna domain
var HYDNA_DOMAIN = '';
var CONTROL_CHANNEL = HYDNA_DOMAIN + '/control';
var DRAG_THRESHOLD_Y = 20;
var DRAG_THRESHOLD_X = 30;

var speed = 1;
var defaultMotorSpeed = 200;
var motorSpeeds = {
    base: 200,
    shoulder: 150,
    elbow: 150,
    wrist: 200,
    hand: 200
}

var dragging = false;
var xdiff = 0;
var ydiff = 0;
var mousecontroller;
var center;
var enabled = false;
var speedMultiplier = 1.0;

var localVideo;
var remoteVideo;
var peerConnection;
var peerConnectionConfig = {'iceServers': [
    {'url': 'stun:stun.services.mozilla.com'},
    {'url': 'stun:stun.l.google.com:19302'}
]};

var videoConnection;
var controlConnection;

var supportsMediaTrack = false;

var audioSelect = $('#audioSource');
var videoSelect = $('#videoSource');
var startBtn = $('#start');

var keys = [
    {key: 'w', code:87, down: false},
    {key: 's', code:83, down: false},
    {key: 'd', code:68, down: false},
    {key: 'a', code:65, down: false},
    {key: 'up', code:38, down: false},
    {key: 'down', code:40, down: false},
    {key: 'left', code:37, down: false},
    {key: 'right', code:39, down: false},
    {key: 'shift', code:16, down: false}
];

var mouse = {
    left: 0,
    up: 0,
    down: 0,
    right: 0
};

var motors = {
    base: 0,
    shoulder: 0,
    elbow: 0,
    wrist: 0,
    hand: 0
};

function key(key) {
    for (var i = 0; i < keys.length; i++) {
        if (keys[i].key === key) {
            return keys[i];
        }
    }
    return null;
}

function disable() {
    $('#reset-btn').attr('disabled', 'disabled');
    $('#rest-btn').attr('disabled', 'disabled');
    $('#query-btn').attr('disabled', 'disabled');
    $('#move-btn').attr('disabled', 'disabled');
    center.css('opacity', 0.5);
    enabled = false;
    $('.message').html('Not connected!');
}

function enable() {
    $('#reset-btn').removeAttr('disabled');
    $('#rest-btn').removeAttr('disabled');
    $('#query-btn').removeAttr('disabled');
    $('#move-btn').removeAttr('disabled');
    center.css('opacity', 1.0);
    enabled = true;
    $('.message').html('Connected! Go ahead and control');
}

function enableControl() {
    $('#control-btn').removeAttr('disabled');
}

function disableControl() {
    $('#control-btn').attr('disabled', 'disabled');
}

function updateSpeed() {
    var newSpeed = parseFloat($('#speed').val());
    speedMultiplier = newSpeed;

    $('#speed').blur();
}

function connectArm(passwd) {
    controlConnection = new HydnaChannel(CONTROL_CHANNEL + '?' + passwd, 'rw');
    controlConnection.onopen = function(event) {
        $('.message').html('Resetting robot arm...');
        controlConnection.send('reset');
        setTimeout( function() {

            controlConnection.send('action');

            setTimeout(function() {
                enable();
                $('#loader').hide();
            }, 2100);

        }, 2200);
    }
    controlConnection.onclose = function(event) {
        if (event.wasDenied) {
            alert('Wrong password, try again!');
        }
        disable();
        $('#control-btn').removeAttr('disabled');
        $('#loader').hide();
    }

    $('#loader').show();
}

function checkMousePosition() {

    mouse.up = 0;
    mouse.down = 0;
    mouse.left = 0;
    mouse.right = 0;

    if (dragging) {

        if (Math.abs(xdiff) > DRAG_THRESHOLD_X) {
            if (xdiff > DRAG_THRESHOLD_X) {
                mouse.right = 1;
            } else if(xdiff < -DRAG_THRESHOLD_X) {
                mouse.left = 1;
            }
        }        
        if (Math.abs(ydiff) > DRAG_THRESHOLD_Y) {
            if (ydiff > DRAG_THRESHOLD_Y) {
                mouse.up = 1;
            } else if (ydiff < -DRAG_THRESHOLD_Y) {
                mouse.down = 1;
            }
        }

        sendCommand();
    }
}

function sendCommand() {

    for (var k in motors) {
        motors[k] = 0;
    }

    if (key('w').down) {
        motors.wrist = speed;
    }

    if (key('s').down) {
        motors.wrist = -speed;
    }

    if (key('a').down) {
        motors.hand = speed;
    }
    
    if (key('d').down) {
        motors.hand = -speed;
    }
    
    if (key('up').down) {
        if (key('shift').down) {
            motors.elbow = -speed;
        } else {
            motors.shoulder = -speed;
            motors.elbow = -speed;
        }
    }

    if (key('down').down) {
        if (key('shift').down) {
            motors.elbow = speed;
        } else {
            motors.shoulder = speed;
            motors.elbow = speed;
        }
    }

    if (key('right').down) {
        if (key('shift').down) {
            motors.hand = speed;
        } else {
            motors.base = speed;
        }
    }

    if (key('left').down) {
        if (key('shift').down) {
            motors.hand = -speed;
        } else {
            motors.base = -speed;
        }
    }

    if (mouse.left != 0) {
        if (key('shift').down) {
            motors.hand = -speed;
        } else {
            motors.base = speed;
        }
    }

    if (mouse.right != 0) {
        if (key('shift').down) {
            motors.hand = speed;
        } else {
            motors.base = -speed;
        }
    }

    if (mouse.up != 0) {
        if (key('shift').down) {
            motors.elbow = -speed;    
        } else {
            motors.elbow = -speed;
            motors.shoulder = -speed;
        }
    }

    if (mouse.down != 0) {
        if (key('shift').down) {
            motors.elbow = speed;
        } else {
            motors.elbow = speed;
            motors.shoulder = speed;
        }
    }

    var cmd = '0P' + motors.base;
    if (Math.round(motorSpeeds.base * speedMultiplier) != defaultMotorSpeed) {
        cmd = cmd + 'S' + Math.round(motorSpeeds.base * speedMultiplier);
    }

    cmd = cmd + '|1P' + motors.shoulder;
    if (Math.round(motorSpeeds.shoulder * speedMultiplier) != defaultMotorSpeed) {
        cmd = cmd + 'S' + Math.round(motorSpeeds.shoulder * speedMultiplier);
    }
    
    cmd = cmd + '|2P' + motors.elbow;
    if (Math.round(motorSpeeds.elbow * speedMultiplier) != defaultMotorSpeed) {
        cmd = cmd + 'S' + Math.round(motorSpeeds.elbow * speedMultiplier);
    }

    cmd = cmd + '|3P' + motors.wrist;
    if (Math.round(motorSpeeds.wrist * speedMultiplier) != defaultMotorSpeed) {
        cmd = cmd + 'S' + Math.round(motorSpeeds.wrist * speedMultiplier);
    }
    cmd = cmd + '|4P' + motors.hand;
    if (Math.round(motorSpeeds.hand * speedMultiplier) != defaultMotorSpeed) {
        cmd = cmd + 'S' + Math.round(motorSpeeds.hand * speedMultiplier);
    }

    controlConnection.send(cmd);

}

// video controls
function gotSources(sourceInfos) {
    var audioOptions = [];
    var videoOptions = [];

    for (var i = 0; i !== sourceInfos.length; ++i) {
        var sourceInfo = sourceInfos[i];
        var option = ''; 
        if (sourceInfo.kind === 'audio') {
            option = '<option value="'+sourceInfo.id+'">' + (sourceInfo.label || 'microphone') + ' ' + (audioOptions.length + 1) + '</option>';
            audioOptions.push(option);
        } else if (sourceInfo.kind === 'video') {
            option = '<option value="'+sourceInfo.id+'">' + (sourceInfo.label || 'video') + ' ' + (videoOptions.length + 1)+'</option>';
            videoOptions.push(option);
        }
    }

    audioSelect.html(audioOptions.join(''));
    videoSelect.html(videoOptions.join(''));
}

function getLocalMedia() {
    var constraints = {
        video: true
    };

    if (supportsMediaTrack) {
        var choosenVideo = videoSelect.val();
        var choosenAudio = audioSelect.val();
        // check which sources where choosen
        var constraints = {
            audio: {
                optional: [{sourceId: choosenVideo}]
            },
            video: {
                optional: [{sourceId: choosenVideo}]
            }
        };
    }

    if (navigator.getUserMedia) {
        navigator.getUserMedia(constraints, getUserMediaSuccess, getUserMediaError);
    } else {
        alert('Your browser does not support getUserMedia API');
    }
}


function connectVideo() {
    var passwd = prompt('Please provide password');
    videoConnection = new HydnaChannel(HYDNA_DOMAIN + '/view?' + passwd, 'rw'); 
    videoConnection.onopen = function(event) {
        var data = JSON.parse(event.data);
        if (data.users_on_channel.length === 0) {
            $('.status').html('Waiting for other party');
        } else if(data.users_on_channel.length === 1){
            $('.status').html('Trying to connect...');
        } else {
            alert('2 people are already connected');
            $('.status').html('The room is full');
        }
    }

    videoConnection.onclose = function(event) {
        if (event.wasDenied) {
            alert('You are not allowed to enter');
        } else {
            // something went wrong, we were disconnected
            $('.status').html('Error connecting, please refresh this page');
        }
    }
    
    videoConnection.onsignal = function(event) {
        var payload = JSON.parse(event.data);
        // when someone disconnects
        if (payload.type === 'join') {
            // now we are 2 people, lets connect the streams
            start(true);
        } else if (payload.type === 'left'){
            stop();
            // reset app, we are now in waiting mode again
        }
    }

    videoConnection.onmessage = gotMessageFromServer;
}

function getUserMediaSuccess(stream) {
    localStream = stream;
    localVideo.src = window.URL.createObjectURL(stream);

    connectVideo();

    waitUntilLocalStreamStartsFlowing();
}

function stop() {
    $('.status').html('Other party disconnected');

    disableControl();

    if (controlConnection) {
        controlConnection.close();
    }
}

function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.onaddstream = gotRemoteStream;
    peerConnection.addStream(localStream);

    if (isCaller) {
        peerConnection.createOffer(gotDescription, createOfferError);
    }
}

function waitUntilLocalStreamStartsFlowing() {
    if (!(localVideo.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA || localVideo.paused || localVideo.currentTime <= 0)) {
        // local stream started flowing!
        $('#localVideo').addClass('ready');
    } else { 
        setTimeout(waitUntilLocalStreamStartsFlowing, 50);
    }
}

function waitUntilRemoteStreamStartsFlowing() {
    if (!(remoteVideo.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA || remoteVideo.paused || remoteVideo.currentTime <= 0)) {
        // remote stream started flowing!
        $(".status").html('');
        $('#remoteVideo').addClass('ready');
    } else { 
        setTimeout(waitUntilRemoteStreamStartsFlowing, 50);
    }
}

function gotMessageFromServer(event) {
    if (!peerConnection) { // if not caller (the person who started) 
        start(false);
    }

    var message = event.data;

    var signal = JSON.parse(message);
    if(signal.sdp) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp), function() {
            peerConnection.createAnswer(gotDescription, createAnswerError);
        }, function(){}, function(){});
    } else if(signal.ice) {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
    }
}

function gotIceCandidate(event) {
    if(event.candidate != null) {
        videoConnection.send(JSON.stringify({'ice': event.candidate}));
    }
}

function gotDescription(description) {
    peerConnection.setLocalDescription(description, function () {
        videoConnection.send(JSON.stringify({'sdp': description}));
    }, function() {
        $('.status').html('Set description failed, please refresh this page');
    });
}

function gotRemoteStream(event) {
    if (!event) { 
        return; 
    }

    remoteVideo.src = window.URL.createObjectURL(event.stream);

    $(".status").html('Waiting for remote stream...');

    enableControl();

    waitUntilRemoteStreamStartsFlowing();
}

// Error functions....
function getUserMediaError(error) {
    alert('Could not select video');
}

function createOfferError(error) {
    console.log(error);
}

function createAnswerError(error) {
    console.log(error);
}

function init() {

    if (HYDNA_DOMAIN.length == 0) {
        alert('Please enter your hydna domain in HYDNA_DOMAIN');
        return;
    }

    disable();

    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    
    if (typeof MediaStreamTrack.getSources === 'undefined'){
        supportsMediaTrack = false;
        audioSelect.hide();
        videoSelect.hide();
        startBtn.hide();

        getLocalMedia();
        
    } else {
        MediaStreamTrack.getSources(gotSources);
        supportsMediaTrack = true;

        startBtn.on('click', function(e) {
            e.preventDefault();           

            audioSelect.hide();
            videoSelect.hide();
            startBtn.hide();

            getLocalMedia();
            
        });
    }
}


// init controls

$('#control-btn').on('click', function(e) {
    e.preventDefault();
    var passwd = prompt('Enter control password');
    if (passwd) {
        connectArm(passwd);
        $('#control-btn').attr('disabled', 'disabled');
    }
});

$('#reset-btn').on('click', function(e) {
    e.preventDefault();
    controlConnection.send('reset');
});

$('#rest-btn').on('click', function(e) {
    e.preventDefault();
    controlConnection.send('rest');
});

$('#query-btn').on('click', function(e) {
    e.preventDefault();
    controlConnection.send('query');
});

$('#move-btn').on('click', function(e) {
    e.preventDefault();
    controlConnection.send('move');
});

$('#connect-btn').on('click', function(e){
    e.preventDefault();
    start(true);
});

$('#fullscreen-btn').on('click', function(e){
    screenfull.toggle();
});

$('#speed').on('change', function(e) {
    updateSpeed();
});


center = $('.mouse-controller .center');
mousecontroller = $('.mouse-controller'); 

center.on('mousedown', function() {
    if(!controlConnection) {
        return alert('Connect first!');
    }

    if(!enabled) {
        return alert('waiting for reset');
    }

    dragging = true;
});

$(document).on('mouseup', function(event) {
    if (dragging) {

        dragging = false;

        xdiff = 0;
        ydiff = 0;
        
        var offset = mousecontroller.offset();

        center.css('left', 125);
        center.css('top', 125);

        mouse.up = 0;
        mouse.down = 0;
        mouse.left = 0;
        mouse.right = 0;

        sendCommand();
    }
});

$(document).on('mousemove', function(event) {
    if (dragging) {
        var offset = mousecontroller.offset();
        var pos = {x:event.pageX - offset.left, y:event.pageY - offset.top};
        center.css('left', pos.x - 25);
        center.css('top', pos.y - 25);

        xdiff = ($(window).width() * .5) - event.pageX;
        ydiff = ($(window).height() * .5) - event.pageY;

        checkMousePosition();
    }
});

$(document).on('keyup', function(e) {
    var someUp = false;
    for (var i = 0; i < keys.length; i++) {
        if (e.keyCode === keys[i].code) {
            keys[i].down = false;
            someUp = true;
        }
    }
    if(controlConnection && enabled) {
        if (someUp && controlConnection.readyState === HydnaChannel.OPEN) {
            sendCommand();
        }
    }
});

$(document).on('keydown', function(e) {
    var someDown = false;
    for (var i = 0; i < keys.length; i++) {
        if (e.keyCode === keys[i].code) {
            keys[i].down = true;
            someDown = true;
        }
    }

    if(controlConnection && enabled) {
        if (someDown && controlConnection.readyState === HydnaChannel.OPEN) {
            sendCommand();
        }
    }
});


init();

});
