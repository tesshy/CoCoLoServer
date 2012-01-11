var cradle = require('cradle');
// var imageDB = new(cradle.Connection)().database('image_information');
var locationDB = new(cradle.Connection)().database('location_information');
// var formidable = require('formidable');
// var fpdetector = require('../node_FPDetector/build/Release/FPDetector');
// var fs = require('fs');

const II_URL = "http://127.0.0.1:5984/image_information/"; 

exports.SURFMatcher = function(req, ret){
    /** For SURF Matching Function with Feature Points Vector */

    console.log(req.body);
	
    if(req.body.rows == "0" || req.body.cols == "0"){
		ret.send("NO_FEATURES");
		return;
	}
    
    var fs = require('fs');
	var url = require('url');
	var http = require('http');
    
    /** search for matched Location's MatchingDB */ 
    var mapFunctionString = "function(doc){if(doc.locationID ==\'" + req.body.locationID + "\'){emit(doc._id, doc._attachments);}}";
    var map = { map:mapFunctionString};
	locationDB.temporaryView(map, function (err, res) {
		if (err){
			console.log(err);
			ret.send("NO DATA");
		}else{
            //console.log(req);
			console.log(res);
            var file_url;
            for(var i=0; i<res.length; i++){
                for(fnameKey in res[i].value){
                    console.log(fnameKey);
                    file_url = 'http://127.0.0.1:5984/location_information/' + res[i].id + '/' + fnameKey;
                }
            }
            //var file_url = 'http://127.0.0.1:5984/location_information/' + req.body.locationID + '/' + req.body.locationID + '.xml';
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
		        //var mn = m.getMatchedObject(req.body.locationID + '.xml', req.body.rows, req.body.cols, req.body.type, req.body.dump);
		        var mn = m.getMatchedList(req.body.locationID + '.xml', req.body.rows, req.body.cols, req.body.type, req.body.dump);

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
				        console.log('matched List:' + mn);

				        var ucodeList = new Object();
				        for(var i = 0; i<mn.length; i++){
					        if(li.ucodes == null){
						        if(ucodeList[mn[i]]==null)
							        ucodeList[mn[i]] = 1;
						        else
							        ucodeList[mn[i]]++;
					        }else if(li.ucodes[mn[i]]==""){
						        if(ucodeList[mn[i]]==null)
							        ucodeList[mn[i]] = 1;
						        else
							        ucodeList[mn[i]]++;	
					        }else{
						        if(ucodeList[li.ucodes[mn[i]]]==null)
							        ucodeList[li.ucodes[mn[i]]] = 1;
						        else
							        ucodeList[li.ucodes[mn[i]]]++;
					        }
				        }
			            
				        var ucodeCount = new Array();
				        for (var ucode in ucodeList) {
					        ucodeCount.push({key:ucode,value:ucodeList[ucode]})						
				        }
				        ucodeCount.sort( function( a, b ) { return a.value - b.value; } );
				        console.log(ucodeCount);
				        
				        var matchedImage = ucodeCount.pop();

				        if(li.image_informations[matchedImage.key] == null){
					        var kokosilUrl = "http://ginza.kokosil.net/ja/place/" + matchedImage.key;
					        var returnJson = {"kokosilDirectLink":kokosilUrl};
					        ret.send(JSON.stringify(returnJson));
					        console.log(returnJson);
				        }else{
					        /** JSON Parsing with Image Information */
					        console.log("matched Image:" + matchedImage.key);
					        console.log('get Image Information:' + li.image_informations[matchedImage.key]);
					        var ii_url = url.parse(li.image_informations[matchedImage.key]);
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
							        console.log(json_ii);
						        });
					        });
				        }
			        });
		        });
	        });

		}
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
