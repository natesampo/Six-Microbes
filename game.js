var socket = io();

var ticks = 60;
var host = false;
var pxRatio = window.devicePixelRatio || window.screen.availWidth/document.documentElement.clientWidth;

var dragging = -1;
var to_render = [];
var colors = [[220, 30, 40], [30, 120, 240], [240, 130, 30]].reverse();
var id_to_color = {};
var species_cards = [];
var maxStats = 5;
var statPoints = 10;

var metabolism = 4;
var toxicity = 1;
var robustness = 1;
var flagella = 1;

var canvas = document.getElementById('canvas');
canvas.style.position = 'absolute';
canvas.style.top = 0;
canvas.style.left = 0;
canvas.width = window.innerWidth*pxRatio;
canvas.height = window.innerHeight*pxRatio;

function x_to_draw(x) {
    return (x * 9/16 * canvas.width);
}

function y_to_draw(y) {
    return (y * canvas.height);
}

function become_host() {
	host = true;
	socket.emit('become_host');
}

class SpeciesCard {
    constructor(species_id) {
        this.id = species_id;
        this.color = [120, 120, 120];
        if (!(this.id in id_to_color)) {
            this.color = id_to_color[this.id];
        }
        to_render.push(this);
    }

    render(canvas, context) {
        var xmin = 10/16 * canvas.width;
        var xmax = 15/16 * canvas.height;
        var width = xmax - xmin;
        var ymin = 1/16 * canvas.height;
        ymin += 2/16 * canvas.height * species_cards.indexOf(this);
        var height = 2/16 * canvas.height;

        context.fillStyle = 'rgba(0, 255, 255, 1)';
        context.fillRect(xmin, ymin, width, height);
    }
}

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
		var width = x_to_draw(this.diameter);
		var height = y_to_draw(this.diameter);

		context.fillStyle = 'rgba(180, 180, 180, 1)';
		context.beginPath();
		context.rect(x_to_draw(x), y_to_draw(y), width, height);
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
	    if (!(this.id in id_to_color)) {
	        id_to_color[this.id] = colors.pop();
	        species_cards.push(new SpeciesCard(this.id));
	    }
	    this.color = id_to_color[this.id]; // TODO don't hard-code colors
	    this.pos = [parseFloat(split[1]), parseFloat(split[2])];
	    this.immune = parseInt(split[3]);
	    this.diameter = 0.007;
	}

	render(canvas, context) {
		var x = this.pos[0];
		var y = this.pos[1];
		var width = x_to_draw(this.diameter);
		var height = y_to_draw(this.diameter);

		if (this.immune == 1) {
		    context.fillStyle = color_context([255, 255, 255], 1);
            context.beginPath();
            context.ellipse(x_to_draw(x), y_to_draw(y), width*1.2, height*1.2, 0, 0, 2*Math.PI);
            context.fill();
            context.closePath();
		}

		context.fillStyle = color_context(this.color, 1);
		context.beginPath();
		context.ellipse(x_to_draw(x), y_to_draw(y), width, height, 0, 0, 2*Math.PI);
		context.fill();
		context.closePath();

		context.fillStyle = color_context([this.color[0] + 100, this.color[1] + 100, this.color[2] + 100], 1);
		context.beginPath();
		context.ellipse(x_to_draw(x), y_to_draw(y), width/2, height/2, 0, 0, 2*Math.PI);
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

class PointDisplay {
	constructor(id, x, y, segmentWidth, segmentHeight, segmentGap, stat) {
		this.id = id;
		this.displayX = x;
		this.displayY = y;
		this.x = x - 0.85*segmentWidth;
		this.y = y;
		this.width = segmentWidth*0.6;
		this.height = segmentHeight;
		this.segmentWidth = segmentWidth;
		this.segmentHeight = segmentHeight;
		this.segmentGap = segmentGap;
		this.stat = stat;
		this.type = 'pointDisplay';
	}

	render(canvas, context) {
		context.fillStyle = 'rgba(230, 230, 230, 1)';
		context.strokeStyle = 'rgba(5, 5, 5, 1)';
		context.lineWidth = 2;
		context.beginPath();
		context.rect(canvas.width*this.x, canvas.height*this.y, canvas.width*this.width, canvas.height*(this.height/2 - 0.0025));
		context.moveTo(canvas.width*this.x, canvas.height*(this.y + this.height/2 + 0.0025));
		context.rect(canvas.width*this.x, canvas.height*(this.y + this.height/2 + 0.0025), canvas.width*this.width, canvas.height*(this.height/2 - 0.0025));
		context.fill();
		context.stroke();
		context.closePath();

		context.fillStyle = 'rgba(5, 5, 5, 1)';
		context.lineWidth = 3;
		context.beginPath();
		context.moveTo(canvas.width*(this.x + this.width*0.2), canvas.height*(this.y + (this.height/2 - 0.0025)/2 - this.height*0.07) + (canvas.height*this.height*0.15)/2);
		context.lineTo(canvas.width*(this.x + this.width*0.2) + canvas.width*this.width*0.6, canvas.height*(this.y + (this.height/2 - 0.0025)/2 - this.height*0.07) + (canvas.height*this.height*0.15)/2);
		context.moveTo(canvas.width*(this.x + this.width*0.2) + canvas.width*this.width*0.3, canvas.height*(this.y + (this.height/2 - 0.0025)/2 - this.height*0.125));
		context.lineTo(canvas.width*(this.x + this.width*0.2) + canvas.width*this.width*0.3, canvas.height*(this.y + (this.height/2 - 0.0025)/2 + this.height*0.13));
		context.moveTo(canvas.width*(this.x + this.width*0.2), canvas.height*(this.y + this.height/2 + 0.0025 + (this.height/2 - 0.0025)/2 - this.height*0.07) + (canvas.height*this.height*0.15)/2);
		context.lineTo(canvas.width*(this.x + this.width*0.2) + canvas.width*this.width*0.6, canvas.height*(this.y + this.height/2 + 0.0025 + (this.height/2 - 0.0025)/2 - this.height*0.07) + (canvas.height*this.height*0.15)/2);
		context.stroke();
		context.closePath();

		context.fillStyle = 'rgba(230, 230, 230, 1)';
		context.strokeStyle = 'rgba(5, 5, 5, 1)';
		context.lineWidth = 2;
		for (var i=0; i<window[this.stat]; i++) {
			context.beginPath();
			context.rect(canvas.width*(this.displayX + i*(this.segmentGap + this.segmentWidth)), canvas.height*this.displayY, canvas.width*this.segmentWidth, canvas.height*this.segmentHeight);
			context.fill();
			context.stroke();
			context.closePath();
		}
	}

	onClick(x, y) {
		if (x >= canvas.width*this.x && x <= canvas.width*(this.x + this.width) && y >= canvas.height*this.y && y <= ) {

		}
	}
}

var buttons = [];
buttons.push(new Slider('Mutation Rate', 0.45, 0.35, 0.1, 0.004, 0.003));
buttons.push(new PointDisplay('Metabolism', 0.45, 0.45, 0.015, 0.04, 0.004, 'metabolism'));


function render(canvas, context) {
	context.clearRect(0, 0, canvas.width, canvas.height);

	context.fillStyle = 'rgba(80, 80, 80, 1)';
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
	for (var i in buttons) {
		var button = buttons[i];
		if (event.clientX + window.scrollX >= button.x*window.innerWidth - ((button.type == 'slider') ? 2*button.size*canvas.width : 0) && event.clientX + window.scrollX <= button.x*canvas.width + button.width*canvas.width + ((button.type == 'slider') ? 2*button.size*canvas.width : 0) && event.clientY + window.scrollY >= button.y*canvas.height - ((button.type == 'slider') ? 2*button.size*canvas.width : 0) && event.clientY + window.scrollY <= button.y*canvas.height + button.height*canvas.height + ((button.type == 'slider') ? 2*button.size*canvas.width : 0)) {
			if (button.type == 'slider') {
				button.value = Math.min(Math.max((event.clientX + window.scrollX - button.x*canvas.width)/(button.width*canvas.width), 0), 1);
				dragging = i;
			} else {
				button.onClick(event.clientX, event.clientY);
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