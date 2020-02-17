var express = require('express');
var http = require('http');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

var port = 5000;

app.use('/', express.static(__dirname + '/'));

app.get('/', function(request, response) {
	response.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(process.env.PORT || port, function() {
	if (!process.env.PORT) {
		app.set('port', port);
		console.log('Game started on port ' + port + '\n');
	}
});

io.on('connection', function(socket) {
	console.log('New Connection');
   	socket.on('message', function(message) {
		try {
			console.log(message);
		} catch (e) {
			console.log(e);
		}
   	});
});