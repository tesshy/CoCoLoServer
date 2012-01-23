/**
 * Module dependencies.
 */

var express = require('express');
var app = module.exports = express.createServer();
var cradle = require('cradle');
var imageDB = new(cradle.Connection)().database('image_information');
var locationDB = new(cradle.Connection)().database('location_information');
var logDB = new(cradle.Connection)().database('log');
var formidable = require('formidable');

var editor = require('./Editor.js');
var uniter = require('./Uniter.js');
var matcher = require('./Matcher.js');
var maps = require('./Maps.js')
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

/** For Object Layer Settings */
editor.Editor(app);
uniter.Uniter(app);
maps.Maps(app);

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

app.get('/list', function(req, ret){
	console.log(req.query.locationID); // for logging
	var locationID = req.query.locationID;
	var ucode = req.query.ucode;
	
	var mapFunctionString = "function(doc){if(";
	if(locationID != null && ucode != null){
		mapFunctionString += "doc.locationID ==\'" + locationID + "\' && doc.ucode ==\'" + ucode + "\'){emit(null, doc);}}";
	}else{
		if(locationID != null)
			mapFunctionString += "doc.locationID ==\'" + locationID + "\'){emit(null, doc);}}";
		if(ucode != null)
			mapFunctionString += "doc.ucode ==\'" + ucode + "\' ){emit(null, doc);}}";
	}
	
	var map = { map:mapFunctionString};
	imageDB.temporaryView(map, function (err, res) {
		if (err){
			console.log(err);
			ret.send("NO DATA");
		}else{
			ret.render('imagelist', {
				title:"locationID:" + locationID + " ucode:" + ucode,
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

app.post('/matching', function(req, ret) {
    //console.log(req);
    // console.log(req.body);
	matcher.SURFMatcher(req, ret);
	// console.log(req.query.type); // for logging
	// if(req.query.type == "SURF"){
	// 	SURFMatching(req, ret);
	// }
});

app.listen(3000);

console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);





// app.get('/matching', function(req, ret){
// 	// Dependencies
// 	var fs = require('fs');
// 	var url = require('url');
// 	var http = require('http');

// 	var file_url = 'http://127.0.0.1:5984/location_information/' + req.query.locationID + '/' + req.query.locationID + '.xml';
// 	console.log(file_url);
// 	var file_name = url.parse(file_url).pathname.split('/').pop();
// 	var file = fs.createWriteStream(file_name);

// 	file.on('close', function () { 
// 		/** Matching Section */
// 		var flann = require('../node_FLANNMatcher/build/Release/FLANNMatcher');
// 		var m = new flann.FLANNMatcher();
// 		var mn = m.getMatchedObject(req.query.locationID + '.xml', 'descriptors.xml');
// 		console.log(req.query.locationID + '.xml' + "," + mn);

// 		/** JSON Parsing with Location Information */
// 		var json_li = "";
// 		var op_li = {
// 			host: '127.0.0.1',
// 			port: '5984',
// 			path: '/location_information/' + mn
// 		};
// 		http.get(op_li, function(res) {
// 			res.on('data', function(data) {
// 				json_li += data.toString('utf8');
// 			}).on('end', function() {
// 				var li = JSON.parse(json_li);
// 				console.log(li);			

// 				/** JSON Parsing with Image Information */
// 				console.log('get Image Information:' + li.image_informations[mn]);
// 				var ii_url = url.parse(li.image_informations[mn]);
// 				var json_ii = "";
// 				var op_ii = {
// 					host: ii_url.hostname == 'localhost' ? '127.0.0.1' : ii_url.host,
// 					port: ii_url.port,
// 					path: ii_url.pathname
// 				};
// 				http.get(op_ii, function(res) {
// 					res.on('data', function(data) {
// 						json_ii += data.toString('utf8');
// 					}).on('end', function() {
// 						var ii = JSON.parse(json_ii);
// 						console.log(ii);

// 						/** return Image Information section "title" */
// 						ret.send(ii.title);
// 					});
// 				});
// 			});
// 		});
// 	});

// 	var options = {
// 		host: url.parse(file_url).hostname,
// 		port: url.parse(file_url).port,
// 		path: url.parse(file_url).pathname
// 	};
// 	console.log(options);
// 	http.get(options, function(res) {
// 		res.on('data', function(data) {
// 			file.write(data);
// 			console.log('data');
// 		}).on('end', function() {
// 			file.end();
// 			console.log(file_name + ' downloaded');			
// 		});
// 	});
// });
