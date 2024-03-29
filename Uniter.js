var cradle = require('cradle');
var imageDB = new(cradle.Connection)().database('image_information');
var locationDB = new(cradle.Connection)().database('location_information');
var formidable = require('formidable');
var fpdetector = require('../node_FPDetector/build/Release/FPDetector');
var fs = require('fs');

const II_URL = "http://127.0.0.1:5984/image_information/"; 


function calcBoundingBox(query){
    //console.log(query);
    if(query.latitude == null || query.longitude == null)
        return {"bbox":"-180,-90,180,90"};
    
    // var lat = Number(query.latitude)*Math.PI/180;
    // var lon = Number(query.longitude)*Math.PI/180;
    var lat = Number(query.latitude);
    var lon = Number(query.longitude);
    var hErr = Number(query.horizontalError);
    /** Error for no ERROR argment */
    if(hErr == null) hErr=10;
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

function calcBoundingBox(in_lon,in_lat,in_hErr){
    if(in_lon == null || in_lat == null)
        return {"bbox":"-180,-90,180,90"};
    
    // var lat = Number(query.latitude)*Math.PI/180;
    // var lon = Number(query.longitude)*Math.PI/180;
    var lat = Number(in_lat);
    var lon = Number(in_lon);
    var hErr = Number(in_hErr);
    /** Error for no ERROR argment */
    if(hErr == null) hErr=10;
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


function geoDistance(lat1, lng1, lat2, lng2, precision) {
    // 引数　precision は小数点以下の桁数（距離の精度）
    var distance = 0;
    if ((Math.abs(lat1 - lat2) < 0.00001) && (Math.abs(lng1 - lng2) < 0.00001)) {
        distance = 0;
    } else {
        lat1 = lat1 * Math.PI / 180;
        lng1 = lng1 * Math.PI / 180;
        lat2 = lat2 * Math.PI / 180;
        lng2 = lng2 * Math.PI / 180;
        
        var A = 6378140;
        var B = 6356755;
        var F = (A - B) / A;
        
        var P1 = Math.atan((B / A) * Math.tan(lat1));
        var P2 = Math.atan((B / A) * Math.tan(lat2));
        
        var X = Math.acos(Math.sin(P1) * Math.sin(P2) + Math.cos(P1) * Math.cos(P2) * Math.cos(lng1 - lng2));
        var L = (F / 8) * ((Math.sin(X) - X) * Math.pow((Math.sin(P1) + Math.sin(P2)), 2) / Math.pow(Math.cos(X / 2), 2) - (Math.sin(X) - X) * Math.pow(Math.sin(P1) - Math.sin(P2), 2) / Math.pow(Math.sin(X), 2));
        
        distance = A * (X + L);
        var decimal_no = Math.pow(10, precision);
        distance = Math.round(decimal_no * distance / 1) / decimal_no;   // kmに変換するときは(1000で割る)
    }
    return distance;
}

function uniteSURF(res, fields){
    var fpd = new fpdetector.FPDetector();

    /** List some matched objects */
    var ImageList = new Array();
    var IDList = new Array();
    var image_informations = new Array();
    var ucodes = new Array();

    for (var i=0; i<res.length; i++) {
        //console.log(res[i].id);
        if(fields.floor == null)
            fields['floor'] = '0'; // フロア指定がなかったら、とりあえず地上として扱う。

        if(res[i].value.floor == null)
            res[i].value.floor = 0;

        if(Number(res[i].value.floor) != Number(fields.floor)) 
            continue;

        for(var image in res[i].value.attachments){
            IDList.push(res[i].id);
            ucodes.push(res[i].value.ucode);
            image_informations.push(II_URL + res[i].id);
            ImageList.push(II_URL + res[i].id + "/" + image);
        }
    }
    //console.log(IDList);console.log(ImageList);

    /** calc SURF-FLANN DB */
    var path = fpd.calcSURF(ImageList);
    //delete fpd;

    //console.log(path);

    fields['uploadDate'] = new Date();
    fields['image_informations'] = image_informations; 
    fields['ucode'] = ucodes;
    
    locationDB.save(fields,
                    function(err, res) {
                        if(err){
		                    console.log("locationDB::save::NG");
		                }else{
		                    console.log("locationDB::save::OK");
                            console.log(fields);
		                }

                        console.log(res);
                        locationDB.saveAttachment(
                            res.id,
                            res.rev,
                            path.split('/').pop(),
                            "application/xml",
                            fs.readFileSync(path),
                            function(err, res) {
                                if(err){
                                    console.log("locationDB::AttachSave::NG");
                                }else{
		                            console.log("locationDB::AttachSave::OK");
                                }
                            }); 
                    });
    
};

exports.Uniter = function(app){
	app.get('/uniter',function(req, ret){
		console.log(req.query); // for logging
        
        if(req.query.locationID!=null){
            var mapFunctionString = "function(doc){if(doc.locationID ==\'" + req.query.locationID + "\'){emit(doc._id, {ucode:doc.ucode,attachments:doc._attachments});}}";
            var map = { map:mapFunctionString};
		    imageDB.temporaryView(map, function (err, res) {
			    if (err){
				    console.log(err);
				    ret.send("NO DATA");
			    }else{
				    //console.log(res);
                    var fields = {'locationID':req.query.locationID};
                    ret.send(uniteSURF(res, fields));
			    }
		    });
        }else if(req.query.ucode!=null){
            var mapFunctionString = "function(doc){if(doc.ucode ==\'" + req.query.ucode + "\'){emit(doc._id, {ucode:doc.ucode,attachments:doc._attachments});}}";

            var map = { map:mapFunctionString};
		    imageDB.temporaryView(map, function (err, res) {
			    if (err){
				    console.log(err);
				    ret.send("NO DATA");
			    }else{
				    //console.log(res);
                    var fields = {'ucode':req.query.ucode};
                    ret.send(uniteSURF(res,fields));
			    }
		    });
        }else if(req.query.type!=null){
            var spartialFunctionString;
            //console.log(imageDB);
            imageDB.spatial("geo/pointsImage",
                            calcBoundingBox(req.query),
                            function(err, res) {
                                if(err){
                                    ret.send("error");
                                    return;
                                }else{
                                    var fields = {'longitude':req.query.latitude,
                                                  'latitude':req.query.longitude,
                                                  'type':req.query.type,
                                                  'horizontalError':req.query.horizontalError};
                                    ret.send(uniteSURF(res,fields));
                                   // console.log(calcBoundingBox(req.query));
                                }
                            });
        }});

        app.post('/uniter',function(req, ret){
            console.log(req.query);

            var floor; // フロア(高さ)
            req.query.floor == null ? floor = 0 : floor = Number(req.query.floor);

            var hErr; //誤差半径
            req.query.hErr == null ? hErr=25 : hErr = Number(req.query.hErr);

            var geoJSON = JSON.parse(req.rawBody,'utf8');
            var points = new Array();
            
            //console.log(req.rawBody); // for logging

            var queries = new Array();
            var bboxs = new Array();
            
            for(var i=0; i < geoJSON.features.length; i++){
                var lon = geoJSON.features[i].geometry.coordinates[0];
                var lat = geoJSON.features[i].geometry.coordinates[1];
                var bbox = calcBoundingBox(lon,lat,hErr);
                bbox.lat = lat;
                bbox.lon = lon;
                bboxs.push(bbox);
            }
            
            
            var u = function(bbox){
                imageDB.spatial("geo/pointsImage",
                                bbox,
                                function(err, res){
                                    if(err){
                                        ret.send("error");
                                        return;
                                    }else{
                                        // console.log(res);
                                        // console.log(bbox);
                                        // console.log(res);
                                        // console.log('--------------------');
                                        uniteSURF(res,{'longitude':bbox.lon,
                                                       'latitude':bbox.lat,
                                                       'floor':floor,
                                                       'type':'Virtual',
                                                       'horizontalError':hErr});
                                    }
                                });
            }

            
            for (var i=0; i < bboxs.length; i++) {
                u(bboxs[i]);
            };
            
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