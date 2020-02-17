var express = require('express');
var http = require('http');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

var port = 5000;
var ticks = 40;
var date = new Date();
var time = date.getTime();
var simulation_age = 0;

var species = [];
var client_ids = [];
var host_list = [];

var sim_width = 1;
var sim_height = 1;


class SugarContainer {
    constructor(number) {
        this.sugar = [];
        this.populate(number);
    }

    add(position, energy) {
        this.sugar.push(new Sugar(position, energy));
    }

    populate(number) {
        for (var i = 0; i < number; i++) {
            var position = [Math.random(), Math.random()];
            this.sugar.push(new Sugar(position, 1));
        }
    }

    bring_out_your_dead() {
        this.sugar = this.sugar.filter(function(item) {
           return item.alive;
        });
    }

    to_string() {
        var result = "";
        for (var i in this.sugar) {
            result += this.sugar[i].to_string();
        }
        return result;
    }
}

class Sugar {
    constructor(position, energy) {
        this.position = position;
        this.energy = energy;
        this.alive = true;
        this.species = null;
    }

    to_string() {
        return "Sugar," + this.position[0] + "," + this.position[1] + ";";
    }
}


var sugar = new SugarContainer(200);


class Species{
    constructor(id, mutation_rate, metabolism, flagella, toxicity, robustness) {
        this.id = id;
        this.mutation_rate = mutation_rate;
        this.metabolism = metabolism;
        this.flagella = flagella;
        this.toxicity = toxicity;
        this.robustness = robustness;
        this.fitness_heuristic = toxicity + robustness;
        this.agents = [];
    }

    populate(number, position) {
        // Add 'number' agents at position 'position'
        for (var i = 0; i < number; i++) {
            this.agents.push(new Agent(this, position.slice()));
        }
    }

    to_string() {
        // Encapsulate important info from each agent into a string
        var result = "";
        for (var i in this.agents) {
            result += this.agents[i].to_string();
        }
        return result;
    }

    bring_out_your_dead() {
        // Clear the species of dead agents
        this.agents = this.agents.filter(function(agent) {
            return agent.alive;
        });
    }

    check_collisions() {
        // Make agents fight if they are close to each other
        for (var i in species) {
            if (species[i] == this) { continue; }
            for (var j in this.agents) {
                for (var k in species[i].agents) {
                    if (this.agents[j].is_colliding(species[i].agents[k])) {
                        this.agents[j].fight(species[i].agents[k]);
                    }
                }
            }
        }
    }
}


class Agent{
    constructor(species, position) {
        this.species = species;
        this.rand_max = 100;
        this.collision_radius = 0.01;
        this.speed = 0.02 * Math.random();  // TODO make flagella stat affect speed and/or perception distance
        this.direction = this.random_direction();
        this.fitness = this.random_value(this.rand_max);
        this.position = position.slice();
        this.alive = true;
        this.energy = 1;

        this.target = null;
        this.target_dist = null;
        this.perception_distance = 0.04;

        this.age = 0;
    }

    random_direction() {
        // Return a random (x, y) unit vector
        var random_angle = Math.random() * Math.PI * 2;
        var x = Math.cos(random_angle);
        var y = Math.sin(random_angle);
        return [x, y];
    }

    reproduce() {
        // Reproduce as many times as possible while keeping energy above a threshold
        while (this.energy >= 2) {
            this.energy -= 1;
            this.species.populate(1, this.position.slice());
        }
    }

    random_value(max) {
        // Return a random integer between 0 and max-1
        return (Math.floor(Math.random() * Math.floor(max)));
    }

    is_immune() {
        // Returns true if the cell has antibiotic resistance
        return (this.fitness == (this.rand_max - 1));
    }

    is_colliding(other) {
        if (!this.alive || !other.alive) { return; }

        var dx = Math.abs(this.position[0] - other.position[0]);
        var dy = Math.abs(this.position[1] - other.position[1]);
        var dist2 = Math.pow(dx, 2) + Math.pow(dy, 2);
        var result = (dist2 < Math.pow(this.collision_radius, 2))

        if (this.target_dist != null) {
            var dx = this.target.position[0] - this.position[0];
            var dy = this.target.position[1] - this.position[1];
            this.target_dist = Math.pow(dx, 2) + Math.pow(dy, 2);
        }
        if (this.target_dist == null || this.target_dist > dist2) {
            if (simulation_age > 1) {
                this.target = other;
                this.target_dist = dist2;
            }
        }

        return result;
    }

