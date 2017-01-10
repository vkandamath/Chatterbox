// Server side script
var express = require('express');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.set('view engine', 'ejs');
app.use(express.static('public'));

server.listen(process.env.PORT || 3000, function(){
  console.log('listening on *:3000');
});

app.get('/', function (req, res) {
	res.render('index');
});

app.get('/*', function(req, res) {
	res.redirect('/');
})

// Note: users should be stored in database if you want to scale
// For simplicity, defining model here for now
class User {
	constructor(socketid, username, colorCode) {
		this.socketid = socketid;
		this.username = username;
		this.colorCode = colorCode;
	}
}

var usersOnline = {}; // stores user objects


io.on('connection', function(socket) {
	console.log('User ' + socket.id + ' connected!');

	var colorCode = generateColorCode();
	var newUser = new User(socket.id, '', colorCode);
	usersOnline[socket.id] = newUser;

	//usersOnline[socket.id] = '';
	//userColors[socket.id] = generateColorCode();

	//console.log(Object.keys(io.sockets.sockets));
	io.emit('connected', {userid: socket.id, usersOnline: usersOnline});

	socket.emit('myUserId', {userId: socket.id, colorCode: colorCode});

	socket.on('disconnect', function() {
		console.log('User ' + socket.id + ' disconnected!');
		delete usersOnline[socket.id];
		io.emit('disconnected', {userid: socket.id, usersOnline: usersOnline});
	});

	socket.on('outgoing message', function(msg) {
		console.log("received: " + msg);
		socket.broadcast.emit('incoming message', msg);
	});

	socket.on('user is typing', function(msg) {
		console.log('user is typing');
		//sends to everyone except the user who is typing
		socket.broadcast.emit('user is typing', msg);
	});

	socket.on('user is not typing', function(msg) {
		console.log('user is not typing');
		socket.broadcast.emit('user is not typing', msg);
	});

	socket.on('username change', function(msg) {
		usersOnline[msg.socketId].username = msg.newUsername;
		msg['usersOnline'] = usersOnline;
		io.emit('username change', msg);
	});

	socket.on('change color', function(msg) {
		console.log("Changing color to: " + msg.colorHex);
		usersOnline[msg.socketid].colorCode = "#" + msg.colorHex;
		msg['usersOnline'] = usersOnline;
		io.emit('change color', msg);
	});
});

function generateColorCode() {
	var allValues = "ABCDEF1234567890";
	var colorCode = "#";
	for (var i = 0; i < 6; i++) {
		var index = Math.floor(Math.random()*allValues.length);
    	colorCode += allValues[index];
	}
  return colorCode;
}



