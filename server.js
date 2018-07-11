var express = require("express");

var app = express();
var server = require("http").Server(app);
var path = require("path");
var THREE = require("three");

app.get("/", function (req, res) { 
    res.sendFile(__dirname + "/public/index.html");
});

app.use(express.static(path.join(__dirname, "public")));

server.listen(3000);
console.log("Server initialized!");

var cube = new THREE.Quaternion(0.0, 0.0, 0.0, 1.0);
var previous_cube = cube;
var left = new THREE.Vector3(0,-1,0).normalize();
var right = new THREE.Vector3(0,1,0).normalize();
var rotate_left = false;
var rotate_right = false;

var socket_list = {};

//server-side rotation confirmation
var degreesPerSecond = 90;
var radiansPerSecond = degreesPerSecond*Math.PI*2/360;
var RADIANS_MS = radiansPerSecond / 1000;
function rotate_cube(rotate, skip_ticks){
    previous_cube.copy(cube);
    cube.setFromAxisAngle(rotate, RADIANS_MS * skip_ticks);
    cube.multiplyQuaternions(previous_cube, cube);
}

var skip_ticks = 0;
var io = require("socket.io")(server, {});
io.sockets.on("connection", function(socket){
	console.log("Socket ID: " + socket.id);

	socket_list[socket.id] = socket;
	socket.on('disconnect', function(){
		delete socket_list[socket.id];
	});
	
	socket.on('keyPress', function(data){
		if (data.key_id === "A")
			rotate_left = data.state;
		else if (data.key_id === "D")
			rotate_right = data.state;

		skip_ticks = data.skip_ticks;
	});
	
});

setInterval(function(){
    //previous_cube.copy(cube);
	if (rotate_left)
		rotate_cube(left, skip_ticks);
	else if (rotate_right)
		rotate_cube(right, skip_ticks);

	var pack = {quaternion: cube};

	for (var i in socket_list){
		var socket = socket_list[i];
		socket.emit("updateQuat", pack);
	}

}, 1000/64);