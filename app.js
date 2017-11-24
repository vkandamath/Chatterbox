// Server side script
var express = require('express')
var app = require('express')()
var server = require('http').Server(app)
var io = require('socket.io')(server)
var mongoose = require ("mongoose")
var bodyParser = require('body-parser')
var multer = require('multer') // v1.0.5
var upload = multer() // for parsing multipart/form-data
var cookieParser = require('cookie-parser')
var fs = require('fs');

var mongoUri = process.env.MONGOLAB_URI

app.set('view engine', 'ejs')
app.use(express.static('public'))

console.log(process.env)

var session = require("express-session")({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
})
var sharedsession = require("express-socket.io-session")

// Use express-session middleware for express
app.use(session)

// Use shared session middleware for socket.io
// setting autoSave:true
io.use(sharedsession(session, {
    autoSave:true
})) 


app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// Set up server port
server.listen(process.env.PORT, function(){
  console.log('listening on *:' + process.env.PORT)
})


/* Connect to MongoDb */
mongoose.connect(mongoUri, {useMongoClient: true}, function (err, res) {
	if (err) {
		console.log ('ERROR connecting to: ' + mongoUri + '. ' + err)
	} 
	else {
		// Drop the current database
		mongoose.connection.db.dropDatabase()
	}
})

/* Storing language codes */

/* Defining schemes */

var Schema = mongoose.Schema

var userShema = Schema({
	// Assume socket_id is not unique since same socket id can be regenerated 
	// between previouslydisconnected user and newly connected user
	socket_id: String, 
	username: String,
	language: String,
	color_code: String,
	messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
	chatroom: {type: Schema.Types.ObjectId, ref: 'Chatroom'}
})

var chatroomSchema = Schema({
	members: [{ type: Schema.Types.ObjectId, ref: 'User' }]
	// may need to add messages reference here when retrieving message history
})

var messageSchema = Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User' },
	time_stamp: { type: Date, default: Date.now }
})

/* Creating data models here */

var User = mongoose.model('User', userShema)
var Chatroom = mongoose.model('Chatroom', chatroomSchema)
var Message = mongoose.model('Messsage', messageSchema) 

app.get("*", function (req, res, next) {
	if(req.headers['x-forwarded-proto'] != 'https' && process.env.NODE_ENV == "production")
    	res.redirect('https://' + process.env.HOSTNAME + req.url)
    else
    	next()

})

// Presents user with homepage
app.get('/', function (req, res) {
	res.render('welcome')
})

// Create new chatroom and redirects user
app.get('/chatroom', function (req, res, next) {

	console.log("here: " + req.header('Referer'))
	console.log((process.env.HOSTNAME + "/"))

	// To prevent direct url access 
	//if (req.header('Referer') != (process.env.HOSTNAME + "/")) {
		//console.log("SD")
		//res.redirect('/')
	//} 
	//else {
		//TODO: use this later
		req.session.my_nickname = req.param('nickname')
		req.session.my_language = req.param('language')

		var newChatroom = Chatroom()
		newChatroom.save(function (err) {
			if (err) {
				console.log(err)
				res.send("Error creating chatroom!")
			}
			else {
				res.redirect("/chatroom/" + newChatroom._id)
			}
		})
	//}
})

// Renders chatroom with room_id to user
app.get('/chatroom/:room_id', function (req, res) {

	console.log("hello world")

	var room_id = req.params.room_id
	var my_nickname = req.session.my_nickname
	var my_language = req.session.my_language

	Chatroom
		.findById(room_id)
		.populate('members')
		.exec(function (err, chatroom) {
			if (err) {
				console.log(err)
					res.redirect('/')
			}
			else {
				if (chatroom == null) //chatroom doesn't exist
					res.redirect('/')
				else {

					if (chatroom.members.length == 0) //first user
						res.render('chatroom', {room_id: room_id, my_nickname: my_nickname, my_language: my_language, is_first_user: true})
					else // users who join
						res.render('chatroom', {room_id: room_id, my_nickname: my_nickname, my_language: my_language, is_first_user: false})
				}
			}
		})


})

// Redirects user to homepage if they try to access something else
app.get('/*', function (req, res) {
	res.redirect('/')
})

