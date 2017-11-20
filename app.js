// Server side script
var express = require('express');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var mongoose = require ("mongoose");
var bodyParser = require('body-parser');
var multer = require('multer'); // v1.0.5
var upload = multer(); // for parsing multipart/form-data
var cookieParser = require('cookie-parser')
var session = require('express-session')
var enforce = require('express-sslify');


var mongoUri = process.env.MONGOLAB_URI;

app.set('view engine', 'ejs');
app.use(express.static('public'));

console.log(process.env);

if (process.env.NODE_ENV == 'production') {
	console.log("FORCEING SSL");
	//app.use(enforce.HTTPS());
}

app.use(cookieParser());
app.use(session({ 
	resave: false,
    saveUninitialized: true,
    secret: 'sdlfjljrowuroweu',
    cookie: { secure: true }
}));

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Set up server port
server.listen(process.env.PORT, function(){
  console.log('listening on *:' + process.env.PORT);
});


/* Connect to MongoDb */
mongoose.connect(mongoUri, {useMongoClient: true}, function (err, res) {
	if (err) {
		console.log ('ERROR connecting to: ' + mongoUri + '. ' + err);
	} 
	else {
		console.log ('Succeeded connected to: ' + mongoUri);
	}
});

/* Defining schemes */

var Schema = mongoose.Schema;

var userShema = Schema({
	// Assume socket_id is not unique since same socket id can be regenerated 
	// between previouslydisconnected user and newly connected user
	socket_id: String, 
	username: String,
	language: String,
	color_code: String,
	messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
	chatroom: {type: Schema.Types.ObjectId, ref: 'Chatroom'}
});

var chatroomSchema = Schema({
	members: [{ type: Schema.Types.ObjectId, ref: 'User' }]
});

var messageSchema = Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User' },
	time_stamp: { type: Date, default: Date.now }
});

/* Creating data models here */

var User = mongoose.model('User', userShema);
var Chatroom = mongoose.model('Chatroom', chatroomSchema);
var Message = mongoose.model('Messsage', messageSchema); 

// Presents user with homepage
app.get('/', function (req, res) {
	res.render('welcome');
});

// Create new chatroom and redirects user
app.post('/chatroom', function (req, res) {

	req.session.my_nickname = req.params.nickname;
	req.session.my_language = req.params.language;


	var newChatroom = Chatroom()
	newChatroom.save(function (err) {
		if (err) {
			console.log(err);
			res.send("Error creating chatroom!");
		}
		else {
			res.redirect("/chatroom/" + newChatroom._id);
		}
	});
	
});

// Renders chatroom with room_id to user
app.get('/chatroom/:room_id', function (req, res) {
	var room_id = req.params.room_id;

	console.log("Session user: " + JSON.stringify(req.session));

	// Check if chatroom exists, otherwise present user with chatroom does not exist message
	Chatroom.findById(room_id, function (err, chatroom) {
		if (err) {
			console.log("Error: chatroom doesn't exist!")
			res.redirect('/')
		}
		else {
			res.render('chatroom', {room_id: req.params.room_id});
		}
	});
});

// Redirects user to homepage if they try to access something else
app.get('/*', function (req, res) {
	res.redirect('/');
});

// stores user objects
var usersOnline = {}; 

io.on('connection', function(socket) { 

	var room_id;

	socket.on('joined room', function(msg) {
		console.log("user " + socket.id + " joined room " + msg.room_id)
		room_id = msg.room_id
		
		var new_user = new User({ socket_id: socket.id, username: socket.id, language: "English", color_code: "#000000", chatroom: room_id});
		new_user.save(function (err) {
			if (err) {
				console.log(err);
			} 
			else {
				console.log("New user with socketid/username: " + socket.id + " created");

				Chatroom.findById(room_id).
				populate('members').
				exec(function (err, chatroom) {
					if (err) {
						console.log(err);
					}
					else {
						chatroom.members.push(new_user);
						chatroom.save(function (err) {
							if (err) {
								console.log(err);
							}
							else {
								socket.join(room_id);

								// Sending to everyone including sender
								io.in(room_id).emit("user joined room", {socket_id: socket.id, username: new_user.username, room_id: room_id, room_members: chatroom.members});
							}
						}) 
					}
				});
			}
		});
	});

	socket.on('outgoing message', function(msg) {
		console.log("received: " + msg);
		socket.broadcast.to(msg.room_id).emit('incoming message', msg);
	});

	socket.on('disconnect', function() {
		console.log(room_id);
		var disconnecting_user = User.findOne({ 'socket_id': socket.id }, function (err, user) {
			if (err) {
				console.log(err);
			}
			else {
				console.log(1);
				Chatroom.findById(room_id).
				populate('members').
				exec(function (err, chatroom) {
					if (err) {
						console.log(err);
					}
					else {
						console.log(3);
						User.findOne({ 'socket_id' : socket.id }, function (err, user) {
							if (err) {
								console.log(err);
							}
							else {
								console.log(chatroom);
								io.in(room_id).emit('user left room', {socket_id: socket.id, username: user.username, room_id: room_id, room_members: chatroom.members})
							}
						});

					}
				});

			

				//hatroom.update({_id: chatroom})
/*
				console.log('User ' + usersOnline[socket.id].username + ' disconnected!');
				var username = usersOnline[socket.id].username;
				if (username == "") {
					username = socket.id;
				}
				delete usersOnline[socket.id];
				io.emit('disconnected', {userid: username, usersOnline: usersOnline});*/
			}
		});
	});

	//var colorCode = generateColorCode();

	//io.emit('connected', {userid: socket.id, usersOnline: usersOnline});

	/*

	socket.emit('myUserId', {userId: socket.id, colorCode: colorCode});





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
	}); */
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



