var socket = io();

var ticks = 60;
var host = false;
var pxRatio = window.devicePixelRatio || window.screen.availWidth/document.documentElement.clientWidth;

var dragging = -1;
var to_render = [];
var colors = [[220, 30, 40],
              [85, 94, 219],
              [189, 189, 52],
              [114, 189, 196],
              [255, 146, 68],
              [82, 206, 111],
              [219, 37, 167],
              [158, 158, 158],
              [89, 165, 219],
              [165, 124, 79],
              [160, 59, 219]];
for (var i = 0; i < 20; i++) {
    colors.push([229, 229, 299]);
}
colors = colors.reverse();
var id_to_color = {};
var id_to_count = {};
var id_to_stats = {};
var id_to_immunity = {};
var species_cards = [];
var time_remaining = "5:00"
var maxStats = 5;
var statPoints = 12;

var Name = '';
var Mutation = 0.5;
var Metabolism = 1;
var Toxicity = 1;
var Robustness = 1;
var Flagella = 1;

var blinking = 0;
var maxNameLength = 16;
var shift = false;

var done = false;

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
        if (this.id in id_to_color) {
            context.fillStyle = color_context(id_to_color[this.id], 1);
        } else {
            context.fillStyle = color_context([100, 100, 100], 1);
        }
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
	    var m = Math.floor(parseInt(id_to_stats[this.id]) / 10000) % 10;
		var f = Math.floor(parseInt(id_to_stats[this.id]) / 1000) % 10;
		var t = Math.floor(parseInt(id_to_stats[this.id]) / 100) % 10;
		var r = Math.floor(parseInt(id_to_stats[this.id]) / 10) % 10;
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

	    this.metabolism = Math.floor(parseInt(id_to_stats[this.id]) / 10000) % 10;
		this.flagella = Math.floor(parseInt(id_to_stats[this.id]) / 1000) % 10;
		this.toxicity = Math.floor(parseInt(id_to_stats[this.id]) / 100) % 10;
		this.robustness = Math.floor(parseInt(id_to_stats[this.id]) / 10) % 10;
		this.mutant = Math.floor(parseInt(id_to_stats[this.id]) % 10);

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

		var render_color = this.color.slice();
		if (this.mutant == 1) {
		    render_color[0] *= 0.6;
		    render_color[1] *= 0.6;
		    render_color[2] *= 0.6;
		}

		context.fillStyle = color_context(render_color, 1);
		context.beginPath();
		context.ellipse(x_to_draw(x), y_to_draw(y), width, height, 0, 0, 2*Math.PI);
		context.fill();
		context.closePath();

        context.fillStyle = color_context([(render_color[0]+50)*1.2, (render_color[1]+50)*1.2, (render_color[2]+50)*1.2], 1);
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
		//context.strokeText(this.id, this.x*canvas.width + this.width*canvas.width/2 - context.measureText(this.id).width/2, this.y*canvas.height + this.size*canvas.height*12.2);
		context.fillText(this.id, this.x*canvas.width + this.width*canvas.width/2 - context.measureText(this.id).width/2, this.y*canvas.height + this.size*canvas.height*12.2);
	}
}

class PointIndicator {
	constructor(x, y) {
		this.x = x;
		this.y = y;
		this.width = 0;
		this.height = 0;
		this.type = "pointIndicator";
	}

	onClick(x, y) {}

