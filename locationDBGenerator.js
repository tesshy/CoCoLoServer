var cradle = require('cradle');
var imageDB = new(cradle.Connection)().database('image_information');

var fs = require('fs');

console.log(process.argv[2]);

var geoJSON = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
var ID2Point = {};
console.log(geoJSON);

for(var i=0; i < geoJSON.features.length; i++){
    ID2Point[geoJSON.features[i].properties.PhotoLocat] = geoJSON.features[i].geometry;
}
//console.log(ID2Point);

var locationID = "GINZA_UNDER_";

for(var num = 0; num < 60; num++){
    var mapFunctionString = "function(doc){if(doc.locationID ==\'" + locationID + String(num+1) + "\'){emit(doc._id, doc);}}";
    var map = { map:mapFunctionString};
    imageDB.temporaryView(map, function (err, res) {
	    if (err){
		    console.log(err);
	    }else{
		    console.log(res);
            for(var i=0; i<res.length; i++){
                var fields = {};
                fields['longitude'] = ID2Point[res[i].value.locationID].coordinates[0];
                fields['latitude'] = ID2Point[res[i].value.locationID].coordinates[1];
                fields['floor'] = '-1';
                fields['_id'] = res[i].key;
                console.log(fields);
                imageDB.merge(fields,
                              function(err, res) {
		                          if(err){
		                              console.log("NG:" + res);
		                          }else{
		                              console.log("OK:" + res);
		                          }
                              });
            }
	    }
    });
}
