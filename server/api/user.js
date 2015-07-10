var request = require('superagent');

module.exports = function(q, api, config) {
    var noSendDomains = require('../no-send-domains');
    var creatingAndUpdating = { running: false, finished: 0, errored: 0, total: 0 };

    console.log('Loaded '.blue + noSendDomains.length + ' no send domains.'.blue);

    return {
        loginViaTheForums: function(username, password) {
            var defer = q.defer();

            request
                .post(config.xenapi.url)
                .type('form')
                .send({
                    action: 'authenticate',
                    username: username,
                    password: password
                }).end(function (error, data) {
                    if(error) {
                        defer.reject({
                            code: error.response.body.error === 5 ? 400 : 501,
                            message: error.response.body.error === 5 ? 'Invalid username or password.' : 'Authentication failed, api returned an error.',
                            details: error
                        });
                    }else {
                        defer.resolve(JSON.parse(data.text));
                    }
                });

            return defer.promise;
        },
        retrieveAllUsersFromTheForums: function() {
            var defer = q.defer();

            request
                .post(config.xenapi.url)
                .type('form')
                .send({
                    action: 'getUsers',
                    value: '*',
                    limit: Number.MAX_SAFE_INTEGER,
                    hash: config.xenapi.key
                }).end(function (error, data) {
                    if(error) {
                        defer.reject({ code: 500, message: 'An internal error occured while getting the users from the forums.', details: error });
                    }else {
                        defer.resolve(data.body);
                    }
                });

            return defer.promise;
        },
        getAllFromDatabase: function() {
            var defer = q.defer();

            api.models.User.find({}).exec().then(function(users) {
                defer.resolve(users);
            }, function(error) {
                defer.reject({ code: 500, message: 'An internal error occured while getting all the users.', details: error });
            });

            return defer.promise;
        },
        getForEmail: function() {
            var defer = q.defer();

            api.models.User.find({ "states.banned": false, "states.user": "valid", "unsubscribed": false, $nor: noSendDomains }).exec().then(function(users) {
                defer.resolve(users);
            }, function(error) {
                defer.reject({ code: 500, message: 'An internal error occured while getting all the users for email.', details: error });
            });

            return defer.promise;
        },
        getByEmail: function(email) {
            var defer = q.defer();

            api.models.User.findOne({ email: email }).exec().then(function(user) {
                defer.resolve(user);
            }, function(error) {
                defer.reject({ code: 500, message: 'An internal error occured while getting your email ready.', details: error });
            });

            return defer.promise;
        },
        unsubscribe: function(email) {
            var defer = q.defer();

            api.models.User.findOneAndUpdate({ email: email }, { unsubscribed: true }).exec().then(function(user) {
                console.log(email + ' (' + user.username + ') has unsubscribed to our future emails.');
                defer.resolve(user);
            }, function(error) {
                console.log('Errored out unsubscribing ' + email + ' from future emails.');
                defer.reject({ code: 500, message: 'An internal error occured unsubscribing you from future emails, please report this to graywolf336.', error: error });
            });

            return defer.promise;
        },
        createOrUpdate: function(users) {
            var defer = q.defer();

            if(creatingAndUpdating.running) {
                //don't run as we're already processing it
                //return the status though
                defer.reject({ code: 202, message: 'Currently processing a previous create or update process, please try again later.', details: creatingAndUpdating })
            }else {
                //as it isn't already running, start it.
                creatingAndUpdating.running = true;

                //turn the users object into an array if it isn't an array
                if(!api._.isArray(users)) {
                    users = [users];
                }

                creatingAndUpdating.finished = 0;
                creatingAndUpdating.errored = 0;
                creatingAndUpdating.total = users.length;

                var limiter = new api.RateLimiter(10, 10000);

                var created = [];
                api.async.each(users, function(user, callback) {
                    limiter.removeTokens(1, function(err, remainingRequests) {
                        if(err) {
                            callback(err);
                        }else {
                            console.log('Now processing: ' + user.username);
                            api.models.User.findOne({ username: user.username, user_id: user.user_id }).exec().then(function(userInDB) {
                                request
                                    .post(config.xenapi.url)
                                    .type('form')
                                    .send({
                                        action: 'getUser',
                                        value: user.user_id,
                                        hash: config.xenapi.key
                                    }).end(function (error, data) {
                                        if(error) {
                                            callback({ code: 500, message: 'An internal error occured while getting ' + user.username + '\'s data from the forums.', details: error });
                                        }else {
                                            var details = data.body;

                                            if(userInDB) {
                                                //update the user
                                                userInDB.user_id = details.user_id;
                                                userInDB.email = details.email;
                                                userInDB.username = details.username;
                                                userInDB.minecraft = details.minecraft;
                                                userInDB.dates.active = new Date(details.last_activity * 1000);
                                                userInDB.states.banned = details.is_banned === 1;
                                                userInDB.states.user = details.user_state;
                                                userInDB.states.visible = details.visible === 1;
                                                userInDB.states.activity_visible = details.activity_visible === 1;

                                                userInDB.save(function(error) {
                                                    if(error) {
                                                        creatingAndUpdating.errored++;
                                                        console.log('Error updating: ' + user.username + ';', error);
                                                        callback({ code: 500, message: 'An internal error occured while updating ' + user.username + '\'s data in the database.', details: error });
                                                    }else {
                                                        creatingAndUpdating.finished++;
                                                        created.push(u);
                                                        console.log('Updated: ' + user.username);
                                                        callback();
                                                    }
                                                });
                                            }else {
                                                //create
                                                var us = {
                                                    user_id: details.user_id,
                                                    email: details.email ? details.email : 'N/A', //This happens when someone's email bounced
                                                    username: details.username,
                                                    minecraft: details.minecraft ? details.minecraft : 'N/A',
                                                    dates: {
                                                        active: new Date(details.last_activity * 1000),
                                                        register: new Date(details.register_date * 1000)
                                                    },
                                                    states: {
                                                        banned: details.is_banned === 1,
                                                        user: details.user_state,
                                                        visible: details.visible === 1,
                                                        activity_visible: details.activity_visible === 1
                                                    },
                                                    unsubscribed: details.email ? false : true //mark them as unsubscribed if they don't have an email
                                                }

                                                var u = new api.models.User(us);

                                                u.save(function(error) {
                                                    if(error) {
                                                        creatingAndUpdating.errored++;
                                                        console.log('Error creating: ' + user.username + ';', error);
                                                        callback({ code: 500, message: 'An internal error occured while creating ' + user.username + '\'s data in the database.', details: error });
                                                    }else {
                                                        creatingAndUpdating.finished++;
                                                        created.push(u);
                                                        console.log('Created ' + user.username + ' in the db.');
                                                        callback();
                                                    }
                                                });
                                            }
                                        }
                                    });
                            }, function(error) {
                                creatingAndUpdating.errored++;
                                callback({ code: 500, message: 'An internal error occured while finding ' + user.username + '\'s data in the database.', details: error });
                            });
                        }
                    });
                }, function(error) {
                    if(error) {
                        defer.reject(error);
                    }else {
                        creatingAndUpdating.running = false;
                        defer.resolve({ users: created, details: creatingAndUpdating });
                        creatingAndUpdating = { finished: 0, errored: 0, total: 0 };
                    }
                });
            }

            return defer.promise;
        },
        getCreateAndUpdateDetails: function() {
            var defer = q.defer();

            if(creatingAndUpdating.running) {
                defer.resolve(creatingAndUpdating)
            }else {
                defer.reject({ code: 200, message: 'The creating or updating is not currently running.', details: creatingAndUpdating });
            }

            return defer.promise;
        }
    }
}
