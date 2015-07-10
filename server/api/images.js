module.exports = function(q, api) {
    var imageCache = {};

    var updateLoadedCount = function(name, userid, emailid) {
        var justIncrement = function() {
            api.models.Image.findOneAndUpdate({ name: name }, { $inc: { loaded: 1 }}).exec().then(function(data) {
                console.log(name + ' has been loaded ' + (data.loaded + 1) + ' times.');
            }, function(error) {
                console.log('Errored out saving the incrementation of ' + name);
            });
        }

        if(userid) {
            api.models.User.findById(userid).exec().then(function(user) {
                if(emailid) {
                    api.async.each(user.emails, function(e, callback) {
                        if(e.id === emailid) {
                            console.log(user.username + ' is viewing the email:', e.subject);
                            e.viewed = true;
                        }
                        callback();
                    }, function(error) {
                        user.save();
                    });
                }

                api.models.Image.findOneAndUpdate({ name: name }, { $inc: { loaded: 1 }, $push: { viewers: { userid: userid, email: user.email }}}).exec().then(function(data) {
                    console.log(user.username + ' just loaded the image ' + name + ' and it has been loaded ' + (data.loaded + 1) + ' times.');
                }, function(error) {
                    console.log('Errored out saving the incrementation of ' + name);
                    justIncrement();
                });
            }, function(error) {
                console.log('Errored out getting ' + userid + ' for stat storing.', error);
                justIncrement();
            });
        }else {
            justIncrement();
        }
    };

    return {
        get: function(name, userid, emailid) {
            var defer = q.defer();

            if(name) {
                name = name.toLowerCase();
                if(imageCache[name]) {
                    defer.resolve(imageCache[name]);
                    updateLoadedCount(name, userid, emailid);
                }else {
                    api.models.Image.findOne({ name: name }).exec().then(function(data) {
                        if(data) {
                            imageCache[name] = { type: data.type, data: data.base64 };
                            defer.resolve(imageCache[name]);
                            updateLoadedCount(name, userid, emailid);
                        }else {
                            defer.reject({ code: 404, message: 'No image by the name of \'' + name + '\' found.' });
                        }
                    }, function(error) {
                        defer.reject({ code: 500, message: 'An internal error occured while getting all the emails.', details: error });
                    });
                }
            }else {
                api.models.Image.find({}).exec().then(function(images) {
                    defer.resolve(images);
                }, function(error) {
                    defer.reject({ code: 500, message: 'An internal error occured while getting all the emails.', details: error });
                });
            }

            return defer.promise;
        },
        add: function(name, details) {
            var defer = q.defer();

            name = name.toLowerCase();
            api.models.Image.findOne({ name: name }).exec().then(function(data) {
                if(data) {
                    defer.reject({ code: 400, message: 'An image by the of ' + name + ' already exists.' });
                }else {
                    var image = {
                        name: details.filename,
                        type: details.filetype,
                        base64: details.base64
                    };

                    var i = new api.models.Image(image);
                    i.save(function(error) {
                        if(error) {
                            defer.reject({ code: 500, message: 'An internal error occured while saving the name: ' + name + '.', details: error });
                        }else {
                            defer.resolve(i);
                        }
                    });
                }
            }, function(error) {
                defer.reject({ code: 500, message: 'An internal error occured while checking if ' + name + ' exists or not.', details: error });
            });

            return defer.promise;
        }
    }
}
