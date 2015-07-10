module.exports = function(api) {
    return {
        get: function(req, res) {
            console.time('get-image');
            api.images.get(req.params.name, req.params.userid, req.params.emailid).then(function(image) {
                if(api._.isArray(image)) {
                    res.json(image);
                }else {
                    var img = new Buffer(image.data, 'base64');

                    res.writeHead(200, {
                     'Content-Type': image.type,
                     'Content-Length': img.length
                    });

                    res.end(img);
                    console.timeEnd('get-image');
                }
            }, function(error) {
                res.status(error.code).json({ message: error.message, error: error.details });
            });
        },
        create: function(req, res) {
            api.images.add(req.params.name, req.body).then(function() {
                res.json({ message: 'Successfully uploaded the image.' });
            }, function(error) {
                res.status(error.code).json({ message: error.message, error: error.details });
            });
        }
    }
}
