// Importing packages
var express = require('express'),
	app = require('express')(),
	server = require('http').Server(app),
	io = require('socket.io')(server),
	mongoose = require ("mongoose"),
	bodyParser = require('body-parser'),
	fs = require('fs'),
	request = require('request'),
	shortid = require('shortid'),
	ios = require('socket.io-express-session');

// Mongodb setup
var mongoUri = process.env.MONGOLAB_URI
mongoose.connect(mongoUri, {useMongoClient: true}, function (err, res) {
	if (err) {
		console.log ('ERROR connecting to: ' + mongoUri + '. ' + err)
	} 
	else {
		// Drops existing database every time app is started
		mongoose.connection.db.dropDatabase()
	}
})

// Defining schemas for readability
var Schema = mongoose.Schema

/* NOTE: Assume socket_id is not unique since same socket id can be regenerated 
between previously disconnected user and newly connected user */
var userShema = Schema({
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
	log_messages: [{type: String}],
	bitly_url: String
})

// Defining data models using schemeas
var User = mongoose.model('User', userShema)
var Chatroom = mongoose.model('Chatroom', chatroomSchema)

// Language codes
var lang_codes = {
	English: "en",
	French: "fr",
	German: "de",
	Italian: "it",
	Spanish: "es",
}

// Enables user sessions
var session = require("express-session")({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
})

// Integrates session with socket.io
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

// Present user with homepage
app.get('/', function (req, res) {
	res.render('welcome', {error_msg: "", field: "", nickname: ""})
})

// Create new chatroom and redirects user
app.get('/room', function (req, res, next) {

	if (!req.param('nickname')) {
		res.render('welcome', {error_msg: "Nickname is required!", field: "nickname-input", nickname: ""})
	}
	else if (!lang_codes[req.param('language')]) {
		res.render('welcome', {error_msg: "Language is invalid!", field: "language-input", nickname: req.param('nickname')})
	}
	else {
		req.session.my_nickname = req.param('nickname')
		req.session.my_language = req.param('language')
		req.session.creating_room = true

		var newChatroom = Chatroom()

		// Generating bitly here upon room creation to ensure bitly api is only called once per chatroom
		var chatroom_url = 'https://chatlingual10.herokuapp.com/room/' + newChatroom._id
		var bitly_url = "https://api-ssl.bitly.com/v3/shorten?access_token=" + process.env.BITLY_ACCESS_TOKEN + "&longUrl=" + chatroom_url

		request(bitly_url, function(err, response, body) {
			if (err) {
				console.log(err)
			}
			else if (response.statusCode == 200) {
				body = JSON.parse(body)
				var shortened_url = body["data"]["url"]
				newChatroom.bitly_url = shortened_url

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
			else {
				console.log("ERROR: bad response")
			}
		})
	}
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
				//chatroom doesn't exist
				if (chatroom == null) 
					res.redirect('/')
				else {
					// new joiner
					if (my_nickname == null)
						res.render('chatroom', {room_id: room_id, my_nickname: my_nickname, my_language: my_language, bitly_url: chatroom.bitly_url, on_connect_context: "user joins room for first time",})
					// creating new room
					else if (req.session.creating_room)
						res.render('chatroom', {room_id: room_id, my_nickname: my_nickname, my_language: my_language, bitly_url: chatroom.bitly_url, on_connect_context: "user creating new room"})
					//existing users
					else
						res.render('chatroom', {room_id: room_id, my_nickname: my_nickname, my_language: my_language, bitly_url: chatroom.bitly_url, on_connect_context: "existing user opens new tab"})
				}
			}
		})
})

// Redirects user to homepage if they try to access something else
app.get('/*', function (req, res) {
	res.redirect('/')
})

// Socket connection
io.on('connection', function(socket) { 

	var room_id

	socket.emit("sessiondata", socket.handshake.session)

	socket.on('joined room', function(msg) {

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

									// Retrieve chat history for new user
									const HISTORY_SIZE_LIMIT = 100;
									var history = chatroom.log_messages

									if (history.length > 100) {
										history = chatroom.log_messages[history.length - HISTORY_SIZE_LIMIT]
									}

									socket.emit("display chat history", {history: history})

									// Sending to everyone including sender
									io.in(room_id).emit("user joined room", {socket_id: socket.id, username: new_user.username, 
										color_code: msg.color_code, room_id: room_id, room_members: chatroom.members})
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
				Chatroom.findById(msg.room_id, function (err, chatroom) {
					if (err) {
						console.log(err)
					}
					else {
						chatroom.log_messages.push("<div class='message-bubble' style='background-color: " + msg.color_code + "; float: left;'>" 
							+ msg.message + "<hr id='msg-hr'><span style='font-size 10px'>" + user.username + "</span></div><br><br><br><br>")
						chatroom.save(function(err) {
							msg.language = user.language
							msg.username = user.username
							socket.broadcast.to(msg.room_id).emit('incoming message', msg)
						})
					}
				})
			}
		})
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

		// Server side form validation
		if (!msg.nickname) {
			socket.emit("could not set new user properties", {error: "Nickname is required!", field: "modal-nickname"})
		}
		else if (!lang_codes[msg.language]){
			socket.emit("could not set new user properties", {error: "Language is invalid!", field: "modal-language"})
		}
		else {

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
			})
		}
	})

	socket.on('user is typing', function(msg) {
		// Sends to everyone except the user who is typing
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
				})
			}
		})
	})
})




