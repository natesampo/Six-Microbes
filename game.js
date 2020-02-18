var socket = io();

var ticks = 60;
var host = false;
var pxRatio = window.devicePixelRatio || window.screen.availWidth/document.documentElement.clientWidth;

var dragging = -1;
var to_render = [];
var colors = [[220, 30, 40],
              [30, 120, 240],
              [50, 200, 90],
              [240, 130, 30],
              [160, 50, 200],
              [50, 160, 200],
              [125, 125, 125]].reverse();
var id_to_color = {};
var id_to_count = {};
var id_to_stats = {};
var id_to_immunity = {};
var species_cards = [];
var time_remaining = "5:00"
var maxStats = 5;
var statPoints = 12;

var Mutation = 0.5;
var Metabolism = 1;
var Toxicity = 1;
var Robustness = 1;
var Flagella = 1;

var cache = [];

var canvas = document.getElementById('canvas');
canvas.style.position = 'absolute';
canvas.style.top = 0;
canvas.style.left = 0;
canvas.width = window.innerWidth*pxRatio;
canvas.height = window.innerHeight*pxRatio;

function points_remaining() {
    return (statPoints - Metabolism - Toxicity - Robustness - Flagella);
}

function x_to_draw(x) {
    return (x * 9/16 * canvas.width);
}

function y_to_draw(y) {
    return (y * canvas.height);
}

function color_context(color_list, alpha) {
    return 'rgba(' + color_list[0] + ', ' + color_list[1] + ', ' + color_list[2] + ', ' + alpha + ')';
}

class TimeBoard {
    constructor() {}

