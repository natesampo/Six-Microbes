var socket = io();

var ticks = 60;

var canvas = document.getElementById('canvas');
canvas.style.position = 'absolute';
canvas.style.top = 0;
canvas.style.left = 0;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;

function render() {
	context.clearRect(0, 0, canvas.width, canvas.height);

	context.fillStyle = 'rgba(40, 40, 40, 1)';
	context.fillRect(0, 0, canvas.width, canvas.height);
}

setInterval(function() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;

	render();
}, 1000/ticks);

document.addEventListener('mousedown', function(event) {
	socket.emit('message', 'Clicky');
});