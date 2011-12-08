/**
 * Module dependencies.
 */

var express = require('express');
var app = module.exports = express.createServer();

var cradle = require('cradle');
var imageDB = new(cradle.Connection)().database('image_information');
var locationDB = new(cradle.Connection)().database('location_information');
var formidable = require('formidable');

/** WebSocket Settings */
var WebSocketServer = require('websocket').server;
wsServer = new WebSocketServer({
	httpServer: app,
	// You should not use autoAcceptConnections for production
	// applications, as it defeats all standard cross-origin protection
	// facilities built into the protocol and the browser.  You should
	// *always* verify the connection's origin and decide whether or not
	// to accept it.
	autoAcceptConnections: false
});

wsServer.on('request', function(request) {
	if (!originIsAllowed(request.origin)) {
		// Make sure we only accept requests from an allowed origin
		request.reject();
		console.log((new Date()) + " Connection from origin " + request.origin + " rejected.");
		return;
	}

	var connection = request.accept(null, request.origin);
	console.log((new Date()) + " Connection accepted.");
	connection.on('message', function(message) {
		if (message.type === 'utf8') {
			console.log("Received Message: " + message.utf8Data);
			connection.sendUTF(message.utf8Data);
		}
		else if (message.type === 'binary') {
			console.log("Received Binary Message of " + message.binaryData.length + " bytes");
			connection.sendBytes(message.binaryData);
		}
	});
	connection.on('close', function(reasonCode, description) {
		console.log((new Date()) + " Peer " + connection.remoteAddress + " disconnected.");
	});
});

function originIsAllowed(origin) {
	// put logic here to detect whether the specified origin is allowed.
	return true;
}

/** For SURF Matching Function with Feature Points Vector */
function SURFMatching(req, ret){
    console.log(req.body);
	
    if(req.body.rows == "0" && req.body.cols == "0"){
		ret.send("NO_FEATURES");
		return;
	}
    
    var fs = require('fs');
	var url = require('url');
	var http = require('http');

	var file_url = 'http://127.0.0.1:5984/location_information/' + req.body.locationID + '/' + req.body.locationID + '.xml';
	var file_name = url.parse(file_url).pathname.split('/').pop();
	var file = fs.createWriteStream(file_name);

	/** Download LocationDB */
	var options = {
		host: url.parse(file_url).hostname,
		port: url.parse(file_url).port,
		path: url.parse(file_url).pathname
	};
	console.log(options);
	http.get(options, function(res) {
		res.on('data', function(data) {
			file.write(data);
			console.log('data');
		}).on('end', function() {
			file.end();
			console.log(file_name + ' downloaded');			
		});
	});

	/** Matching After downloading */
	file.on('close', function () { 
		/** Matching Section */
		var flann = require('../node_FLANNMatcher/build/Release/FLANNMatcher');
		var m = new flann.FLANNMatcher();
		//var mn = m.getMatchedObject(req.query.locationID + '.xml', 'descriptors.xml');
		var mn = m.getMatchedObject(req.body.locationID + '.xml', req.body.rows, req.body.cols, req.body.type, req.body.dump);

		console.log(req.body.locationID + '.xml' + "," + mn);

		/** JSON Parsing with Location Information */
		var json_li = "";
		var op_li = {
			host: '127.0.0.1',
			port: '5984',
			path: '/location_information/' + req.body.locationID
		};
		http.get(op_li, function(res) {
			res.on('data', function(data) {
				json_li += data.toString('utf8');
			}).on('end', function() {
				var li = JSON.parse(json_li);
				console.log(li);

				/** JSON Parsing with Image Information */
				console.log('get Image Information:' + li.image_informations[mn]);
				var ii_url = url.parse(li.image_informations[mn]);
				var json_ii = "";
				var op_ii = {
					host: ii_url.hostname == 'localhost' ? '127.0.0.1' : ii_url.host,
					port: ii_url.port,
					path: ii_url.pathname
				};
				http.get(op_ii, function(res) {
					res.on('data', function(data) {
						json_ii += data.toString('utf8');
					}).on('end', function() {
						var ii = JSON.parse(json_ii);
						console.log(ii);

						/** return Image Information section "title" */
						ret.send(json_ii);
					});
				});
			});
		});
	});
}


//var matcher = require('/Users/tesshy/sakamura-lab.org/Doctor/CoCoLo/Development/FLANNMatcher_node/build/default/node_FLANNMatcher');
//var m = new tmp.node_FLANNMatcher();
//db.save('skywalker', {
//force: 'light',
//name: 'Luke Skywalker'
//}, function (err, res) {
//if (err) {
////Handle error
//} else {
////Handle success
//}
//});

//Configuration

app.configure(function(){
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
	app.use(express.errorHandler()); 
});

//Routes
app.get('/', function(req, res){
	res.render('index', {
		title: 'Express'
	});
});

app.get('/debug', function(req, res){
	res.render('debug.ejs', {
		layout: false
	});
});

