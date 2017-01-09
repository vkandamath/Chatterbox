var socket = io();

window.onload = function() {
	$("#message").keypress(function (e) {
		// Hit enter to send
		if (e.which == 13) {
			sendMessage();
		}

		//socket.emit('user is typing', {userId, socket.id});
	});
}

function updateOnlineUsers(msg) {
	// constructs html for list of online users
	var usersHTML = "";
	for (var i = 0; i < msg.usersOnline.length; i++) {
		usersHTML += "<li><svg height='15' width='30'><circle cx='10' cy='10' r='4' stroke='#15F612' stroke-width='1' fill='#15F612'/></svg>" +  msg.usersOnline[i] + "</li>";
		console.log(usersHTML);
	}

	$("#usersOnline ul").html(usersHTML);
}

function sendMessage() {
	var message = $("#message").val();
	if (message != '') {
		$("#message").val('');
		$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
   		socket.emit('outgoing message', {message: message, userid: socket.id});
	}
}

socket.on('connected', function(msg) {
	$("#messages ul").append("<li><font color='green'>User " + msg.userid + " has connected.</font></li>");

	updateOnlineUsers(msg);
});

socket.on('myUserId', function(msg) {
	$("#user").append("User " + "<font color='#337AB7'>" + msg.userId + "</font>");
});

socket.on('disconnected', function(msg) {
	$("#messages ul").append("<li><li><font color='red'>User " + msg.userid + " has disconnected.</font></li>");
	console.log("Users online: " + msg.usersOnline);

	updateOnlineUsers(msg);
});

socket.on('incoming message', function(msg){
    console.log(msg);
    $("#messages ul").append("<li>User " + msg.userid + ": " + msg.message + "</li>");
});

socket.on('user is typing', function(msg) {
	$("#user-typing").html("User is typing...")
});

