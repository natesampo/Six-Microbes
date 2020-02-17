var socket = io();

var ticks = 60;
var host = false;
var pxRatio = window.devicePixelRatio || window.screen.availWidth/document.documentElement.clientWidth;

var dragging = -1;
var to_render = [];
var id_to_color = {"Mip": [220, 30, 40],
                    "Newp": [30, 120, 240]};

var canvas = document.getElementById('canvas');
canvas.style.position = 'absolute';
canvas.style.top = 0;
canvas.style.left = 0;
canvas.width = window.innerWidth*pxRatio;
canvas.height = window.innerHeight*pxRatio;

class SugarRender {
	constructor(agent_string) {
	    var split = agent_string.split(",");
	    this.id = split[0];
	    this.pos = [parseFloat(split[1]), parseFloat(split[2])];
	    this.diameter = 0.003;
	}

	render(canvas, context) {
		var x = this.pos[0];
		var y = this.pos[1];
		var width = canvas.width * this.diameter;
		var height = canvas.height * this.diameter;

		context.fillStyle = 'rgba(180, 180, 180, 1)';
		context.beginPath();
		context.rect(x*canvas.width, y*canvas.height, width, height);
		context.fill();
		context.closePath();
	}
}

function color_context(color_list, alpha) {
    return 'rgba(' + color_list[0] + ', ' + color_list[1] + ', ' + color_list[2] + ', ' + alpha + ')';
}

class AgentRender {
	constructor(agent_string) {
	    var split = agent_string.split(",");

	    this.id = split[0];
	    this.color = id_to_color[this.id]; // TODO don't hard-code colors
	    this.pos = [parseFloat(split[1]), parseFloat(split[2])];
	    this.immune = parseInt(split[3]);
	    this.diameter = 0.007
	}

	render(canvas, context) {
		var x = this.pos[0];
		var y = this.pos[1];
		var width = canvas.width * this.diameter;
		var height = canvas.height * this.diameter;

		if (this.immune == 1) {
		    context.fillStyle = color_context([255, 255, 255], 1);
            context.beginPath();
            context.ellipse(x*canvas.width, y*canvas.height, width*1.2, height*1.2, 0, 0, 2*Math.PI);
            context.fill();
            context.closePath();
		}

		context.fillStyle = color_context(this.color, 1);
		context.beginPath();
		context.ellipse(x*canvas.width, y*canvas.height, width, height, 0, 0, 2*Math.PI);
		context.fill();
		context.closePath();

		context.fillStyle = color_context([this.color[0] + 100, this.color[1] + 100, this.color[2] + 100], 1);
		context.beginPath();
		context.ellipse(x*canvas.width, y*canvas.height, width/2, height/2, 0, 0, 2*Math.PI);
		context.fill();
		context.closePath();
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
buttons.push(new Slider('Mutation Rate', 0.45, 0.35, 0.1, 0.004, 0.003));
buttons.push(new Slider('Robustness', 0.45, 0.45, 0.1, 0.004, 0.003));

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
    to_render = [];
    try {
        var pieces = packet.split(";");
        for (let i in pieces) {
            var info = pieces[i].split(",");
            if (info[0] == "Sugar") {
                to_render.push(new SugarRender(pieces[i]));
            } else {
                to_render.push(new AgentRender(pieces[i]));
            }
        }
    } catch(e) {
        console.log(e);
    }
});

setInterval(function() {
	canvas = document.getElementById('canvas');
	context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;

	render(canvas, context);
}, 1000/ticks);

document.addEventListener('mouseup', function(event) {
	dragging = -1;
});

document.addEventListener('mousedown', function(event) {
	console.log(pxRatio);
	for (var i in buttons) {
		var button = buttons[i];
		if (event.clientX + window.scrollX >= button.x*window.innerWidth - ((button.type == 'slider') ? 2*button.size*canvas.width : 0) && event.clientX + window.scrollX <= button.x*canvas.width + button.width*canvas.width + ((button.type == 'slider') ? 2*button.size*canvas.width : 0) && event.clientY + window.scrollY >= button.y*canvas.height - ((button.type == 'slider') ? 2*button.size*canvas.width : 0) && event.clientY + window.scrollY <= button.y*canvas.height + button.height*canvas.height + ((button.type == 'slider') ? 2*button.size*canvas.width : 0)) {
			if (button.type == 'slider') {
				button.value = Math.min(Math.max((event.clientX + window.scrollX - button.x*canvas.width)/(button.width*canvas.width), 0), 1);
				dragging = i;
			} else {
				button.onClick();
			}

			break;
		}
	}
});

document.addEventListener('mousemove', function(event) {
	if (dragging != -1) {
		var button = buttons[dragging];
		button.value = Math.min(Math.max((event.clientX + window.scrollX - button.x*canvas.width)/(button.width*canvas.width), 0), 1);
	}
});

window.addEventListener('resize', function(event) {
	var newPxRatio = window.devicePixelRatio || window.screen.availWidth/document.documentElement.clientWidth;
	if (newPxRatio == pxRatio) {
		canvas.width = window.innerWidth*pxRatio;
		canvas.height = window.innerHeight*pxRatio;
	} else {
		pxRatio = newPxRatio;
	}

});