// Server side script
var express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', function (req, res) {

	res.render('index');

});

io.on('connection', function(socket) {
	console.log('User ' + socket.id + ' connected!');
	io.emit('connected', {userid: socket.id});

	socket.emit('myUserId', {userId: socket.id});

	socket.on('disconnect', function() {
		console.log('User ' + socket.id + ' disconnected!');
		io.emit('disconnected', {userid: socket.id});
	});

	socket.on('outgoing message', function(msg) {
		console.log("received: " + msg);
		io.emit('incoming message', msg);
	});
});


http.listen(3000, function(){
  console.log('listening on *:3000');
});