	render(canvas, context) {
	    var text = "Points remaining: " + points_remaining();
		context.font = (canvas.width/100).toString() + 'px Arial';
		context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
		context.fillStyle = 'rgba(255, 255, 255, 0.8)';
		var xoff = context.measureText(text).width/2
		//context.strokeText(text, this.x - xoff, this.y);
		context.fillText(text, canvas.width*this.x - xoff, canvas.height*this.y);
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
		//context.strokeText(this.id, canvas.width*(this.x - 0.005) - context.measureText(this.stat).width, canvas.height*this.y + canvas.width/77);
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
	constructor(id, x, y, width, height, r, onClick) {
		this.id = id;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.r = r;
		this.onClick = onClick;
		this.type = 'button';
	}

	render(canvas, context) {
		var labelX = 0.075;
		var labelMargin = 0.003;
		var blinkerHeight = 0.5*this.height;

		context.fillStyle = 'rgba(255, 255, 255, 1)';
		context.font = (canvas.width/90).toString() + 'px Arial';

		context.strokeStyle = 'rgba(5, 5, 5, 1)';
		context.lineWidth = 4;
		context.beginPath();
		context.moveTo(canvas.width*(this.x + this.r), canvas.height*this.y);
		if (this.id == 'Name') {
			context.lineWidth = 2;
			context.lineTo(canvas.width*(this.x + this.width*labelX - this.r - labelMargin), canvas.height*this.y);
			context.moveTo(canvas.width*(this.x + this.width*labelX - this.r + context.measureText('Name').width/canvas.width + labelMargin), canvas.height*this.y);
			//context.strokeText('Name', canvas.width*(this.x + this.width*labelX - this.r), canvas.height*(this.y + 1/250));
			context.fillText('Name', canvas.width*(this.x + this.width*labelX - this.r), canvas.height*(this.y + 1/250));
			context.strokeStyle = 'rgba(255, 255, 255, 1)';
		}
		context.lineTo(canvas.width*(this.x + this.width - this.r), canvas.height*this.y);
		context.quadraticCurveTo(canvas.width*(this.x + this.width), canvas.height*this.y, canvas.width*(this.x + this.width), canvas.height*(this.y + this.r));
		context.lineTo(canvas.width*(this.x + this.width), canvas.height*(this.y + this.height - this.r));
		context.quadraticCurveTo(canvas.width*(this.x + this.width), canvas.height*(this.y + this.height), canvas.width*(this.x + this.width - this.r), canvas.height*(this.y + this.height));
		context.lineTo(canvas.width*(this.x + this.r), canvas.height*(this.y + this.height));
		context.quadraticCurveTo(canvas.width*this.x, canvas.height*(this.y + this.height), canvas.width*this.x, canvas.height*(this.y + this.height - this.r));
		context.lineTo(canvas.width*this.x, canvas.height*(this.y + this.r));
		context.quadraticCurveTo(canvas.width*this.x, canvas.height*this.y, canvas.width*(this.x + this.r), canvas.height*this.y);
		context.stroke();
		if (this.id != 'Name') {
			context.fill();

			context.fillStyle = 'rgba(5, 5, 5, 1)';
			context.fillText(this.id, canvas.width*(this.x + this.width/2) - context.measureText(this.id).width/2, canvas.height*this.y + canvas.height/40);
		}
		context.closePath();

		if (this.id == 'Name') {
			context.lineWidth = 2;
			//context.strokeStyle = 'rgba(5, 5, 5, 1)';
			//context.strokeText(Name, canvas.width*this.x + canvas.width/250, canvas.height*this.y + canvas.height/30);
			context.fillText(Name, canvas.width*this.x + canvas.width/190, canvas.height*this.y + canvas.height/30);

			if (blinking < ticks/2) {
				context.fillRect(canvas.width*(this.x + this.r + 6/canvas.width) + context.measureText(Name).width, canvas.height*(this.y + (this.height - blinkerHeight)/2), 2, canvas.height*blinkerHeight);
			}
		}
	}
}

function start_game() {
    socket.emit("start");
}

function submit_microbe() {
    socket.emit("new_species", Name, Mutation*0.8 + 0.1, Metabolism/5, Flagella/5, Toxicity/5, Robustness/5);
}

var buttons = [];
buttons.push(new Slider('Mutation Rate', 0.45, 0.35, 0.1, 0.004, 0.003, 'Mutation'));
buttons.push(new PointDisplay('Metabolism', 0.458, 0.45, 0.015, 0.04, 0.004, 'Metabolism'));
buttons.push(new PointDisplay('Toxicity', 0.458, 0.505, 0.015, 0.04, 0.004, 'Toxicity'));
buttons.push(new PointDisplay('Robustness', 0.458, 0.56, 0.015, 0.04, 0.004, 'Robustness'));
buttons.push(new PointDisplay('Flagella', 0.458, 0.615, 0.015, 0.04, 0.004, 'Flagella'));
buttons.push(new Button('Submit', 0.45, 0.75, 0.1, 0.04, 0.003, function(x, y) {submit_microbe(); done = true;}));
buttons.push(new Button('Name', 0.4, 0.2, 0.2, 0.05, 0.003, function(x, y) {}));
buttons.push(new PointIndicator(0.5, 0.71));

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
    	if (done) {
    		context.fillStyle = 'rgba(80, 80, 80, 1)';
			context.fillRect(0, 0, canvas.width, canvas.height);
			context.fillStyle = 'rgba(255, 255, 255, 1)';
			context.font = (canvas.width/20).toString() + 'px Arial';
			context.fillText('Thank', canvas.width/2 - context.measureText('THank').width/2, canvas.height/2);
    	} else {
	    	context.fillStyle = 'rgba(80, 80, 80, 1)';
		    context.fillRect(0, 0, canvas.width, canvas.height);
	    	for (var i in buttons) {
			    buttons[i].render(canvas, context);
	        }
	    }
	}
}