io.on('connection', function(socket) { 

	var room_id

	socket.on('joined room', function(msg) {

		var user_selected_username = true;
		
		room_id = msg.room_id

		// Default values
		if (msg.username == "") {
			msg.username = "Anonymous User"
			msg.my_language = "English"
		}
		
		var new_user = new User({ socket_id: socket.id, username: msg.username, language: msg.my_language, color_code: "#000000", chatroom: room_id})
		new_user.save(function (err) {
			if (err) {
				console.log(err)
			} 
			else {
				console.log("New user with socketid/username: " + socket.id + " created")

				Chatroom.findById(room_id).
				populate('members').
				exec(function (err, chatroom) {
					if (err) {
						console.log(err)
					}
					else {
						
						if (chatroom != null) {

							chatroom.members.push(new_user)
							chatroom.save(function (err) {
								if (err) {
									console.log(err)
								}
								else {
									socket.join(room_id)

									// Sending to everyone including sender
									io.in(room_id).emit("user joined room", {socket_id: socket.id, username: new_user.username, room_id: room_id, room_members: chatroom.members})
								}
							}) 
						}
					}
				})
			}
		})
	})

	socket.on('outgoing message', function(msg) {
		console.log("received: " + JSON.stringify(msg))
		console.log(msg.socket_id)
		console.log(socket.id)
		User.findOne({'socket_id': socket.id}, function (err, user) {
			if (err) {
				console.log(err)
			}
			else {
				msg.language = user.language
				socket.broadcast.to(msg.room_id).emit('incoming message', msg)
			}
		});
	})

	socket.on('set user properties', function(msg) {
		console.log("setting user properties: " + msg.nickname)

		User.findOne({'socket_id': socket.id}, function (err, user) {
			if (err) {
				console.log(err)
			}
			else {
				var old_username = user.username
				console.log("OLD: " + old_username)
				user.username = msg.nickname
				user.language = msg.language
				user.save(function(err) {
					if (err) {
						console.log(err);
					}

					Chatroom.findById(room_id)
					.populate('members')
					.exec(function (err, chatroom) {
						if (err) {
							console.log(err)
						}
						else {
							io.in(room_id).emit("changed user properties", {old_username: old_username, new_username: user.username, room_members: chatroom.members})
						}
					})
				})
			}
		});


		//User.update({ 'socket_id': socket.id}, {username: msg.nickname, language: msg.language})
	})

	socket.on('disconnect', function() {
		console.log(room_id)
		User.findOne({ 'socket_id': socket.id }, function (err, user) {
			if (err) {
				console.log(err)
			}
			else {
				Chatroom.findById(room_id).
				populate('members').
				exec(function (err, chatroom) {
					if (err) {
						console.log(err)
					}
					else {
						User.findOne({ 'socket_id' : socket.id }, function (err, user) {
							if (err) {
								console.log(err)
							}
							else {
								// if last member leaves, delete chatroom						
								if (chatroom.members.length == 1) {
									// TODO: remove any references to chatroom (users, msgs..)
									chatroom.remove()
								}	
								else {

									// TODO: set User.chatroom field to null if necessary later
									// removes user from chatroom list of members when they leave room
									// still maintains user object and messages corresponding to user 
									// in case its still needed for maintaining chat history later
									chatroom.members.pull(user)
									chatroom.save(function (err) {
										if (err) {
											console.log(err)
										}
										else {
											io.in(room_id).emit('user left room', {socket_id: socket.id, username: user.username, room_id: room_id, room_members: chatroom.members})
										}
									})

								}
								

							}
						})

					}
				})

			

				//hatroom.update({_id: chatroom})
/*
				console.log('User ' + usersOnline[socket.id].username + ' disconnected!')
				var username = usersOnline[socket.id].username
				if (username == "") {
					username = socket.id
				}
				delete usersOnline[socket.id]
				io.emit('disconnected', {userid: username, usersOnline: usersOnline})*/
			}
		})
	})

	//var colorCode = generateColorCode()

	//io.emit('connected', {userid: socket.id, usersOnline: usersOnline})

	/*

	socket.emit('myUserId', {userId: socket.id, colorCode: colorCode})





	socket.on('user is typing', function(msg) {
		console.log('user is typing')

		//sends to everyone except the user who is typing
		socket.broadcast.emit('user is typing', msg)
	})

	socket.on('user is not typing', function(msg) {
		console.log('user is not typing')
		socket.broadcast.emit('user is not typing', msg)
	})

	socket.on('username change', function(msg) {
		if (usersOnline[msg.socketId].username != msg.newUsername) {
			usersOnline[msg.socketId].username = msg.newUsername
			msg['usersOnline'] = usersOnline
			io.emit('username change', msg)
		}
	})

	socket.on('change color', function(msg) {
		console.log("Changing color to: " + msg.colorHex)
		usersOnline[msg.socketid].colorCode = "#" + msg.colorHex
		msg['usersOnline'] = usersOnline
		io.emit('change color', msg)
	})

	socket.on('outgoing image', function(msg) {
		console.log('sending out image: ' + msg.imageData)
		socket.broadcast.emit('incoming image', msg)
	}) */
})

// Helper function to retrieve random color code
function generateColorCode() {
	var allValues = "ABCDEF1234567890"
	var colorCode = "#"
	for (var i = 0; i < 6; i++) {
		var index = Math.floor(Math.random()*allValues.length)
    	colorCode += allValues[index]
	}
  return colorCode
}



