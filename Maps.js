var cradle = require('cradle');
var imageDB = new(cradle.Connection)().database('image_information');
var locationDB = new(cradle.Connection)().database('location_information');
var formidable = require('formidable');

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


exports.Maps = function(app){
	app.get('/maps',function(req, ret){
        console.log("accessed:maps");
        if(req.query.locationID != null){
            locationDB.get(req.query.locationID,
                           function(err,doc){
                               console.log(doc);
                               for(var i=0; i<doc.image_informations.length; i++){
                                   console.log(doc.image_informations[i]);
                                   ret.send("OK");
                               }
                           });
        }else{
            imageDB.spatial("geo/maps",
                            {"bbox":"-180,-90,180,90"},
                            function(err, res) {
                                console.log("finish:maps");
                                if(err){
                                    ret.send("error");
                                    return;
                                }else{
                                    ret.json(res.rows);
                                    return;
                                }
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