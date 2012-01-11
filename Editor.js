var cradle = require('cradle');
var imageDB = new(cradle.Connection)().database('image_information');
var locationDB = new(cradle.Connection)().database('location_information');
var formidable = require('formidable');

exports.Editor = function(app){
	app.get('/editor',function(req, ret){
		console.log(req.query); // for logging
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
				ret.render('editor', {
					title:"locationID:" + locationID + " ucode:" + ucode,
					editor_res:res
				});
				//console.log(res);
				//console.log("-------------------");
			}
		});
	});
	
  	app.post('/editor', function(req, ret) {
		console.log(req.body);
		imageDB.merge(req.body,
					 function (err, res) {
						 if(err){
							 console.log(err);
						 }else{
							 console.log(res);
							 ret.json(res); 
						 }
					 });
	});
};

  // var cradle = require('cradle');
  // var db = new(cradle.Connection)().database('starwars');
  // db.get('vader', function (err, doc) {
  //     doc.name; // 'Darth Vader'
  //     assert.equal(doc.force, 'dark');
  // });
  // db.save('skywalker', {
  //     force: 'light',
  //     name: 'Luke Skywalker'
  // }, function (err, res) {
  //     if (err) {
  //         // Handle error
  //     } else {
  //         // Handle success
  //     }
  // });