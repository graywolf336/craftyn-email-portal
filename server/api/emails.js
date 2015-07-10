module.exports = function(q, api, config) {
    var sending = { running: false, errors: [], finished: 0, queued: 0, scheduled: 0, rejected: 0, errored: 0, total: 0 };
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
            sending = { running: false, errors: [], finished: 0, queued: 0, scheduled: 0, rejected: 0, errored: 0, total: 0 };

            //Update the email to in progress
            email.status = 'In Progress';
            email.save();

            //we are hard limited to 2,951 an hour
            //If we are to send email, set the rate to be 42 a minute
            //otherwise this is just a test and we need to see results
            var limiter = new api.RateLimiter(config.email.send ? 42 : 1000, 'minute');
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

                        user.emails.push({ id: email._id, email: message.html, subject: email.subject });
                        user.save();

                        if(config.email.send) {
                            api.mandrill.messages.send({ message: message }, function(result) {
                                result = result[0];

                                switch(result.status) {
                                    case 'sent':
                                        console.log('Email success sent to:'.green, user.username, '-', user.email);
                                        sending.finished++;
                                        break;
                                    case 'queued':
                                        console.log('Email queued for sending to:'.magenta, user.username, '-', user.email);
                                        sending.queued++;
                                        break;
                                    case 'scheduled':
                                        console.log('Email scheduled for sending to:'.magenta, user.username, '-', user.email);
                                        sending.scheduled++;
                                        break;
                                    case 'rejected':
                                        //The email was rejected, unsubscribe them from our system.
                                        user.unsubscribed = true;
                                        user.save();
                                        console.log('Email was rejected (' + result.reject_reason + ') for sending to:'.red, user.username, '-', user.email);
                                        sending.rejected++;
                                        break;
                                    case 'invalid':
                                        console.log('Email was invalid for sending to:'.yellow, user.username, '-', user.email);
                                        sending.errored++;
                                        break;
                                }

                                callback();
                            }, function(error) {
                                console.log('Email failed to send to:'.red, user.username, '-', user.email, error);
                                sending.errored++;
                                sending.errors.push(error);
                                callback();//we won't pass back the error to the callback, as we don't want it to stop from sending
                            });
                        }else {
                            //since we're not supposed to send, fake some data
                            var t = Date.now().toString();

                            switch(t[t.length - 1]) {
                                case '1':
                                case '6':
                                    console.log('Email success sent to:'.green, user.username, '-', user.email);
                                    sending.finished++;
                                    break;
                                case '2':
                                case '7':
                                    console.log('Email queued for sending to:'.magenta, user.username, '-', user.email);
                                    sending.queued++;
                                    break;
                                case '3':
                                case '8':
                                    console.log('Email scheduled for sending to:'.magenta, user.username, '-', user.email);
                                    sending.scheduled++;
                                    break;
                                case '4':
                                case '9':
                                    console.log('Email was rejected (fake) for sending to:'.red, user.username, '-', user.email);
                                    sending.rejected++;
                                    break;
                                case '5':
                                case '0':
                                    console.log('Email was invalid for sending to:'.yellow, user.username, '-', user.email);
                                    sending.errored++;
                                    break;
                            }

                            callback();
                        }
                    }
                })
            }, function(error) {
                if(error) {
                    defer.reject(error);
                }else {
                    sending.running = false;
                    defer.resolve({ details: sending });
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
        },
        dontUseAsItDoesntUseAPromiseButGetSendingStatus: function() {
            return sending;
        }
    }
}
