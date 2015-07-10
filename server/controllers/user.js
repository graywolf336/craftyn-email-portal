module.exports = function(api) {
    return {
        ensureAuthenticated: function(req, res, next) {
            if(req.session.info && req.session.info.hash) {
                next();
            }else {
                res.status(401).json({ message: 'Authentication required to access this resource.' });
            }
        },
        get: function(req, res) {
            if(req.session.info && req.session.info.hash) {
                var copied = req._.clone(req.session.info, true);
                delete copied.hash;
                res.json(copied);
            }else {
                res.json({ username: 'Anonymous' });
            }
        },
        login: function(req, res) {
            api.user.loginViaTheForums(req.body.username, req.body.password).then(function(data) {
                if(data.userdata.is_admin) {
                    req.session.info = {
                        hash: data.hash,
                        username: data.minecraft
                    };
                    res.json(data);
                    console.log(data.minecraft + ' just logged in.');
                }else {
                    res.status(401).json({ message: 'You are not authorized to use this application.' });
                }
            }, function(error) {
                res.status(error.code).json({ message: error.message, error: error.details });
            });
        },
        logout: function(req, res) {
            if(req.session.info && req.session.info.hash) {
                console.log(req.session.info.username + ' just logged out.');
                delete req.session.info;
                res.json({ username: 'Anonymous' });
            }else {
                res.status(401).json({ message: 'Not logged in.' });
            }
        },
        unsubscribe: function(req, res) {
            if(req.query.email) {
                api.user.unsubscribe(req.query.email).then(function(user) {
                    res.json({ message: 'Sorry to see you go, ' + user.username + '! You have successfully been unsubscribed from our future emails, you will miss out on some cool emails!' });
                }, function(error) {
                    res.status(error.code).json({ message: error.message, error: error.details });
                });
            }else {
                res.status(400).json({ message: 'An email must be provided to unsubscribe from our future emails.' });
            }
        },
        getAll: function(req, res) {
            api.user.getAllFromDatabase().then(function(users) {
                res.json(users);
            }, function(error) {
                res.status(error.code).json({ message: error.message, error: error.details });
            });
        },
        getUnsubscribed: function(req, res) {
            api.user.getUnsubscribed(req.query.all).then(function(users) {
                res.json(users);
            }, function(error) {
                res.status(error.code).json({ message: error.message, error: error.details });
            });
        },
        performDownload: function(req, res) {
            console.log('Starting to perform user retriveal.');
            api.user.retrieveAllUsersFromTheForums().then(function(forumUsers) {
                console.log('Retrieved all ' + forumUsers.length + ' from the forums.');
                api.user.createOrUpdate(forumUsers).then(function(users) {
                    console.log('Created all the users in the local database.');
                }, function(error) {
                    console.log('Error occured while processing all the users:', error);
                });

                api.user.getCreateAndUpdateDetails().then(function(details) {
                    console.log('Status details:', details);
                    res.json(details);
                }, function(error) {
                    res.status(error.code).json({ message: error.message, error: error.details });
                });
            }, function(error) {
                res.status(error.code).json({ message: error.message, error: error.details });
            });
        },
        checkPerformDownloadStatus: function(req, res) {
            api.user.getCreateAndUpdateDetails().then(function(details) {
                console.log('Status details:', details);
                res.json(details);
            }, function(error) {
                res.status(error.code).json({ message: error.message, error: error.details });
            });
        },
        displayEmail: function(req, res) {
            if(req.params.email && req.params.id) {
                api.user.getByEmail(req.params.email).then(function(user) {
                    if(user.emails.length) {
                        api._.forEach(user.emails, function(e) {
                            if(e.id === req.params.id) {
                                res.send(e.email);
                                e.viewed = true;
                                user.save();
                                console.log(req.params.email + ' just viewed their email: ' + req.params.id);
                            }
                        });
                    }else {
                        res.status(404).json({ message: 'No emails were found for you, sorry!' });
                    }
                }, function(error) {
                    res.status(error.code).json({ message: error.message, error: error.details });
                });
            }else {
                res.status(400).json({ message: 'Malformed url, email and id need to be provided.' });
            }
        }
    }
}
