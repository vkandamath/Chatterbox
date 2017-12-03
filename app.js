// Importing packages
var express = require('express'),
	app = require('express')(),
	server = require('http').Server(app),
	io = require('socket.io')(server),
	mongoose = require ("mongoose"),
	bodyParser = require('body-parser'),
	multer = require('multer'),
	upload = multer()
	fs = require('fs'),
	request = require('request')

	var shortid = require('shortid');

var ios = require('socket.io-express-session');



// Mongodb setup
var mongoUri = process.env.MONGOLAB_URI
mongoose.connect(mongoUri, {useMongoClient: true}, function (err, res) {
	if (err) {
		console.log ('ERROR connecting to: ' + mongoUri + '. ' + err)
	} 
	else {
		// Drop the current database
		mongoose.connection.db.dropDatabase()
	}
})

// Defining schemas
var Schema = mongoose.Schema

var userShema = Schema({
	// Assume socket_id is not unique since same socket id can be regenerated 
	// between previouslydisconnected user and newly connected user
	socket_id: String, 
	username: String,
	language: String,
	color_code: String,
	messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
	chatroom: {type: String, ref: 'Chatroom'}
})

var chatroomSchema = Schema({
	_id: {
	    type: String,
	    'default': shortid.generate
	},
	members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
	log_events: [{ type: Schema.Types.ObjectId, ref: 'Logevent' }]
})

var log_types = ["message", "action"]

var logeventSchema = Schema({
	_type: {type: String, enum: log_types}, //types: message, action
	user: { type: Schema.Types.ObjectId, ref: 'User' },
	time_stamp: { type: Date, default: Date.now },
	contents: String, // message or action,
	chatroom: {type: String, ref: 'Chatroom'}
})

// Defining data models
var User = mongoose.model('User', userShema)
var Chatroom = mongoose.model('Chatroom', chatroomSchema)
var Logevent = mongoose.model('Logevent', logeventSchema) 

// Language codes
var lang_codes = {
	English: "en",
	French: "fr",
	German: "de",
	Italian: "it",
	Spanish: "es",
}

var session = require("express-session")({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
})

io.use(ios(session));

// Server configuration
app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(session)
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// Set up server port
server.listen(process.env.PORT, function(){
  console.log('listening on *:' + process.env.PORT)
})

// Ensures that connection is https
app.get("*", function (req, res, next) {
	if(req.headers['x-forwarded-proto'] != 'https' && process.env.NODE_ENV == "production")
    	res.redirect('https://' + process.env.HOSTNAME + req.url)
    else
    	next()

})

// Presents user with homepage
app.get('/', function (req, res) {
	res.render('welcome', {error_msg: "", field: ""})
})

// Create new chatroom and redirects user
app.get('/room', function (req, res, next) {

	//console.log("here: " + req.header('Referer'))
	//console.log((process.env.HOSTNAME + "/"))

	// To prevent direct url access 
	//if (req.header('Referer') != (process.env.HOSTNAME + "/")) {
		//console.log("SD")
		//res.redirect('/')
	//} 
	//else {
		//TODO: use this later

		var languages = {"English": true, "Spanish": true, "French": true}
		// input validation
		if (!req.param('nickname')) {
			res.render('welcome', {error_msg: "Nickname is required!", field: "nickname-input"})
		}
		else if (!languages[req.param('language')]) {
			res.render('welcome', {error_msg: "Language is invalid!", field: "language-input"})
		}
		else {
			req.session.my_nickname = req.param('nickname')
			req.session.my_language = req.param('language')
			req.session.creating_room = true

			console.log("Dasd: " + req.param('nickname'))

			var newChatroom = Chatroom()
			newChatroom.save(function (err) {
				if (err) {
					console.log(err)
					res.send("Error creating chatroom!")
				}
				else {
					res.redirect("/room/" + newChatroom._id)
				}
			})
		}
	//}
})

