var socket = io();

var ticks = 60;
var host = true;

var dragging = -1;
var to_render = [];

var canvas = document.getElementById('canvas');
canvas.style.position = 'absolute';
canvas.style.top = 0;
canvas.style.left = 0;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

class AgentRender {
	constructor(agent_string) {
	    var split = agent_string.split(",");

	    this.id = split[0];
	    this.survivability = parseFloat(split[1]);
	    this.color = color.slice();
	    this.pos = [parseFloat(split[2]), parseFloat(split[3])];
	    console.log(agent_string);
	}

	render(canvas, context) {
		var x = this.pos[0];
		var y = this.pos[1];
		var width = (this.survivability + 1) * canvas.width * 0.01;
		var height = (this.survivability + 1) * canvas.width * 0.01;

		context.fillStyle = 'rgba(' + this.color[0] + ', ' + this.color[1] + ', ' + this.color[2] + ', 1)';
		context.beginPath();
		context.arc(x, y, width, 0, 2*Math.PI);
		context.fill();
		context.closePath();
		console.log("woo");
	}
}

class Slider {
	constructor(id, x, y, width, height, size) {
		this.id = id;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.size = size;
		this.value = 0.5;
		this.type = 'slider';
	}

	render(canvas, context) {
		context.fillStyle = 'rgba(5, 5, 5, 1)';
		context.fillRect(this.x*canvas.width, this.y*canvas.height, this.width*canvas.width, this.height*canvas.height);

		context.fillStyle = 'rgba(230, 230, 230, 1)';
		context.strokeStyle = 'rgba(5, 5, 5, 1)';
		context.lineWidth = 2;
		context.beginPath();
		context.arc(this.x*canvas.width + this.value*this.width*canvas.width + canvas.width*this.size/2, this.y*canvas.height + this.height*canvas.height/2, 2*this.size*canvas.width, 0, Math.PI*2);
		context.fill();
		context.stroke();
		context.closePath();

		context.font = (canvas.width/90).toString() + 'px Arial';
		context.strokeText(this.id, this.x*canvas.width + this.width*canvas.width/2 - context.measureText(this.id).width/2, this.y*canvas.height + this.size*canvas.height*12.2);
		context.fillText(this.id, this.x*canvas.width + this.width*canvas.width/2 - context.measureText(this.id).width/2, this.y*canvas.height + this.size*canvas.height*12.2);
	}
}

var buttons = [];
buttons.push(new Slider('Mutation Rate', 0.45, 0.45, 0.1, 0.004, 0.003));

function render(canvas, context) {
	context.clearRect(0, 0, canvas.width, canvas.height);

	context.fillStyle = 'rgba(40, 40, 40, 1)';
	context.fillRect(0, 0, canvas.width, canvas.height);

    if (host) {
    	for (var i in to_render) {
	        to_render[i].render(canvas, context);
	    }

    } else {
    	for (var i in buttons) {
		    buttons[i].render(canvas, context);
        }
    }
}

socket.on("update", function(packet) {
    console.log("new packet");
    to_render = [];
    try {
        var pieces = packet.split(";");
        for (let i in pieces) {
            to_render.push(new AgentRender(pieces[i]));
        }
    } catch(e) {
        console.log(e);
    }
});

setInterval(function() {
	var canvas = document.getElementById('canvas');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;

	render(canvas, context);
}, 1000/ticks);

document.addEventListener('mouseup', function(event) {
	dragging = -1;
});

document.addEventListener('mousedown', function(event) {
	for (var i in buttons) {
		var button = buttons[i];
		if (event.clientX >= button.x*window.innerWidth - ((button.type == 'slider') ? button.size*window.innerWidth : 0) && event.clientX <= button.x*window.innerWidth + button.width*window.innerWidth + ((button.type == 'slider') ? button.size*window.innerWidth : 0) && event.clientY >= button.y*window.innerHeight - ((button.type == 'slider') ? button.size*window.innerWidth : 0) && event.clientY <= button.y*window.innerHeight + button.height*window.innerHeight + ((button.type == 'slider') ? button.size*window.innerWidth : 0)) {
			if (button.type == 'slider') {
				console.log((button.x*window.innerWidth + event.clientX)/(button.x*window.innerWidth + button.width*window.innerWidth));
				button.value = Math.min(Math.max((button.x*window.innerWidth + event.clientX)/(button.x*window.innerWidth + button.width*window.innerWidth), 0), 1);
			} else {
				button.onClick();
			}

			break;
		}
	}
});