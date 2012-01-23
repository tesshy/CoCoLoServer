var cradle = require('cradle');
// var imageDB = new(cradle.Connection)().database('image_information');
var locationDB = new(cradle.Connection)().database('location_information');
var logDB = new(cradle.Connection)().database('log');
// var formidable = require('formidable');
// var fpdetector = require('../node_FPDetector/build/Release/FPDetector');
// var fs = require('fs');
var fs = require('fs');
var url = require('url');
var http = require('http');
var formidable = require('formidable');

const II_URL = "http://127.0.0.1:5984/image_information/"; 


function calcBoundingBox(in_lon,in_lat,in_hErr){
    if(in_lon == null || in_lat == null)
        return {"bbox":"-180,-90,180,90"};
    
    // var lat = Number(query.latitude)*Math.PI/180;
    // var lon = Number(query.longitude)*Math.PI/180;
    var lat = Number(in_lat);
    var lon = Number(in_lon);
    var hErr = Number(in_hErr);
    /** Error for no ERROR argment */
    if(hErr == null) hErr=30;
    var dir = 45 * Math.PI / 180;
    var pD = 0.00027778 / 25; // 25 = 0.00027778 Deg
    
    var dlon = hErr * Math.sin(dir) * pD;
    var dlat = hErr * Math.cos(dir) * pD;
    
    var lon1 = lon - dlon;
    var lat1 = lat - dlat;

    var lon2 = lon + dlon;
    var lat2 = lat + dlat;
    
    var bbox = String(lon1)+','+String(lat1) + ',' + String(lon2) + ',' + String(lat2);
    return {"bbox":bbox};
};

function calcBoundingBox(query){
    //console.log("===query===");
    //console.log(query);
    if(query.latitude == null || query.longitude == null)
        return {"bbox":"-180,-90,180,90"};
    
    // var lat = Number(query.latitude)*Math.PI/180;
    // var lon = Number(query.longitude)*Math.PI/180;
    var lat = Number(query.latitude);
    var lon = Number(query.longitude);    
    var hErr = query.horizontalError == null ? 30 : query.horizontalError;
    console.log(lat + "," + lon + "," + hErr);
    
    var dir = 45 * Math.PI / 180;
    var pD = 0.00027778 / 25; // 25 = 0.00027778 Deg
    
    var dlon = hErr * Math.sin(dir) * pD;
    var dlat = hErr * Math.cos(dir) * pD;
    
    var lon1 = lon - dlon;
    var lat1 = lat - dlat;

    var lon2 = lon + dlon;
    var lat2 = lat + dlat;
    
    var bbox = String(lon1)+','+String(lat1) + ',' + String(lon2) + ',' + String(lat2);
    console.log("===bbox===");
    console.log(bbox);
    return {"bbox":bbox};
};


