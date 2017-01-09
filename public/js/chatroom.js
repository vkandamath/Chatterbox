var socket = io();
var userId;

window.onload = function() {
	$("#message").keypress(function (e) {
		// Hit enter to send
		if (e.which == 13) {
			sendMessage();
		}
	});

	var timer;

	// User is typing
	$("#message").keydown(function (e) {
		socket.emit('user is typing', {userId, userId});
		window.clearTimeout(timer);
	});

	// User is not typing
	$("#message").keyup(function (e) {

		timer = window.setTimeout(function() {
			socket.emit('user is not typing', {userId, userId});
		}, 2500)
		
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
   		socket.emit('outgoing message', {message: message, userid: socket.id});
	}
	else {
		var button = $("#sendMessage");

		button.removeClass('animated shake');
		setInterval(function() {
			button.addClass('animated shake');
		}, 1000);

	}
}

socket.on('connected', function(msg) {
	$("#messages ul").append("<li class='animated flash'><font color='green'>User " + msg.userid + " has connected.</font></li>");
	$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
	updateOnlineUsers(msg);
});

socket.on('myUserId', function(msg) {
	$("#user").append("User " + "<font color='#337AB7'>" + msg.userId + "</font>");
	userId = msg.userId;
});

socket.on('disconnected', function(msg) {
	$("#messages ul").append("<li><li class='animated flash'><font color='red'>User " + msg.userid + " has disconnected.</font></li>");
	$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
	updateOnlineUsers(msg);
});

socket.on('incoming message', function(msg){
    console.log(msg);
    $("#messages ul").append("<li>User " + msg.userid + ": " + msg.message + "</li>");
    $("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
});

socket.on('user is typing', function(msg) {
	$("#user-typing").html(msg.userId + " is typing...")
});

socket.on('user is not typing', function(msg) {
	$("#user-typing").empty();
});


