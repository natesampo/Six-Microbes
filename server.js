var express = require('express');
var http = require('http');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

var port = 5000;
var simulation_ticks = 60;
var packet_ticks = 20;
var date = new Date();
var time = date.getTime();
var simulation_age = 0;

var species = [];
var client_ids = [];
var host = '';

var sim_width = 1;
var sim_height = 1;
var sim_speed = 0.6;
var started = false;

var spawn_positions = [[0.2, 0.2],
                       [0.8, 0.8],
                       [0.8, 0.2],
                       [0.2, 0.8],
                       [0.5, 0.5],
                       [0.5, 0.2],
                       [0.5, 0.8],
                       [0.8, 0.5],
                       [0.2, 0.5],
                       [0.65, 0.35],
                       [0.35, 0.65],
                       [0.65, 0.65],
                       [0.35, 0.35]].reverse();


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
        var x = Math.floor(this.position[0] * 10000) / 10000;
        var y = Math.floor(this.position[1] * 10000) / 10000;
        return "S," + x + "," + y + ";";
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
            var new_agent = new Agent(this, position.slice());
            if (Math.random() < this.mutation_rate) {
                new_agent.mutant = true;
            }
            this.agents.push(new_agent);
        }
    }

    spawn(number, position, parent) {
        // Add agents to the position with the given parent
        for (var i = 0; i < number; i++) {
            var new_agent = new Agent(this, position.slice());
            new_agent.maybe_inherit_fitness(parent);
            if (Math.random() < this.mutation_rate) {
                new_agent.mutant = true;
            }
            this.agents.push(new_agent);
        }
    }

    populate_no_mutation(number, position) {
        // Add 'number' agents at position 'position' with no chance of mutation
        for (var i = 0; i < number; i++) {
            var new_agent = new Agent(this, position.slice());
            new_agent.fitness = 0;
            this.agents.push(new_agent);
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

    kill_all_not_immune() {
        // Kill all members of the species that have not developed resistance to antibiotics
        for (var i in this.agents) {
            if (!this.agents[i].is_immune()) {
                this.agents[i].die();
            }
        }
    }
}


class Agent{
    constructor(species, position) {
        this.species = species;
        this.rand_max = 50;
        this.collision_radius = 0.01;
        this.mutant = false;

        var base_speed = 0.0015 + this.species.flagella * 0.010;
        var variant_speed = 0.0005 + this.species.flagella * 0.005;
        this.speed = sim_speed * (base_speed + Math.random() * variant_speed);
        this.direction = this.random_direction();
        this.fitness = this.random_value(this.rand_max);
        this.position = position.slice();
        this.alive = true;
        this.energy = 1;

        this.target = null;
        this.target_dist = null;
        this.perception_distance = 0.03 + 0.03 * this.species.flagella;

        this.age = 0;
        this.mutant_death_time = 4 + Math.random() * 2;
    }

    maybe_inherit_fitness(parent) {
        if (Math.random() < this.mutation_rate) {
            this.fitness = parent.fitness;
        }
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
        if (this.mutant) { return; }
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
        if (this.mutant) { return false; }
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
            if (simulation_age > 3) {
                this.target = other;
                this.target_dist = dist2;
            }
        }

        return result;
    }

    eat_sugar() {
        if (!this.alive) { return; }
        if (this.mutant) { return; }
        for (var i in sugar.sugar) {
            if (this.is_colliding(sugar.sugar[i])) {
                this.energy += sugar.sugar[i].energy * this.species.metabolism;
                sugar.sugar[i].energy = 0;
                sugar.sugar[i].alive = 0;
            }
        }
    }

    fight(other) {

        if (this.mutant) {
            this.die();
            return;
        } else if (other.mutant) {
            other.die();
            return;
        }

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

        if (this.mutant) { return; }

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
        if (this.mutant && (this.age > this.mutant_death_time)) { this.die(); }
        this.age += dt;
    }

    sstring(stat) {
        // Converts a single stat to a string character
        return (Math.floor(stat * 5)).toString();
    }

    stat_string() {
        var mutant_string = "0";
        if (this.mutant) { mutant_string = "1"; }
        return (this.sstring(this.species.metabolism) + this.sstring(this.species.flagella) + this.sstring(this.species.toxicity) + this.sstring(this.species.robustness) + mutant_string);
    }

    to_string() {
        var x = Math.floor(this.position[0] * 10000) / 10000;
        var y = Math.floor(this.position[1] * 10000) / 10000;
        var immune = 0;
        if (this.is_immune()) {
            immune = 1;
        }

        var tempID = -1;
        for (var i in species) {
        	if (species[i].id == this.species.id) {
        		tempID = i;
        		break;
        	}
        }

        var result = tempID + "," + x + "," + y + "," + immune + "," + this.stat_string() + ";";
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


function start_simulation() {
    started = true;
}


io.on('connection', function(socket) {
    client_ids.push(socket.id);
	console.log('New Connection');
   	socket.on('new_species', function(id, mutation_rate, metabolism, flagella, toxicity, robustness) {
		try {
		    if (!(started)) {
                var new_species = new Species(id, mutation_rate, metabolism, flagella, toxicity, robustness);
                species.push(new_species);
                new_species.populate_no_mutation(30, spawn_positions.pop());
            }
		} catch (e) {
			console.log(e);
		}
   	});
   	socket.on('become_host', function() {
		try {
			var packet = [];
			for (var i in species) {
				packet.push(species[i].id);
			}

			io.to(socket.id).emit("cache", packet);
			host = socket.id;
		} catch (e) {
			console.log(e);
		}
   	});
   	socket.on('start', function() {
   	    try {
   	        start_simulation();
   	    } catch (e) {
   	        console.log(e);
   	    }
   	});
});

function time_string() {
    var remaining = Math.max(300 - simulation_age, 0);
    var seconds = Math.floor(remaining % 60);
    if (seconds.toString().length == 1) {
        seconds = "0" + seconds;
    }
    var minutes = Math.floor(remaining/60);
    return ("T," + minutes + ":" + seconds + ";");
}

<<<<<<< HEAD
var a = new Species("Mip", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
var b = new Species("Newp", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
var c = new Species("Literally E. coli", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
var d = new Species("Nathius sampolium", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
var e = new Species("Paul nadanius", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
var f = new Species("Jeremus cryanus", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
var g = new Species("R. martellium", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
species.push(a);
species.push(b);
species.push(c);
a.populate_no_mutation(30, spawn_positions.pop());
b.populate_no_mutation(30, spawn_positions.pop());
c.populate_no_mutation(30, spawn_positions.pop());
=======
//var a = new Species("Mip", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
//var b = new Species("Newp", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
//var c = new Species("Literally E. coli", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
//var d = new Species("Nathius sampolium", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
//var e = new Species("Paul nadanius", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
//var f = new Species("Jeremus cryanus", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
//var g = new Species("R. martellium", 0.5, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2);
//species.push(a);
//species.push(b);
//species.push(c);
//species.push(d);
//species.push(e);
//species.push(f);
//species.push(g);
//a.populate_no_mutation(30, spawn_positions.pop());
//b.populate_no_mutation(30, spawn_positions.pop());
//c.populate_no_mutation(30, spawn_positions.pop());
//d.populate_no_mutation(30, spawn_positions.pop());
//e.populate_no_mutation(30, spawn_positions.pop());
//f.populate_no_mutation(30, spawn_positions.pop());
//g.populate_no_mutation(30, spawn_positions.pop());
>>>>>>> 589943bfcabb3a253d00cd4505e2ef243205d871

function packet() {
    var p = "";
    p += time_string();
    p += sugar.to_string();
    for (var i in species) {
        p += species[i].to_string();
    }
    return p;
}

setInterval(function() {
	if (host != '') {
	    io.to(host).emit("update", packet());
	}
}, 1000/packet_ticks);

setInterval(function() {
	var date = new Date();
	var newTime = date.getTime();
	var dt = newTime - time;
	if (started) {
		simulation_age += dt/1000;
	}

    // After five minutes, all cells without resistance die
	if (simulation_age > 300) {
	    for (var i in species) {
	        species[i].kill_all_not_immune();
	    }
	}

	if (started) {
        for (var i in species) {
            for (var j in species[i].agents) {
                species[i].agents[j].update(dt/1000);
            }
            species[i].check_collisions();
            species[i].bring_out_your_dead();
        }
        sugar.bring_out_your_dead();
    }
    time = newTime;
}, 1000/simulation_ticks);