function matching(req, ret, res, err, files){
     if(typeof files === 'undefined') files = null;
    //console.log(res);
    /** Request check */
    if(req.body != null){
        if(req.body.rows == "0" || req.body.cols == "0"){
		    ret.send("NO_FEATURES");
		    return;
	    }
        
        if(res.length == 0){
            ret.send("NO Matching Object.");
            return;
        }
    }

	if (err){
		console.log(err);
		ret.send("NO DATA");
	}else{
        //console.log(req);
		//console.log(res);
        var file_url;
        var locationDB_ID;
        for(fnameKey in res[0].value._attachments){
            console.log(fnameKey);
            locationDB_ID = res[0].value._id;
            file_url = 'http://127.0.0.1:5984/location_information/' + locationDB_ID + '/' + fnameKey;
        }
        console.log(file_url);

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
			    //console.log('data');
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
            var mn;
            if(files == null){
		        mn = m.getMatchedList(file_name, req.body.rows, req.body.cols, req.body.type, req.body.dump);
            }else{
                for(var fname in files){
                    mn = m.getMatchedList(file_name, files[fname].path);
                }
            }

		    console.log(file_name + "," + mn);
		    /** JSON Parsing with Location Information */
		    var json_li = "";
		    var op_li = {
			    host: '127.0.0.1',
			    port: '5984',
			    path: '/location_information/' + locationDB_ID
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
                    /** error for no matched image */
                    if(matchedImage == null){
                        ret.send("NO Matched");
                        return
                    }


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
						    host: ii_url.hostname,
                            //host: 'localhost',
						    port: ii_url.port,
						    path: ii_url.pathname
					    };

                        console.log(op_ii);

					    http.get(op_ii, function(res) {
                            //console.log(res);
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
}

function matchingForm(req, ret){    
    var form = new formidable.IncomingForm();
    form.uploadDir = __dirname + '/data';
    form.parse(req,
               function(err, fields, files) {
                   if (err) {
                       console.log("ERR:");
                       next(err);
                   } else {
                       console.log("fielsd");
                       console.log(fields);

                       // add for logging
                       fields.headers = req.headers;
                       fields.idleStart = req.connection._idleStart;
                       fields.body = req.body;

                       /** log write section */
                       logDB.save(fields,
                                  function(err, res) {
                                      for(var fname in files){
                                          logDB.saveAttachment(
                                              res.id,
                                              res.rev,
                                              fname,
                                              "image/" + fname.split(".").pop(),
                                              fs.readFileSync(files[fname].path),
                                              function(err, res) {
		                                          console.log("ImageFile attached.");
                                              });
                                      }
                                  });

                       locationDB.spatial("geo/pointsMatching",
                                          calcBoundingBox(fields),
                                          function(err, res) {
                                              if(err){
                                                  ret.send("error");
                                                  return;
                                              }else{
                                                  console.log("BEFORE:" + res.length);
                                                  deleteUnmatchedFloorResult(res,fields.floor);
                                                  console.log("AFTER:" + res.length);
                                                  if(res.length == 0){
                                                      console.log("NO Matched Images");
                                                      ret.send("NO RESULT");
                                                      return;
                                                  }
                                                  //console.log(res);
                                                  matching(req, ret, res, err, files);
                                              }
                                          });
                   }
               });
};

function deleteUnmatchedFloorResult(res, floor){
    var cFloor=NaN;
    // どうも地下の無線を拾うとマイナス.0(地下側)に引っ張られる模様
    // とりあえずコードを入れるが、正直これでいいのかは謎
    if(Number(floor) <= -0.8){
        console.log("000");
        cFloor = Math.ceil(Number(floor));
    }else if(-0.8 < Number(floor) || Number(floor) < 1.0){ // とりあえず0(地上)として処理する。
        console.log("111");
        cFloor = 0;
    }else if(Number(floor) >= 1){
        console.log("222");
        cFloor = Math.floor(Number(floor));
    }

    for(var i=0; i<res.length; i++){
        if(Number(res[i].value.floor) != cFloor){
            console.log("ERROR:" + String(res[i].value.floor) + "," + String(cFloor));
            res.splice(i,1);
            i=0;
        }else{
            console.log("SUCCESS:" + String(res[i].value.floor) + "," + String(cFloor));
        }
    }
}

exports.SURFMatcher = function(req, ret){
    /** For SURF Matching Function with Feature Points Vector */
    if(req.body == null){
        matchingForm(req,ret);
    }else{
        console.log(req.body);
        if(req.body.type == 'locationID'){
            /** search for matched Location's MatchingDB */ 
            var map = { map:"function(doc){if(doc.locationID ==\'" + req.query.locationID + "\'){emit(doc._id, doc._attachments);}}"};
	        locationDB.temporaryView(map, 
                                     function(err, res) {
                                         if(err){
                                             ret.send("error");
                                             return;
                                         }else{
                                             matching(req, ret, res, err);
                                         }
                                     });
        }else if(req.body.type == 'position' || req.body.type == 'kokosil'){
            //console.log(req.body);
            locationDB.spatial("geo/pointsMatching",
                               calcBoundingBox(req.body),
                               function(err, res) {
                                   if(err){
                                       ret.send("error");
                                       return;
                                   }else{
                                       console.log(res);
                                       matching(req, ret, res, err);
                                   }
                               });
        }else if(req.body.locationID){
            var map = { map:"function(doc){if(doc.locationID ==\'" + req.body.locationID + "\'){emit(doc._id, doc._attachments);}}"};
	        locationDB.temporaryView(map, 
                                     function(err, res) {
                                         if(err){
                                             ret.send("error");
                                             return;
                                         }else{
                                             console.log(res);
                                             matching(req, ret, res, err);
                                         }
                                     });
        }
    }
}


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