app.get('/editor', function(req, res){
	res.render('editor.ejs', {
		layout: false
	});
});

app.get('/contents', function(req, res){
	var id = req.query.id;
	imageDB.get(id, function (err, doc) {
		console.log(doc.contents);
		res.render('contents.ejs', {
			layout: false,
			title: doc.title,
			id: doc._id,
			contents: doc.contents
		});
	});	
});


app.get('/li', function(req, res){
	if (req.query.locationID) {
		console.log("%s", req.query.locationID);

		//* Build up request Temporary View */		
		locationDB.temporaryView({
			map: function(doc) {
				if (doc.locationID == req.query.locationID) {
					emit(doc._id,{image:doc._attachments});
				}
			}}, function (err, res) {
				if (err) console.log(err);
				console.log(res);
			});
	}
});

app.get('/test', function(req, res){
	console.log(req.query); // for logging
	// NAMEパラメタが空でなければ画面に表示
	if (req.query.name) {
		console.log("%s", req.query.name);
	}
});

app.get('/list', function(req, ret){
	console.log(req.query.locationID); // for logging
	var locationID = req.query.locationID;
	var mapFunctionString = "function(doc){if(doc.locationID ==\'" + locationID + "\'){emit(null, doc);}}";
	var mapFunction = Function('doc','if(doc.locationID ==' + locationID + '){emit(null, doc);}');
	var map = { map:mapFunctionString};
	console.log(map);

	imageDB.temporaryView(map, function (err, res) {
		if (err){
			console.log(err);
			ret.send("NO DATA");
		}else{
			ret.render('imagelist', {
				title:locationID,
				imagelist:res
			});
			console.log(res);
			console.log("-------------------");
		}
	});
});

app.get('/available', function(req, ret){
	console.log(req.query.locationID); // for logging
	var locationID = req.query.locationID;
	var mapFunctionString = "function(doc){emit(null, doc.locationID)}";
	var map = { map:mapFunctionString};
	console.log(map);

	imageDB.temporaryView(map, function (err, res) {
		if (err){
			console.log(err);
			ret.send("NO DATA");
		}else{
			var storage = {};
			var uniqueArray = [];			
			var i, value;
			for (i = 0; i < res.length; i++) {
				value = res[i].value;
				if (!(value in storage)) {
					storage[value] = true;
					uniqueArray.push(value);
				}
			}
			console.log(uniqueArray);
			ret.render('available', {
				title:"AvailableList",
				availablepartial:uniqueArray
			});
			console.log(res);
		}
	});
});

app.get('/matching', function(req, ret){
	// Dependencies
	var fs = require('fs');
	var url = require('url');
	var http = require('http');

	var file_url = 'http://127.0.0.1:5984/location_information/' + req.query.locationID + '/' + req.query.locationID + '.xml';
	console.log(file_url);
	var file_name = url.parse(file_url).pathname.split('/').pop();
	var file = fs.createWriteStream(file_name);

	file.on('close', function () { 
		/** Matching Section */
		var flann = require('../node_FLANNMatcher/build/Release/FLANNMatcher');
		var m = new flann.FLANNMatcher();
		var mn = m.getMatchedObject(req.query.locationID + '.xml', 'descriptors.xml');
		console.log(req.query.locationID + '.xml' + "," + mn);

		/** JSON Parsing with Location Information */
		var json_li = "";
		var op_li = {
			host: '127.0.0.1',
			port: '5984',
			path: '/location_information/' + mn
		};
		http.get(op_li, function(res) {
			res.on('data', function(data) {
				json_li += data.toString('utf8');
			}).on('end', function() {
				var li = JSON.parse(json_li);
				console.log(li);			

				/** JSON Parsing with Image Information */
				console.log('get Image Information:' + li.image_informations[mn]);
				var ii_url = url.parse(li.image_informations[mn]);
				var json_ii = "";
				var op_ii = {
					host: ii_url.hostname == 'localhost' ? '127.0.0.1' : ii_url.host,
					port: ii_url.port,
					path: ii_url.pathname
				};
				http.get(op_ii, function(res) {
					res.on('data', function(data) {
						json_ii += data.toString('utf8');
					}).on('end', function() {
						var ii = JSON.parse(json_ii);
						console.log(ii);

						/** return Image Information section "title" */
						ret.send(ii.title);
					});
				});
			});
		});
	});

	var options = {
		host: url.parse(file_url).hostname,
		port: url.parse(file_url).port,
		path: url.parse(file_url).pathname
	};
	console.log(options);
	http.get(options, function(res) {
		res.on('data', function(data) {
			file.write(data);
			console.log('data');
		}).on('end', function() {
			file.end();
			console.log(file_name + ' downloaded');			
		});
	});
});

app.post('/matching', function(req, ret) {
	SURFMatching(req, ret);

	// console.log(req.query.type); // for logging
	// if(req.query.type == "SURF"){
	// 	SURFMatching(req, ret);
	// }
});

app.listen(3000);
//app.listen(80);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);