    eat_sugar() {
        if (!this.alive) { return; }
        for (var i in sugar.sugar) {
            if (this.is_colliding(sugar.sugar[i])) {
                this.energy += sugar.sugar[i].energy * this.species.metabolism;
                sugar.sugar[i].energy = 0;
                sugar.sugar[i].alive = 0;
            }
        }
    }

    fight(other) {
        var my_attack = this.species.toxicity * Math.random();
        var other_defense = other.species.robustness * Math.random();
        if (my_attack >= other_defense) {
            other.die();
        }

        var my_defense = this.species.robustness * Math.random();
        var other_attack = other.species.toxicity * Math.random();
        if (other_attack >= my_defense) {
            this.die();
        }
    }

    die() {
        this.alive = false;
        sugar.add(this.position.slice(), this.energy/this.species.metabolism);
    }

    update_target() {
        if (this.target != null && this.target.alive && this.target_dist < Math.pow(this.perception_distance, 2)) {
            var dx = this.target.position[0] - this.position[0];
            var dy = this.target.position[1] - this.position[1];
            var mag = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
            this.direction[0] = dx/mag;
            this.direction[1] = dy/mag;

            if (this.target.species != null) {
                if (this.species.fitness_heuristic < this.target.species.fitness_heuristic) {
                    this.direction[0] = -dx/mag;
                    this.direction[1] = -dy/mag;
                }
            }
        }
    }

    update(dt) {
        this.position[0] += dt * this.direction[0] * this.speed;
        this.position[1] += dt * this.direction[1] * this.speed;
        this.check_bounce();
        this.eat_sugar();
        this.reproduce();
        this.update_target();
        this.age += dt;
    }

    to_string() {
        var x = Math.floor(this.position[0] * 10000) / 10000;
        var y = Math.floor(this.position[1] * 10000) / 10000;
        var immune = 0;
        if (this.is_immune()) {
            immune = 1;
        }
        var result = this.species.id + "," + x + "," + y + "," + immune + ";";
        return result;
    }

    check_bounce() {

        if (this.position[0] < 0) {
            this.position[0] = 0;
            this.direction[0] *= -1;
        } else if (this.position[0] > 1) {
            this.position[0] = 1;
            this.direction[0] *= -1;
        }

        if (this.position[1] < 0) {
            this.position[1] = 0;
            this.direction[1] *= -1;
        } else if (this.position[1] > 1) {
            this.position[1] = 1;
            this.direction[1] *= -1;
        }
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
   	socket.on('new_species', function(id, mutation_rate, metabolism, flagella, toxicity, robustness) {
		try {
		    var new_species = new Species(id, mutation_rate, metabolism, flagella, toxicity, robustness);
		    species.push(new_species);
		    new_species.populate(10, [0, 0]);
		} catch (e) {
			console.log(e);
		}
   	});
   	socket.on('become_host', function() {
		try {
			host_list.push(socket.id);
		} catch (e) {
			console.log(e);
		}
   	});
});

var mip = new Species("Mip", 0.5, 0.5, 0.5, 0.5, 0.5);
var newp = new Species("Newp", 0.5, 1.0, 0.5, 0.3, 0.3);
species.push(mip);
species.push(newp);
mip.populate(30, [0.3, 0.3]);
newp.populate(30, [0.7, 0.7]);

function packet() {
    var p = "";
    p += sugar.to_string();
    for (var i in species) {
        p += species[i].to_string();
    }
    return p;
}

setInterval(function() {
	var date = new Date();
	var newTime = date.getTime();
	var dt = newTime - time;
	simulation_age += dt/1000;

	for (var i in host_list) {
	    io.to(host_list[i]).emit("update", packet());
	}
    for (var i in species) {
        for (var j in species[i].agents) {
            species[i].agents[j].update(dt/1000);
        }
        species[i].check_collisions();
        species[i].bring_out_your_dead();
    }
    sugar.bring_out_your_dead();
    time = newTime;
}, 1000/ticks);