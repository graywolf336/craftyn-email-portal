var colors = require('colors');
var express = require('express');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var RateLimiter = require('limiter').RateLimiter;
var bodyParser = require('body-parser');
var mandrill = require('mandrill-api/mandrill');
var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var q = require('q');
var app = express();

if(!fs.existsSync('./server/config.json')) {
    console.error('The "server/config.json" file must exist.'.red);
    process.exit(1);
}

//Get our configuration
var config = require('./server/config');

//Configure the database connection
var mongoose = require('mongoose');
mongoose.connect(config.mongo_connection);
mongoose.connection.on('error', console.error.bind(console, 'connection error:'));
mongoose.connection.once('open', function (callback) {
    console.log('Mongoose Connection successfully opened.'.green);
});

//The /client folder contains all the client files
app.use(express.static('client'));
//forward ips when we go behind the server
app.set('trust proxy', true);
//use regis as the session storage
app.use(session({
    store: new RedisStore({
        host: 'localhost'
    }),
    secret: config.redis_session_store_secret,
    resave: true,
    saveUninitialized: true
}));
//Parse the json body
app.use(bodyParser.json({ limit: '10mb' }));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ limit: '10mb', extended: false }));
app.use(function(req, res, next) {
    req._ = _;
    next();
});

//build our internal api
var api = { q: q, _: _, async: async, RateLimiter: RateLimiter, models: {}, mandrill: new mandrill.Mandrill(config.mandrill_api_key), mongoose: mongoose };

//Read all the database models
_.forEach(_.each(fs.readdirSync(__dirname + '/server/models/'), function(v) {
    var m = require(__dirname + '/server/models/' + v)(mongoose)
    api.models[m.modelName] = m;
}));

//Read all the apis and store them
_.forEach(_.each(fs.readdirSync(__dirname + '/server/api/'), function(v) {
    var path = __dirname + '/server/api/' + v;
    api[v.split('.')[0]] = require(path)(q, api, config);
}));

//Configure the routes
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/client/index.html');
});

//User login methods/apis
var user = require('./server/controllers/user')(api);
app.get('/api/user', user.get);
app.post('/api/user', user.login);
app.delete('/api/user', user.logout);

//Forum users methods/apis
app.get('/api/users', user.ensureAuthenticated, user.getAll);
app.get('/api/users/performDownload', user.ensureAuthenticated, user.performDownload);
app.get('/email/:email/:id', user.displayEmail);

var emails = require('./server/controllers/emails')(api);
app.get('/api/emails', user.ensureAuthenticated, emails.retrieveEmails);
app.post('/api/emails', user.ensureAuthenticated, emails.createEmails);
app.put('/api/emails', user.ensureAuthenticated, emails.startEmail);

var images = require('./server/controllers/images')(api);
app.get('/images', user.ensureAuthenticated, images.get);
app.get('/images/:name/:userid/:emailid*?', images.get);
app.get('/images/:name', images.get);
app.post('/api/images/:name', user.ensureAuthenticated, images.create);

//status items
app.get('/api/status/users', user.ensureAuthenticated, user.checkPerformDownloadStatus);
app.get('/api/status/emails', user.ensureAuthenticated, emails.getStatus);

var server = app.listen(3000, function() {
    console.log('Craftyn Email Application'.cyan + ' started on:'.yellow + ' %s'.red, server.address().port);
});

//clean up anything when the server goes down
require('./cleanup').CleanUp(function() {
    console.log('Going down!'.red);
    return true;
});
