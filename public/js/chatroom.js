var socket = io()

var color_code

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

function appendMessage(message, color_code, is_my_message) {
	console.log("appending")
	var message_bubble = "<div class='message-bubble' style='background-color: " + color_code + ";" 

	if (is_my_message) {
		message_bubble += " float: right;'"
	}
	else {
		message_bubble += " float: left;'"
	}

	message_bubble += ">" + message + "</div><br><br>"

	console.log(message_bubble)

	$("#messages").append(message_bubble);
	$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
}

function setUserProperties() {
	console.log("setting")
	var nickname = $("#modal-nickname").val()

	var language = $("#modal-lang").val()
	
	username = nickname
	my_language = language

	socket.emit('set user properties', {nickname: nickname, language: language, is_new_user: true})
}

function sendMessage() {

	var message = $("#enter-message").val();
	if (message != '') {
		$("#enter-message").val('');

		appendMessage(message, color_code, true)
   		socket.emit('outgoing message', {message: message, color_code: color_code, room_id: room_id});
	}
}

function updateOnlineUsers(room_members) {

	// constructs html for list of online users
	var users_html = "";

	room_members.forEach(function(member) {
		console.log(member);
		users_html += "<li><div style='display: inline-block'><svg height='20' width='20'><circle cx='10' cy='10' r='10' stroke-width='0' fill='" + member.color_code + "'/></svg></svg></div>";
		users_html += "<div style='display: inline-block; text-align: center; margin-left: 10px'><p style='line-height: 75%'>" + member.username + "<br><span style='font-size: 10px'>" + member.language + "</span></p></div></li>"
	});

	$("#online-users ul").html(users_html);
}