socket.on("cache", function(packet) {
	console.log(packet);
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

	blinking = (blinking+0.6)%ticks;

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
				window[button.stat] = Math.min(Math.max((event.clientX + window.scrollX - button.x*canvas.width)/(button.width*canvas.width), 0), 1);
				dragging = i;
			} else {
				button.onClick(event.clientX + window.scrollX, event.clientY + window.scrollY);
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

document.addEventListener('keydown', function(event) {
	if (Name.length < maxNameLength) {
		Name = Name + keycode(event.keyCode, shift);
	}

	switch (event.keyCode) {
		case 8: // Backspace
			if (Name.length > 0) {
				Name = Name.slice(0, -1);
				event.stopPropagation();
				event.returnValue = false;
			}
			break;
		case 16: // Shift
			shift = true;
			break;
	}
});

document.addEventListener('keyup', function(event) {
	switch (event.keyCode) {
		case 16: // Shift
			shift = false;
			break;
	}
});

function keycode(keycode, shift) {
  switch (keycode) {
    case 32: // Space
      return ' ';
    case 48:
      return ((shift) ? ')' : '0');
      break;
    case 49:
      return ((shift) ? '!' : '1');
      break;
    case 50:
      return ((shift) ? '@' : '2');
      break;
    case 51:
      return ((shift) ? '#' : '3');
      break;
    case 52:
      return ((shift) ? '$' : '4');
      break;
    case 53:
      return ((shift) ? '%' : '5');
      break;
    case 54:
      return ((shift) ? '^' : '6');
      break;
    case 55:
      return ((shift) ? '&' : '7');
      break;
    case 56:
      return ((shift) ? '*' : '8');
      break;
    case 57:
      return ((shift) ? '(' : '9');
      break;
    case 65: // A
      return ((shift) ? 'A' : 'a');
      break;
    case 66:
      return ((shift) ? 'B' : 'b');
      break;
    case 67:
      return ((shift) ? 'C' : 'c');
      break;
    case 68:
      return ((shift) ? 'D' : 'd');
      break;
    case 69:
      return ((shift) ? 'E' : 'e');
      break;
    case 70:
      return ((shift) ? 'F' : 'f');
      break;
    case 71:
      return ((shift) ? 'G' : 'g');
      break;
    case 72:
      return ((shift) ? 'H' : 'h');
      break;
    case 73:
      return ((shift) ? 'I' : 'i');
      break;
    case 74:
      return ((shift) ? 'J' : 'j');
      break;
    case 75:
      return ((shift) ? 'K' : 'k');
      break;
    case 76:
      return ((shift) ? 'L' : 'l');
      break;
    case 77:
      return ((shift) ? 'M' : 'm');
      break;
    case 78:
      return ((shift) ? 'N' : 'n');
      break;
    case 79:
      return ((shift) ? 'O' : 'o');
      break;
    case 80:
      return ((shift) ? 'P' : 'p');
      break;
    case 81:
      return ((shift) ? 'Q' : 'q');
      break;
    case 82:
      return ((shift) ? 'R' : 'r');
      break;
    case 83:
      return ((shift) ? 'S' : 's');
      break;
    case 84:
      return ((shift) ? 'T' : 't');
      break;
    case 85:
      return ((shift) ? 'U' : 'u');
      break;
    case 86:
      return ((shift) ? 'V' : 'v');
      break;
    case 87:
      return ((shift) ? 'W' : 'w');
      break;
    case 88:
      return ((shift) ? 'X' : 'x');
      break;
    case 89:
      return ((shift) ? 'Y' : 'y');
      break;
    case 90:
      return ((shift) ? 'Z' : 'z');
      break;
    case 186:
      return ((shift) ? ':' : ';');
      break;
    case 187:
      return ((shift) ? '+' : '=');
      break;
    case 188:
      return ((shift) ? '<' : ',');
      break;
    case 189:
      return ((shift) ? '_' : '-');
      break;
    case 190:
      return ((shift) ? '>' : '.');
      break;
    case 191:
      return ((shift) ? '?' : '/');
      break;
    case 192:
      return ((shift) ? '~' : '`');
      break;
    case 219:
      return ((shift) ? '{' : '[');
      break;
    case 220:
      return ((shift) ? '|' : '\\');
      break;
    case 221:
      return ((shift) ? '}' : ']');
      break;
    case 222:
      return ((shift) ? '"' : "'");
      break;
    case 96: // NUMPAD begins here
      return '0';
      break;
    case 97:
      return '1';
      break;
    case 98:
      return '2';
      break;
    case 99:
      return '3';
      break;
    case 100:
      return '4';
      break;
    case 101:
      return '5';
      break;
    case 102:
      return '6';
      break;
    case 103:
      return '7';
      break;
    case 104:
      return '8';
      break;
    case 105:
      return '9';
      break;
    case 106:
      return '*';
      break;
    case 107:
      return '+';
      break;
    case 109:
      return '-';
      break;
    case 110:
      return '.';
      break;
    case 111:
      return '/';
      break;
    default:
      return '';
  }
}