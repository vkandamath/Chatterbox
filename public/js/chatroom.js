var socket = io();

socket.on('connected', function(msg) {
	$("#messages-list").append("<li>User " + msg.userid + "has connected.</li>");
});

socket.on('myUserId', function(msg) {
	$("#message-label").append("User " + msg.userId + ": ");
})

socket.on('disconnected', function(msg) {
	$("#messages-list").append("<li>User " + msg.userid + "has disconnected.</li>");
});

socket.on('incoming message', function(msg){
    console.log(msg);
    $("#messages-list").append("<li>User " + msg.userid + ": " + msg.message + "</li>");
});


function sendMessage() {
	var message = $("#message").val();
	$("#message").val('');
   	socket.emit('outgoing message', {message: message, userid: socket.id});
}
