var express = require('express');
var http = require('http');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

var port = 5000;
var ticks = 50;


var species = [];


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


setInterval(function() {
	//console.log("Number of species: " + species.length);
}, 1000/ticks);