// Renders chatroom with room_id to user
app.get('/room/:room_id', function (req, res) {


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

					if (my_nickname == null) // new joiner
						res.render('chatroom', {room_id: room_id, my_nickname: my_nickname, my_language: my_language, on_connect_context: "user joins room for first time"})
					else if (req.session.creating_room) // creating new room
						res.render('chatroom', {room_id: room_id, my_nickname: my_nickname, my_language: my_language, on_connect_context: "user creating new room"})
					else //existing users
						res.render('chatroom', {room_id: room_id, my_nickname: my_nickname, my_language: my_language, on_connect_context: "existing user opens new tab"})
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

	socket.emit("sessiondata", socket.handshake.session)

	socket.on('joined room', function(msg) {

		//socket.handshake.session.socket_id = socket.id;
        //socket.handshake.session.save();

        console.log(socket.id)
        console.log(socket.handshake.session);
        console.log("===========================")

		var user_selected_username = true;
		
		room_id = msg.room_id

		// Default values
		if (msg.username == "") {
			msg.username = "Anonymous User"
			msg.my_language = "English"

			socket.emit("set temp username", msg)
		}
		
		var new_user = new User({ socket_id: socket.id, username: msg.username, language: msg.my_language, color_code: msg.color_code, chatroom: room_id})
		new_user.save(function (err) {
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
						
						if (chatroom != null) {

							chatroom.members.push(new_user)
							chatroom.save(function (err) {
								if (err) {
									console.log(err)
								}
								else {
									socket.join(room_id)

									// Sending to everyone including sender
									io.in(room_id).emit("user joined room", {socket_id: socket.id, username: new_user.username, color_code: msg.color_code, room_id: room_id, room_members: chatroom.members})
								}
							}) 
						}
					}
				})
			}
		})
	})

	socket.on('outgoing message', function(msg) {

		User.findOne({'socket_id': socket.id}, function (err, user) {
			if (err) {
				console.log(err)
			}
			else {
				msg.language = user.language
				msg.username = user.username
				socket.broadcast.to(msg.room_id).emit('incoming message', msg)
			}
		});
	})

	socket.on('translate message', function(msg) {
		var src_lang = msg.language;
		var src_lang_code = lang_codes[src_lang]

		User.findOne({'socket_id': socket.id}, function (err, user) {
			if (err) {
				console.log(err)
			}
			else {
				var dest_lang = user.language;
				var dest_lang_code = lang_codes[dest_lang]

				var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + src_lang_code + "&tl=" + dest_lang_code + "&dt=t&q=" + encodeURI(msg.message);

				request(url, function(err, response, body) {
					if (err) {
						console.log(err)
					}
					else if (response.statusCode == 200) {
						body = JSON.parse(body)
						msg.translated_msg = body[0][0][0]
						socket.emit('incoming translated message', msg)
					}
					else {
						console.log("ERROR: bad response")
					}
				})
			}
		})

	})

	socket.on('set user properties', function(msg) {


		User.findOne({'socket_id': socket.id}, function (err, user) {
			if (err) {
				console.log(err)
			}
			else {
				var old_username = user.username
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
							socket.handshake.session.my_nickname = msg.nickname
							socket.handshake.session.my_language = msg.language
							socket.handshake.session.save()
							io.in(room_id).emit("set new user properties", {old_username: old_username, new_username: user.username, room_members: chatroom.members})
						}
					})
				})
			}
		});
	})

	socket.on('user is typing', function(msg) {

		//sends to everyone except the user who is typing
		socket.to(room_id).emit('user is typing', msg)
	})

	socket.on('user is not typing', function(msg) {
		socket.to(room_id).emit('user is not typing', msg)
	})

	socket.on('disconnect', function() {

		Chatroom.findById(room_id).
		populate('members').
		exec(function(err, chatroom) {
			if (err) {
				console.log(err)
			}
			else if (chatroom != null) {
				User.findOne({'socket_id':socket.id}, function (err, user) {
					if (err) {
						console.log(err)
					}
					else if (user != null) {

						//if (chatroom.members.length == 1) {
						//	chatroom.remove()
						//}
						//else {
							chatroom.members.pull(user)
							chatroom.save(function (err) {
								if (err) {
									console.log(err)
								}
								else {
									io.in(room_id).emit('user left room', {socket_id: socket.id, username: user.username, room_id: room_id, room_members: chatroom.members})
								}
							})
						//}

					}
				})
			}
		})
	})

/*

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
							else if chatroom != null {
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

			*/

				//hatroom.update({_id: chatroom})
/*
				console.log('User ' + usersOnline[socket.id].username + ' disconnected!')
				var username = usersOnline[socket.id].username
				if (username == "") {
					username = socket.id
				}
				delete usersOnline[socket.id]
				io.emit('disconnected', {userid: username, usersOnline: usersOnline})*/
			

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




