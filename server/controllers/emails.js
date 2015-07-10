module.exports = function(api) {
    return {
        retrieveEmails: function(req, res) {
            api.emails.get().then(function(emails) {
                res.json(emails);
            }, function(error) {
                res.status(error.code).json({ message: error.message, error: error.details });
            });
        },
        createEmails: function(req, res) {
            api.emails.create(req.body).then(function(emails) {
                res.json(emails);
            }, function(error) {
                res.status(500).json({ message: error.message, error: error.details });
            });
        },
        startEmail: function(req, res) {
            if(req.query.id) {
                if(api.mongoose.Types.ObjectId.isValid(req.query.id)) {
                    api.emails.getById(req.query.id).then(function(email) {
                        if(email) {
                            api.user.getForEmail().then(function(users) {
                                console.log('Got ' + users.length + ' able to be emailed.');
                                api.emails.send(users, email).then(function(data) {
                                    console.log('Completed sending the emails!', data);
                                }, function(error) {
                                    console.log('Errored out sending an email:', error);
                                });

                                //send the update after two seconds
                                setTimeout(function() {
                                    api.emails.getSendingStatus().then(function(details) {
                                        res.json(details);
                                    }, function(error) {
                                        res.status(error.code).json({ message: error.message, error: error.details });
                                    });
                                }, 2000);
                            }, function(error) {
                                res.status(error.code).json({ message: error.message, error: error.details });
                            });
                        }else {
                            res.status(404).json({ message: 'An email with the id ' + req.query.id + ' could not be found.' });
                        }
                    }, function(error) {
                        res.status(error.code).json({ message: error.message, error: error.details });
                    });
                }else {
                    res.status(400).json({ message: 'The id provided is not a valid id.' });
                }
            }else {
                res.status(400).json({ message: 'Missing the id parameter.' });
            }
        },
        getStatus: function(req, res) {
            api.emails.getSendingStatus().then(function(details) {
                res.json(details);
            }, function(error) {
                res.status(error.code).json({ message: error.message, error: error.details });
            });
        }
    }
}