window.onload = function() {


	$("#chatroom-nickname").html(username)

	$("#join-chat-btn").click(function(){
		var nickname = $("#modal-nickname").val()
		if (nickname == "") {
			$("#modal-nickname").css("border", "1px solid red")
		}
		else {
			setUserProperties()
		}
	})

	var timer;

	// User is typing
	$("#enter-message").keydown(function (e) {
		socket.emit('user is typing', {username: username});
		window.clearTimeout(timer);
	});

	// User is not typing
	$("#enter-message").keyup(function (e) {

		timer = window.setTimeout(function() {
			socket.emit('user is not typing', {username: username});
		}, 2500);
		
	});

	new Clipboard('#copy-link-btn');

	$("#copy-link-btn").click(function() {
		$("#copy-link-btn").html("Copied!")
	})

	$("#current-url").val(window.location.href)
	$("#current-url").attr("size", window.location.href.length)



	if (on_connect_context == "user joins room for first time") {
		$("#new-user-modal").modal({backdrop: 'static', keyboard: false})
		color_code  = generateColorCode()
		socket.emit("joined room", {room_id: room_id, username: username, my_language: my_language, color_code: color_code});
	}
	else {
		color_code  = generateColorCode()
		socket.emit("joined room", {room_id: room_id, username: username, my_language: my_language, color_code: color_code});
	}

	// FUTURE: add in case where user opens same room in another tab

	
	$("#enter-message").keypress(function (e) {
		// Hit enter to send
		if (e.which == 13) {
			sendMessage();
		}
	});

	socket.on('user joined room', function(msg) {
		console.log("user " + msg.username + " joined");

		$("#messages").append("<p class='animated flash log-event'><strong>" + msg.username + "</strong> has joined the room.</p>");
	    $("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;

	   	updateOnlineUsers(msg.room_members)
	});

	socket.on('incoming message', function(msg){

		socket.emit('translate message', msg);

	});

	socket.on('incoming translated message', function(msg) {
		console.log(msg);
		appendMessage(msg.translated_msg, msg.color_code, false)
	})

	socket.on('user left room', function(msg) {
		$("#messages").append("<p class='animated flash log-event'><strong>" + msg.username + "</strong> has left the room.</p>");
		$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
		updateOnlineUsers(msg.room_members);
	});

	socket.on('set new user properties', function(msg) {
		console.log("set new user properties")
		$("#messages").html("<p class='animated flash log-event'><strong>" + msg.new_username + "</strong> has joined the room.</p>");
		$("#new-user-modal").modal("hide")
		updateOnlineUsers(msg.room_members)
	})

	socket.on('user is typing', function(msg) {
		$("#user-is-typing").html(msg.username + " is typing...")
	});

	socket.on('user is not typing', function(msg) {
		$("#user-is-typing").html("")
	});

	socket.on('set temp username', function(msg) {
		username = msg.username
		language = msg.my_language
	})




/*

	var timer;

	// User is typing
	$("#message").keydown(function (e) {
		socket.emit('user is typing', {username, username});
		window.clearTimeout(timer);
	});

	// User is not typing
	$("#message").keyup(function (e) {

		timer = window.setTimeout(function() {
			socket.emit('user is not typing', {username, username});
		}, 2500);
		
	});

	// Takes new username after user hits enter
	$("#change-username").keypress(function (e) {
		if (e.which == 13) {
			var newUsername = $("#change-username").val();
			if (newUsername != '') {
				socket.emit('username change', {socketId: socket.id, oldUsername: username, newUsername: newUsername});
				username = newUsername;
				console.log(username);
			}
		}
	});

	// trigger file uploads if browser button is clicked
	$("#browse").click(function() {
		$("#upload").trigger("click");
	});

}

function sendImage() {
	var file = $("#upload")[0].files[0];
	var reader = new FileReader();

	if (file){
		reader.readAsDataURL(file);
	}

	reader.onload = function(event) {

		$("#messages").append("<div style='text-align: right'><p class='my-message' style='color: " + color_code + "'><strong>Me:</strong> <img class='img-thumbnail' src='" + reader.result + "'></p></div>");
    	$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;

		socket.emit("outgoing image", {color_code: color_code, socketId: socket.id, username: username, imageData: reader.result});
	}
}

function updateOnlineUsers(msg) {
	// constructs html for list of online users
	var usersHTML = "";

	Object.keys(msg.usersOnline).forEach(function (key) {
		//console.log(msg.usersOnline);
		usersHTML += "<p><svg height='15' width='30'><circle cx='10' cy='10' r='4' stroke='" + msg.usersOnline[key].color_code + "' stroke-width='1' fill='" + msg.usersOnline[key].color_code + "'/></svg>";
		if (msg.usersOnline[key].username == '') {
			usersHTML += key;
		}
		else {
			usersHTML += msg.usersOnline[key].username;
		}
		usersHTML += "</p>"
	});

	$("#usersOnline ul").html(usersHTML);
}

*/
}

/*
function changeTitle(text) {
	var title = document.title;
	if (title == 'Chatterbox') {
		document.title = text;
	}
	else {
		document.title = 'Chatterbox';
	}
}

function changeColor(colorHex) {
	color_code = "#" + String(colorHex);
	$(".my-message").css("color", color_code);
	socket.emit('change color', {socketid: socket.id, colorHex: String(colorHex)});
}
*/



/*


socket.on('myUserId', function(msg) {
	$("#change-username").val(msg.username);

	var tempColorCode = msg.color_code;
	tempColorCode = tempColorCode.substring(1);

	// converting color code to rgb
	var r = parseInt(tempColorCode.substring(0,2), 16);
	var g = parseInt(tempColorCode.substring(2,4), 16);
	var b = parseInt(tempColorCode.substring(4,6), 16);

	//change background color of input button
	$("#color-picker").css("background-color", "rgb(" + r + "," + g + "," + b + ")");
	$("#color-picker").val(tempColorCode);

	username = msg.username;
	color_code = msg.color_code;
});

socket.on('disconnected', function(msg) {
	$("#messages").append("<div><p class='animated flash'><font color='black'><strong>" + msg.userid + "</strong> has disconnected.</font></p></div>");
	$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
	updateOnlineUsers(msg);
});



socket.on('user is typing', function(msg) {
	$("#user-typing").html(msg.username + " is typing...")
});

socket.on('user is not typing', function(msg) {
	$("#user-typing").html("&nbsp");
});

socket.on('username change', function(msg) {
	$('#messages').append("<div><p class='animated flash'><font color='black'><strong>" + msg.oldUsername + "</strong> changed his/her username to <strong>" + msg.newUsername + '</strong></font></p></div>');
	$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
	updateOnlineUsers(msg);
});

socket.on('change color', function(msg) {
	updateOnlineUsers(msg);

	//Change existing chat messages of user to new color
	$(".messageOf-" + msg.socketid).css("color", "#" + msg.colorHex);
});

socket.on('incoming image', function(msg) {
	$("#messages").append("<div><p class='messageOf-" + msg.socketId + "' style='color:" + msg.color_code + "'><strong>" + msg.username + "</strong>: <img class='img-thumbnail' src='" + msg.imageData + "'></p></div>");
    $("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
});*/


