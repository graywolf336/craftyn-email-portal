module.exports = function(q, api, config) {
    var sending = { running: false, finished: 0, errors: [], errored: 0, total: 0 };
    var noneUsernames = ['n/a', 'mojang', 'premium', 'yes', 'asd', 'asdasdas', 'asdfas', 'mojan', 'craftyn', 'fgdg'];

    return {
        get: function() {
            var defer = q.defer();

            api.models.Email.find({}).exec().then(function(data) {
                defer.resolve(data);
            }, function(error) {
                defer.reject({ code: 500, message: 'An internal error occured while getting all the emails.', details: error });
            });

            return defer.promise;
        },
        getById: function(id) {
            var defer = q.defer();

            api.models.Email.findById(id).exec().then(function(data) {
                defer.resolve(data);
            }, function(error) {
                defer.reject({ code: 500, message: 'An internal error occured while getting all the emails.', details: error });
            });

            return defer.promise;
        },
        create: function(emails) {
            var defer = q.defer();

            //turn the emails object into an array
            //if it isn't already
            if(!api._.isArray(emails)) {
                emails = [emails];
            }

            var created = [];
            api.async.each(emails, function(email, callback) {
                email.status = 'New';
                var e = new api.models.Email(email);

                e.save(function(error) {
                    if(!error) created.push(e);

                    callback(error);
                });
            }, function(error) {
                if(error) {
                    defer.reject({ message: 'Error occured while saving an email.', details: error });
                }else {
                    defer.resolve(created);
                }
            });

            return defer.promise;
        },
        send: function(users, email) {
            var defer = q.defer();

            if(!api._.isArray(users)) {
                users = [users];
            }

            //reset the progress
            sending = { finished: 0, errored: 0, total: 0, errors: [] }

            //Update the email to in progress
            email.status = 'In Progress';
            email.save();

            //we are hard limited to 2,951 an hour
            var limiter = new api.RateLimiter(42, 'minute');
            sending.running = true;
            sending.finished = 0;
            sending.errors = [];
            sending.errored = 0;
            sending.total = users.length;

            api.async.each(users, function(user, callback) {
                limiter.removeTokens(1, function(err, remainingRequests) {
                    if(err) {
                        sending.errored++;
                        sending.errors.push(err);
                        callback(err);
                    }else {
                        console.log('Now emailing: ' + user.username);

                        //use their minecraft username provided IF it isn't one of the placeholder style ones
                        var username = noneUsernames.indexOf(user.minecraft.toLowerCase()) === -1 ? user.username : user.minecraft;
                        var date = new Date();
                        var message = {
                            html: email.body.html.replace(/\\/g, "").replace(/{url}/g, config.url).replace(/{username}/g, username).replace(/{email}/g, user.email).replace(/{year}/g, date.getFullYear()).replace(/{id}/g, email._id.toString()).replace(/{userid}/g, user._id.toString()),
                            text: email.body.text.replace(/\\/g, "").replace(/{url}/g, config.url).replace(/{username}/g, username).replace(/{email}/g, user.email).replace(/{year}/g, date.getFullYear()).replace(/{id}/g, email._id.toString()).replace(/{userid}/g, user._id.toString()),
                            subject: email.subject,
                            from_email: config.email.from.email,
                            from_name: config.email.from.name,
                            to: [{
                                email: user.email,
                                name: username,
                                type: "to"
                            }],
                            track_opens: config.email.track.opens,
                            track_clicks: config.email.track.clicks
                        }
                        console.log(message);
                        user.emails.push({ id: email._id, email: message.html, subject: email.subject });
                        user.save();

                        if(config.email.send) {
                            api.mandrill.messages.send({ message: message }, function(result) {
                                sending.finished++;
                                callback();
                            }, function(error) {
                                sending.errored++;
                                sending.errors.push(error);
                                callback(error);
                            });
                        }else {
                            //since we're not supposed to send, fake finished
                            sending.finished++;
                            callback();
                        }
                    }
                })
            }, function(error) {
                if(error) {
                    defer.reject(error);
                }else {
                    sending.running = false;
                    defer.resolve({ users: created, details: sending });
                }
            });

            return defer.promise;
        },
        getSendingStatus: function() {
            var defer = q.defer();

            if(sending.running) {
                defer.resolve(sending)
            }else {
                defer.reject({ code: 200, message: 'The creating or updating is not currently running.', details: sending });
            }

            return defer.promise;
        }
    }
}
