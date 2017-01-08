var socket = io();

window.onload = function() {
	$("#message").keypress(function (e) {
		if (e.which == 13) {
			sendMessage();
		}
	});
}

socket.on('connected', function(msg) {
	$("#messages ul").append("<li><font color='green'>User " + msg.userid + "has connected.</font></li>");
});

socket.on('myUserId', function(msg) {
	$("#user").append("User " + "<font color='#337AB7'>" + msg.userId + "</font>");
})

socket.on('disconnected', function(msg) {
	$("#messages ul").append("<li><li><font color='red'>User " + msg.userid + "has disconnected.</font></li>");
});

socket.on('incoming message', function(msg){
    console.log(msg);
    $("#messages ul").append("<li>User " + msg.userid + ": " + msg.message + "</li>");
});


function sendMessage() {
	var message = $("#message").val();

	if (message != '') {
		$("#message").val('');
   		socket.emit('outgoing message', {message: message, userid: socket.id});
   		$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
	}
}
