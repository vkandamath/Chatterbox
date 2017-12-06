var socket = io()

var color_code

// Generates random color in HSL
function generateColorHSL() {

	var h = Math.floor(Math.random() * 360)
	var s = Math.floor(Math.random() * 50 + 50)
	var l = Math.floor(Math.random() * 60)

	var hsl = "hsl(" + h + ", " + s + "%, " + l + "%)"

	return hsl
}

function appendMessage(username, message, color_code, is_my_message) {

	var message_bubble = "<div class='message-bubble' style='background-color: " + color_code + ";" 

	if (is_my_message) {
		message_bubble += " float: right;'"
	}
	else {
		message_bubble += " float: left;'"
	}

	message_bubble += ">" + message + "<hr class='msg-hr'><span style='font-size: 10px'>" + username + "</span></div><br><br><br><br>"

	$("#messages").append(message_bubble)
	$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight
}

function setUserProperties() {

	var nickname = $("#modal-nickname").val()

	var language = $("#modal-lang").val()
	
	username = nickname
	my_language = language

	socket.emit('set user properties', {nickname: nickname, language: language, is_new_user: true})
}

function sendMessage() {

	var message = $("#enter-message").val()
	if (message != '') {
		$("#enter-message").val('')

		appendMessage(username, message, color_code, true)
   		socket.emit('outgoing message', {message: message, color_code: color_code, room_id: room_id})
	}
}

function updateOnlineUsers(room_members) {

	// constructs html for list of online users
	var users_html = ""

	room_members.forEach(function(member) {
		users_html += "<li class='user-block'><div style='display: inline-block'><svg height='20' width='20'><circle cx='10' cy='10' r='10' stroke-width='0' fill='" + member.color_code + "'/></svg></svg></div>"
		users_html += "<div style='display: inline-block; text-align: center; margin-left: 10px'><p style='line-height: 50%'>" + member.username + "<br><br><span style='font-size: 10px;'>" + member.language + "</span></p></div></li>"
	})

	$("#online-users ul").html(users_html)
}


$(document).ready(function() {

	$("#bitly-link").val(bitly_url)

	$("#share-room-btn").click(function() {
		$("#share-room-modal").modal()
	})

	$("#chatroom-nickname").html(username)
	$("#chatroom-language").html(my_language)

	$("#join-chat-btn").click(function(){
		setUserProperties()
	})

	var timer

	// User is typing
	$("#enter-message").keydown(function (e) {
		socket.emit('user is typing', {username: username})
		window.clearTimeout(timer)
	})

	// User is not typing
	$("#enter-message").keyup(function (e) {

		timer = window.setTimeout(function() {
			socket.emit('user is not typing', {username: username})
		}, 2500)
		
	})

	// Initialize copy link button functionality
	new Clipboard('#copy-link-btn')

	$("#copy-link-btn").click(function() {
		$("#copy-link-btn").html("Copied!")
	})

	$("#current-url").val(window.location.href)
	$("#current-url").attr("size", window.location.href.length)

	if (on_connect_context == "user joins room for first time") {
		$("#new-user-modal").modal({backdrop: 'static', keyboard: false})
	}
	
	color_code  = generateColorHSL()
	socket.emit("joined room", {room_id: room_id, username: username, my_language: my_language, color_code: color_code})

	$("#enter-message").keypress(function (e) {
		const ENTER_KEY_CODE = 13

		if (e.which == ENTER_KEY_CODE) {
			sendMessage()
		}
	})

	socket.on('display chat history', function(msg) {
		msg.history.forEach(function(event) {
			$("#messages").append(event)
		})
	})

	socket.on('user joined room', function(msg) {

		$("#messages").append("<p class='animated flash log-event'><strong>" + msg.username + "</strong> has joined the room.</p>")
	    $("#messages")[0].scrollTop = $("#messages")[0].scrollHeight

	   	updateOnlineUsers(msg.room_members)
	})

	socket.on('incoming message', function(msg){
		socket.emit('translate message', msg)
	})

	socket.on('incoming translated message', function(msg) {
		appendMessage(msg.username, msg.translated_msg, msg.color_code, false)
	})

	socket.on('user left room', function(msg) {
		$("#messages").append("<p class='animated flash log-event'><strong>" + msg.username + "</strong> has left the room.</p>")
		$("#messages")[0].scrollTop = $("#messages")[0].scrollHeight
		updateOnlineUsers(msg.room_members)
	})

	socket.on('set new user properties', function(msg) {
		$("#messages").html("<p class='animated flash log-event'><strong>" + msg.new_username + "</strong> has joined the room.</p>")
		$("#chatroom-nickname").html(username)
		$("#chatroom-language").html(my_language)
		$("#new-user-modal").modal("hide")
		updateOnlineUsers(msg.room_members)
	})

	socket.on('could not set new user properties', function(msg) {
		$("#" + msg.field + "-form-group").addClass("has-error")
		$("#login-errors").addClass("alert")
        $("#login-errors").addClass("alert-danger")
        $("#login-errors").html(msg.error)
        $("#login-errors").css("color", "#a94442")
        $("#login-errors").css("font-size", "14px")
        $("#join-chat-btn").css("margin-bottom", "15px")
	})

	socket.on('user is typing', function(msg) {
		$("#user-is-typing").html(msg.username + " is typing...")
	})

	socket.on('user is not typing', function(msg) {
		$("#user-is-typing").html("")
	})

	socket.on('set temp username', function(msg) {
		username = msg.username
		language = msg.my_language
	})
})