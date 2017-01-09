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

// Note: users should be stored in database if you want to scale
var usersOnline = new Set();

io.on('connection', function(socket) {
	console.log('User ' + socket.id + ' connected!');
	
	usersOnline.add(socket.id);
	//console.log("num users: " + JSON.stringify(Array.from(usersOnline)));
	io.emit('connected', {userid: socket.id, usersOnline: Array.from(usersOnline)});

	socket.emit('myUserId', {userId: socket.id});

	socket.on('disconnect', function() {
		console.log('User ' + socket.id + ' disconnected!');
		usersOnline.delete(socket.id);
		io.emit('disconnected', {userid: socket.id, usersOnline: Array.from(usersOnline)});
	});

	socket.on('outgoing message', function(msg) {
		console.log("received: " + msg);
		io.emit('incoming message', msg);
	});
});
