var express = require('express');
var http = require('http');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

var port = 5000;
var ticks = 2;


var species = [];
var client_ids = [];


var sim_width = 1;
var sim_height = 1;


class Species{
    constructor(id, mutation_rate, survivability) {
        this.id = id;
        this.mutation_rate = mutation_rate;
        this.survivability = survivability;
        this.agents = [];
    }

    populate(number, position) {
        for (var i = 0; i < number; i++) {
            this.agents.push(new Agent(this, position.slice()));
        }
    }

    to_string() {
        var result = "";
        for (var i in this.agents) {
            result += this.agents[i].to_string();
        }
        return result;
    }
}


class Agent{
    constructor(species, position) {
        this.species = species;
        this.rand_max = 10000;
        this.fight_variation = 0.2;
        this.collision_radius = 10;
        this.speed = 0.1;
        this.direction = this.random_direction();
        this.fitness = this.random_value(this.rand_max);
        this.position = position.slice();
        this.alive = true;
    }

    random_direction() {
        var random_angle = Math.random() * Math.PI * 2;
        var x = Math.cos(random_angle);
        var y = Math.sin(random_angle);
        return [x, y];
    }

    random_value(max) {
        return (Math.floor(Math.random() * Math.floor(max)));
    }

    is_immune() {
        return (this.fitness == (this.rand_max - 1));
    }

    is_colliding(other) {
        var dx = Math.abs(this.position[0] - other.position[0]);
        var dy = Math.abs(this.position[1] - other.position[1]);
        var dist2 = Math.pow(dx, 2) + Math.pow(dy, 2);
        return (dist2 < Math.pos(this.collision_radius, 2));
    }

    fight(other) {
        var score = this.species.survivability + Math.random() * this.fight_variation;
        var other_score = other.species.survivability + Math.random() * this.fight_variation;
        if (score >= other_score) {
            other.die();
        } else {
            this.die();
        }
    }

    die() {
        this.alive = false;
    }

    update(dt) {
        this.position[0] += dt * this.direction[0];
        this.position[1] += dt * this.direction[1];
    }

    to_string() {
        var x = Math.floor(this.position[0] * 100000) / 100000;
        var y = Math.floor(this.position[1] * 100000) / 100000;
        return this.species.id + "," + this.species.survivability + "," + x + "," + y + ";";
    }
}


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
    client_ids.push(socket.id);
	console.log('New Connection');
   	socket.on('new_species', function(id, mutation_rate, survivability) {
		try {
		    var new_species = new Species(id, mutation_rate, survivability);
		    species.push(new_species);
		    new_species.populate(10, [0, 0]);
		} catch (e) {
			console.log(e);
		}
   	});
});

var mip = new Species("Mip", 0.5, 0.4);
species.push(mip);
mip.populate(3, [0.5, 0.5]);

function packet() {
    var p = "";
    for (var i in species) {
        p += species[i].to_string();
    }
    return p;
}

setInterval(function() {
	for (var i in client_ids) {
	    io.to(client_ids[i]).emit("update", "packet()");
	    console.log(client_ids[i]);
	}
    for (var i in species) {
        console.log(species[i].to_string());
        for (var j in species[i].agents) {
            species[i].agents[j].update(0.1);
        }
    }
}, 1000/ticks);