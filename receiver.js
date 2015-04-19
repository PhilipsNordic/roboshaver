var SerialPort = require('serialport').SerialPort;
var serialport = require('serialport');
var hydna = require('hydna');

var BAUDRATE = 9600;
var DEVICE_FILE = '/dev/cu.usbserial-AI028AKN';

// enter your hydna domain below and control channel, like: yourhydnadomain.hydna.net/control
var CONTROL_CHANNEL = '';

var SPEED = 200;

var ssc32u = new SerialPort(DEVICE_FILE, {
    baudrate: BAUDRATE,
    parser: serialport.parsers.readline('\r')
}, false);

var opened = false;
var commandTimeout;
var resetTimeout;
var lastCommandReceived;
var commandsCompleted = true;
var reseting = false;
var listenChannel;

var robot = {
    joints: [
        {id: 'base', action: 1500, reset: 1500, rest: 1500, max: 2000, min: 1000, position: 1500, target: 1500, state: 0},
        {id: 'shoulder', action: 1500, reset: 2000, rest: 1660, max: 2000, min: 1100, position: 1260, target: 1500, state: 0},
        {id: 'elbow', action: 1550, reset: 1980, rest: 1850, max: 2000, min: 1000, position: 1500, target: 1500, state: 0},
        {id: 'wrist', action: 1500, reset: 1050, rest: 1500, max: 2000, min: 1000, position: 1500, target: 1500, state: 0},
        {id: 'hand', action: 1500, reset: 1500, rest: 1500, max: 2000, min: 1000, position: 1500, target: 1500, state: 0}
    ]
}

function applyPosition(joints, time, callback) {
    if (joints.length != robot.joints.length) {
        console.log('Invalid command');    
    } else {
        var command = '';
        for (var i = 0; i < joints.length; i++) {
            command = command + '#' + i + 'P' + joints[i];
            robot.joints[i].position = joints[i];
            robot.joints[i].target = joints[i];
            robot.joints[i].state = 0;
        }
        command = command + 'T' + time + '\r';
        ssc32u.write(command);
        commandsCompleted = false;
        timeoutComplete(time, callback);
    }
}

function timeoutComplete(timeout, callback) {
    clearTimeout(commandTimeout);
    commandTimeout = setTimeout(function() {
        commandsCompleted = true;
        if (callback) {
            callback();
        }
    }, timeout);
}

function reset() {
    reseting = true;

    applyPosition([
        robot.joints[0].reset,
        robot.joints[1].reset,
        robot.joints[2].reset,
        robot.joints[3].reset,
        robot.joints[4].reset
    ], 2000, function() {
        reseting = false;
    });
}

function rest() {
    applyPosition([
        robot.joints[0].rest,
        robot.joints[1].rest,
        robot.joints[2].rest,
        robot.joints[3].rest,
        robot.joints[4].rest
    ], 2000);
}

function action() {
    applyPosition([
        robot.joints[0].action,
        robot.joints[1].action,
        robot.joints[2].action,
        robot.joints[3].action,
        robot.joints[4].action
    ], 2000);
}

// interuption test
function move() {
    ssc32u.write('#4P1800 T3000\r');
    setTimeout(function() {
        ssc32u.write('STOP 4\r');
    }, 1000);
}

function connectArm(callback) {
    ssc32u.open(function (error) {
        if (error) {
            console.log(error);
            console.log('trying again in 5 secs');
            setTimeout(connectArm, 5000);
        } else {
            console.log('ssc-32u open');

            opened = true;

            ssc32u.on('data', function(data) {
                console.log('data received from robot: ' + data);
            });

            ssc32u.on('error', function(data) {
                console.log('error: ' + data);
            });

            ssc32u.on('close', function(error) {
                console.log('close:' + error);
            });

            ssc32u.write('ver\r', function(err, results) {
                if (err) {
                    console.log('err ' + err);
                    console.log('trying again in 5 secs');
                    setTimeout(connectArm, 5000);
                } else {
                    console.log('version: ' + results);
                    reset();
                    connectController();
                }
            });
        }
    });
}

function updateJoint(index) {
    var joint = robot.joints[index];
    ssc32u.write('#' + index + 'P' + joint.target + 'S' + joint.speed + '\r');
}

function stopJoint(index) {
    ssc32u.write('STOP ' + index + '\r');
}

function updateState(states) {
    for (var i = 0; i < states.length; i++) {
        update(states[i].index, states[i].state, states[i].speed);
    }
}

function update(index, state, speed) {

    var joint = robot.joints[index];
    if (joint.state === state) {
        return;
    }
    var now = new Date().getTime();
    var traveled = now - joint.start;
    var distance = Math.abs(joint.target - joint.position);
    
    var shouldtravel = (distance / joint.speed) * 1000; // milliseconds
    
    if (traveled >= shouldtravel) {
        joint.position = joint.target; // we have arrived
    } else {
        joint.position = Math.round(joint.min + ((traveled / shouldtravel) * distance));
    }

    joint.start = now;
    joint.speed = speed;
    joint.state = state;

    if (state == 0) {
        // tell motor to go to position as fast as possible
        joint.target = joint.position;
        stopJoint(index); // stop command to motor

    } else if (state == 1) {
        // tell motor to go to max position at given speed
        joint.target = joint.max;
        updateJoint(index);
        
    } else if (state == -1) {
        // tell motor to go to min position at given speed
        joint.target = joint.min;
        updateJoint(index);
    }
}

function parseStateCommand(command) {

    var commands = [];
    if (command.indexOf('P') === -1) {
        return commands;
    }
    var states = command.split('|');
    for (var i = 0; i < states.length; i++) {
        var str = states[i].toUpperCase();
        var index = parseInt(str.substr(0,1));
        var speedIndex = str.indexOf('S');
        var speed = SPEED;
        var state = 0;
        if (speedIndex != -1) {
            state = parseInt(str.substring(2, speedIndex));
            speed = parseInt(str.substr(speedIndex + 1));
        } else {
            state = parseInt(str.substr(2));
        }
        
        commands.push({index: index, state: state, speed: speed});
    }
    
    return commands;
}

function processData(data) {
    if (data.substr(0, 1) === '#') {
        writeCommands(data);
    } else {
        switch(data){
            case 'reset':
                reset();
            break;
            case 'rest':
                rest();
            break;
            case 'action':
                action();
            break;
            case 'move':
                move();
            break;
            default:
                
            if (commandsCompleted) {
                try {
                    console.log(data);
                    var states = parseStateCommand(data);
                    updateState(states);
                } catch(e) {
                    console.log(e);
                }
            }
        }
    }
}

function connectController() {
    if (CONTROL_CHANNEL.length === 0) {
        console.log('please provide a valid CONTROL_CHANNEL');
        return;
    }

    listenChannel = hydna.createChannel(CONTROL_CHANNEL, 'r');
    listenChannel.on('connect', function() {
        console.log('control channel open');
    });

    listenChannel.on('error', function(error) {
        // an error occured when connecting
        console.log(error);
        console.log('trying to connect to: '+ CONTROL_CHANNEL + ' again in 5 secs...');
        setTimeout(connectController, 5000);
    });

    listenChannel.on('data', function(data) {
        console.log('data received over hydna:' + data);
        if (opened) {
            processData(data);
        }
    });
}

connectArm();
