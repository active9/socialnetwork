/*
 * social network - Network socially in real time
 */

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var _ = require('lodash');
var Waterline = require('waterline');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var userNames = {};
var numUsers = 0;

// Configuration
var port = 80;
var maxPostSize = 500;

// Instantiate a new instance of the ORM
var orm = new Waterline();

// Disk Adapter Mode
var diskAdapter = require('sails-disk');

// Waterline Config
var config = {
	adapters: {
		'default': diskAdapter,
		disk: diskAdapter
	},
	connections: {
		myLocalDisk: {
			adapter: 'disk'
		}
	},
	defaults: {
		migrate: 'alter'
	}
};

// Models
var User = Waterline.Collection.extend({
	identity: 'user',
	connection: 'myLocalDisk',
	attributes: {
		first_name: 'string',
		last_name: 'string'
	}
});

// Load the Models into the ORM
orm.loadCollection(User);

// Express Setup
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride());

// Listening
server.listen(port, function () {
	console.log('Social Network running on port ', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Crud
app.get('/users', function(req, res) {
	app.models.user.find().exec(function(err, models) {
		if(err) return res.json({ err: err }, 500);
		res.json(models);
	});
});
app.post('/users', function(req, res) {
	app.models.user.create(req.body, function(err, model) {
		if(err) return res.json({ err: err }, 500);
		res.json(model);
	});
});
app.get('/users/:id', function(req, res) {
	app.models.user.findOne({ id: req.params.id }, function(err, model) {
		if(err) return res.json({ err: err }, 500);
		res.json(model);
	});
});
app.delete('/users/:id', function(req, res) {
	app.models.user.destroy({ id: req.params.id }, function(err) {
		if(err) return res.json({ err: err }, 500);
		res.json({ status: 'ok' });
	});
});
app.put('/users/:id', function(req, res) {
	delete req.body.id;
	app.models.user.update({ id: req.params.id }, req.body, function(err, model) {
		if(err) return res.json({ err: err }, 500);
		res.json(model);
	});
});

// Sockets
io.on('connection', function(socket) {

	var addedUser = false;

	socket.on('new message', function (data) {
		if (data.length<=maxPostSize) {
			socket.broadcast.emit('new message', {
				user: socket.user,
				msg: data
			});
		}
	});

	socket.on('add user', function (user) {
		socket.user = user;
		userNames[user] = user;
		++numUsers;
		addedUser = true;

		socket.emit('login', {
			numUsers: numUsers
		});

		socket.broadcast.emit('user online', {
			user: socket.user,
			numUsers: numUsers
		});
	});

	socket.on('typing', function () {
		socket.broadcast.emit('typing', {
			user: socket.user
		});
	});

	socket.on('stop typing', function () {
		socket.broadcast.emit('stop typing', {
			user: socket.user
		});
	});

	socket.on('disconnect', function () {
		if (addedUser) {
			delete userNames[socket.user];
			--numUsers;

			socket.broadcast.emit('user left', {
				user: socket.user,
				numUsers: numUsers
			});
		}
	});

});

orm.initialize(config, function(err, models) {
	if(err) throw err;
	app.models = models.collections;
	app.connections = models.connections;
	server.listen(port);
});