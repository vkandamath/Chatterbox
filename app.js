// Server side script
var express = require('express');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var mongoose = require ("mongoose");

// Set up database
var mongoUri = process.env.MONGOLAB_URI;

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Set up server port
server.listen(process.env.PORT, function(){
  console.log('listening on *:' + process.env.PORT);
});

// Makes connection asynchronously.  Mongoose will queue up database
// operations and release them when the connection is complete.
mongoose.connect(mongoUri, function (err, res) {
	if (err) {
		console.log ('ERROR connecting to: ' + mongoUri + '. ' + err);
	} 
	else {
		console.log ('Succeeded connected to: ' + mongoUri);
	}
});

var userShema = new mongoose.Schema({
	socket_id: String,
	username: String,
	language: String,
	color: String,
	is_online: Boolean
	messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }]
});

var messageSchema = new mongoose.Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User' }
	time_stamp: { type: Date, default: Date.now }
});

// Presents user with homepage
app.get('/', function (req, res) {
	res.render('index');
});

// Redirects user to homepage if they try to access something else
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

// stores user objects
var usersOnline = {}; 

io.on('connection', function(socket) {
	console.log('User ' + socket.id + ' connected!');

	var colorCode = generateColorCode();
	var newUser = new User(socket.id, '', colorCode);
	usersOnline[socket.id] = newUser;

	io.emit('connected', {userid: socket.id, usersOnline: usersOnline});

	socket.emit('myUserId', {userId: socket.id, colorCode: colorCode});

	socket.on('disconnect', function() {
		console.log('User ' + usersOnline[socket.id].username + ' disconnected!');
		var username = usersOnline[socket.id].username;
		if (username == "") {
			username = socket.id;
		}
		delete usersOnline[socket.id];
		io.emit('disconnected', {userid: username, usersOnline: usersOnline});
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
		if (usersOnline[msg.socketId].username != msg.newUsername) {
			usersOnline[msg.socketId].username = msg.newUsername;
			msg['usersOnline'] = usersOnline;
			io.emit('username change', msg);
		}
	});

	socket.on('change color', function(msg) {
		console.log("Changing color to: " + msg.colorHex);
		usersOnline[msg.socketid].colorCode = "#" + msg.colorHex;
		msg['usersOnline'] = usersOnline;
		io.emit('change color', msg);
	});

	socket.on('outgoing image', function(msg) {
		console.log('sending out image: ' + msg.imageData);
		socket.broadcast.emit('incoming image', msg);
	});
});

// Helper function to retrieve random color code
function generateColorCode() {
	var allValues = "ABCDEF1234567890";
	var colorCode = "#";
	for (var i = 0; i < 6; i++) {
		var index = Math.floor(Math.random()*allValues.length);
    	colorCode += allValues[index];
	}
  return colorCode;
}