    render(canvas, context) {
        var minutes = time_remaining.split(":")[0];
        var x = 0.74 * canvas.width;
        var y = 0.10 * canvas.height;
        var font_size = canvas.height/12;
        context.font = (font_size).toString() + 'px Arial Black';
        context.fillStyle = 'rgba(255, 255, 255, 1)';
        if (parseInt(minutes) <= 0) {
            context.fillStyle = 'rgba(255, 50, 50, 1)';
        }
        context.fillText(time_remaining, x, y);
    }
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
    }

    render(canvas, context) {
        var border_x = 0.03 * canvas.width;
        var border_y = 0.015 * canvas.height;
        var x = x_to_draw(1.0) + border_x;
        var y = border_y * 9;
        var height = 0.07 * canvas.height;
        y += (border_y + height) * species_cards.indexOf(this);
        var width = (canvas.width - x_to_draw(1.0)) - 2*border_x;

        context.fillStyle = 'rgba(0, 0, 0, 1)';
        context.fillRect(x, y, width, height);
        if (this.id in id_to_immunity) {
            context.lineWidth = 1;
            if (id_to_immunity[this.id]) {
                context.lineWidth = 1;
                context.strokeStyle = 'rgba(255, 255, 255, 1)';
                context.strokeRect(x, y, width, height);
                context.lineWidth = 8;
                context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                context.strokeRect(x, y, width, height);
            }
        }

        // Draw species name
        var font_size = canvas.height/25;
        context.font = (font_size).toString() + 'px Arial';
        context.fillStyle = color_context(id_to_color[this.id], 1);
        context.strokeStyle = 'rgba(0, 0, 0, 1)';
        var text_padding_x = 0.01 * canvas.width;
		context.fillText(this.id, x + text_padding_x, y + height/2 + font_size*3/8);

		// Draw population size
		var pop_number = 0;
		if (this.id in id_to_count) {
		    pop_number = id_to_count[this.id];
		}
		var population = "Population: " + pop_number.toString();
		var font_size = canvas.height/50;
		context.font = (font_size).toString() + 'px Arial';
        context.fillStyle = color_context(id_to_color[this.id], 1);
        var text_padding_x = 0.19 * canvas.width;
		context.fillText(population, x + text_padding_x, y + height/2 + font_size*3/8);

		// Draw stats
		var m = Math.floor(parseInt(id_to_stats[this.id]) / 1000);
		var f = Math.floor(parseInt(id_to_stats[this.id]) / 100) % 10;
		var t = Math.floor(parseInt(id_to_stats[this.id]) / 10) % 10;
		var r = Math.floor(parseInt(id_to_stats[this.id]) % 10);
		var metabolism = ["M", m, 0, 0];
		var flagella = ["F", f, 0, 1];
		var toxicity = ["T", t, 1, 0];
		var robustness = ["R", r, 1, 1];
		var x_origin = x + canvas.width * 0.29;
		var y_origin = y + canvas.height * 0.03;
		var x_spacing = canvas.width*0.04;
		var y_spacing = canvas.height * 0.025;
		var square_x_spacing = canvas.width/200;
		var square_width = square_x_spacing*0.8;
		var square_height = canvas.height/100;
		var stat_list = [metabolism, flagella, toxicity, robustness];
		for (var i in stat_list) {
		    var info = stat_list[i];
		    var text = info[0];
		    var value = parseInt(info[1]);
		    var my_x_spacing = parseInt(info[2]) * x_spacing;
		    var my_y_spacing = parseInt(info[3]) * y_spacing;
		    var my_x = x_origin + my_x_spacing;
		    var my_y = y_origin + my_y_spacing;
            context.fillText(text, my_x, my_y);
            my_x += square_x_spacing * 2.2;
            my_y -= y_spacing/2;
            for (var i = 0; i < value; i++) {
                context.fillRect(my_x, my_y, square_width, square_height);
                my_x += square_x_spacing;
            }
		}
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

class AgentRender {
	constructor(agent_string) {
	    var split = agent_string.split(",");

	    this.id = cache[split[0]];
	    if (!(this.id in id_to_count)) {
	        id_to_count[this.id] = 1;
	    } else {
	        id_to_count[this.id] += 1;
	    }
	    if (!(this.id in id_to_color)) {
	        id_to_color[this.id] = colors.pop();
	        species_cards.push(new SpeciesCard(this.id));
	    }
	    this.color = id_to_color[this.id];
	    this.pos = [parseFloat(split[1]), parseFloat(split[2])];
	    this.immune = parseInt(split[3]);
	    if (!(this.id in id_to_immunity)) {
	        id_to_immunity[this.id] = this.immune;
	    } else {
	        id_to_immunity[this.id] = (this.immune || id_to_immunity[this.id]);
	    }
	    var stat_string = split[4];
	    id_to_stats[this.id] = stat_string;

	    this.metabolism = Math.floor(parseInt(id_to_stats[this.id]) / 1000);
		this.flagella = Math.floor(parseInt(id_to_stats[this.id]) / 100) % 10;
		this.toxicity = Math.floor(parseInt(id_to_stats[this.id]) / 10) % 10;
		this.robustness = Math.floor(parseInt(id_to_stats[this.id]) % 10);

		this.diameter = 0.006 + 0.004 * this.robustness/5;
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
	constructor(id, x, y, width, height, size, stat) {
		this.id = id;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.size = size;
		this.stat = stat;
		this.type = 'slider';
	}

	render(canvas, context) {
		context.fillStyle = 'rgba(5, 5, 5, 1)';
		context.fillRect(this.x*canvas.width, this.y*canvas.height, this.width*canvas.width, this.height*canvas.height);

		context.fillStyle = 'rgba(230, 230, 230, 1)';
		context.strokeStyle = 'rgba(5, 5, 5, 1)';
		context.lineWidth = 2;
		context.beginPath();
		context.arc(this.x*canvas.width + window[this.stat]*this.width*canvas.width + canvas.width*this.size/2, this.y*canvas.height + this.height*canvas.height/2, 2*this.size*canvas.width, 0, Math.PI*2);
		context.fill();
		context.stroke();
		context.closePath();

		context.font = (canvas.width/90).toString() + 'px Arial';
		context.strokeText(this.id, this.x*canvas.width + this.width*canvas.width/2 - context.measureText(this.id).width/2, this.y*canvas.height + this.size*canvas.height*12.2);
		context.fillText(this.id, this.x*canvas.width + this.width*canvas.width/2 - context.measureText(this.id).width/2, this.y*canvas.height + this.size*canvas.height*12.2);
	}
}

class PointIndicator {
	constructor(x, y) {
		this.x = x * canvas.width;
		this.y = y * canvas.height;
		this.width = 1;
		this.height = 1;
		this.type = "pointIndicator";
	}

	onClick(x, y) {}

	render(canvas, context) {
	    var text = "Points remaining: " + points_remaining();
		context.font = (canvas.width/100).toString() + 'px Arial';
		context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
		context.fillStyle = 'rgba(255, 255, 255, 0.8)';
		var xoff = context.measureText(text).width/2
		context.strokeText(text, this.x - xoff, this.y);
		context.fillText(text, this.x - xoff, this.y);
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
		if (window[this.stat] == maxStats || Metabolism + Toxicity + Robustness + Flagella >= statPoints) {
			context.fillStyle = 'rgba(130, 130, 130, 1)';
		} else {
			context.fillStyle = 'rgba(230, 230, 230, 1)';
		}
		context.strokeStyle = 'rgba(5, 5, 5, 1)';
		context.lineWidth = 2;
		context.beginPath();
		context.rect(canvas.width*this.x, canvas.height*this.y, canvas.width*this.width, canvas.height*(this.height/2 - 0.0025));
		context.fill();
		context.stroke();
		context.closePath();

		if (window[this.stat] == 1) {
			context.fillStyle = 'rgba(130, 130, 130, 1)';
		} else {
			context.fillStyle = 'rgba(230, 230, 230, 1)';
		}
		context.beginPath();
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

		context.font = (canvas.width/90).toString() + 'px Arial';
		context.strokeText(this.id, canvas.width*(this.x - 0.005) - context.measureText(this.stat).width, canvas.height*this.y + canvas.width/77);
		context.fillText(this.id, canvas.width*(this.x - 0.005) - context.measureText(this.stat).width, canvas.height*this.y + canvas.width/77);
	}

	onClick(x, y) {
		if (x >= canvas.width*this.x && x <= canvas.width*(this.x + this.width) && y >= canvas.height*this.y && y <= canvas.height*(this.y + this.height/2 - 0.0025)) {
			if (Metabolism + Toxicity + Robustness + Flagella < statPoints) {
				window[this.stat] = Math.min(window[this.stat]+1, maxStats);
			}
		} else if (x >= canvas.width*this.x && x <= canvas.width*(this.x + this.width) && y >= canvas.height*(this.y + this.height/2 + 0.0025) && y <= canvas.height*(this.y + this.height/2 + 0.0025 + this.height/2 - 0.0025)) {
			window[this.stat] = Math.max(window[this.stat]-1, 1);
		}
	}
}

class Button {
	constructor(id, x, y, width, height, onClick) {
		this.id = id;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.onClick = onClick;
		this.type = 'button';
	}

	render(canvas, context) {
		var labelX = 0.075;
		var labelMargin = canvas.width/350;
		var r = 10;
		var blinkerHeight = this.height/2;

		context.fillStyle = 'rgba(255, 255, 255, 1)';
		context.font = (canvas.width/90).toString() + 'px Arial';
		context.fillText('Name', this.x + this.width*labelX - r, this.y + canvas.width/360);

		context.strokeStyle = 'rgba(255, 255, 255, 1)';
		context.lineWidth = 1;
		context.beginPath();
		context.moveTo(this.x + r, this.y);
		context.lineTo(this.x + this.width*labelX - r - labelMargin, this.y);
		context.moveTo(this.x + this.width*labelX - r + context.measureText('Name').width + labelMargin, this.y);
		context.lineTo(this.x + this.width - r, this.y);
		context.quadraticCurveTo(this.x + width, this.y, this.x + this.width, this.y + r);
		context.lineTo(this.x + this.width, this.y + height - r);
		context.quadraticCurveTo(this.x + this.width, this.y + this.height, this.x + this.width - r, this.y + this.height);
		context.lineTo(this.x + r, this.y + this.height);
		context.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - r);
		context.lineTo(this.x, this.y + r);
		context.quadraticCurveTo(this.x, this.y, this.x + r, this.y);
		context.stroke();
		context.closePath();
	}
}

var buttons = [];
buttons.push(new Slider('Mutation Rate', 0.45, 0.35, 0.1, 0.004, 0.003, 'Mutation'));
buttons.push(new PointDisplay('Metabolism', 0.458, 0.45, 0.015, 0.04, 0.004, 'Metabolism'));
buttons.push(new PointDisplay('Toxicity', 0.458, 0.505, 0.015, 0.04, 0.004, 'Toxicity'));
buttons.push(new PointDisplay('Robustness', 0.458, 0.56, 0.015, 0.04, 0.004, 'Robustness'));
buttons.push(new PointDisplay('Flagella', 0.458, 0.615, 0.015, 0.04, 0.004, 'Flagella'));
buttons.push(new PointIndicator(0.5, 0.71));
//buttons.push(new Button('Submit', 0.45, 0.7, 0.1, 0.04, function() {}));


function render(canvas, context) {
	context.clearRect(0, 0, canvas.width, canvas.height);

    if (host) {
        context.fillStyle = 'rgba(40, 40, 40, 1)';
	    context.fillRect(0, 0, canvas.width, canvas.height);
        species_cards.sort(function(a, b) {
           return id_to_count[b.id] - id_to_count[a.id];
        });
    	for (var i in to_render) {
	        to_render[i].render(canvas, context);
	    }
    } else {
    	context.fillStyle = 'rgba(80, 80, 80, 1)';
	    context.fillRect(0, 0, canvas.width, canvas.height);
    	for (var i in buttons) {
		    buttons[i].render(canvas, context);
        }
    }
}

socket.on("cache", function(packet) {
	cache = packet;
})

socket.on("update", function(packet) {
    to_render = species_cards.slice();
    to_render.push(new TimeBoard());
    id_to_count = {};
    id_to_immunity = {};
    try {
        var pieces = packet.split(";");
        for (let i in pieces) {
            var info = pieces[i].split(",");
            if (info[0] == "S") {
                to_render.push(new SugarRender(pieces[i]));
            } else if (info[0] == "T") {
                time_remaining = info[1];
            } else if (info[0].length > 0) {
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
    //become_host();
	for (var i in buttons) {
		var button = buttons[i];
		if (event.clientX + window.scrollX >= button.x*window.innerWidth - ((button.type == 'slider') ? 2*button.size*canvas.width : 0) && event.clientX + window.scrollX <= button.x*canvas.width + button.width*canvas.width + ((button.type == 'slider') ? 2*button.size*canvas.width : 0) && event.clientY + window.scrollY >= button.y*canvas.height - ((button.type == 'slider') ? 2*button.size*canvas.width : 0) && event.clientY + window.scrollY <= button.y*canvas.height + button.height*canvas.height + ((button.type == 'slider') ? 2*button.size*canvas.width : 0)) {
			if (button.type == 'slider') {
				window[button.stat] = Math.min(Math.max((event.clientX + window.scrollX - button.x*canvas.width)/(button.width*canvas.width), 0), 1);
				dragging = i;
			} else if (button.type = 'pointDisplay') {
				button.onClick(event.clientX, event.clientY);
			}
			break;
		}
	}
});

document.addEventListener('mousemove', function(event) {
	if (dragging != -1) {
		var button = buttons[dragging];
		window[button.stat] = Math.min(Math.max((event.clientX + window.scrollX - button.x*canvas.width)/(button.width*canvas.width), 0), 1);
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