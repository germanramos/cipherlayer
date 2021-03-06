var debug = require('debug')('cipherlayer:service');
var restify = require('restify');
var async = require('async');
var fs = require('fs');
var path = require('path');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var passport = require('passport');

var userDao = require('./dao');
var redisMng = require('./managers/redis');

var printTraces = require('./middlewares/traces.js');
var checkAuthHeader = require('./middlewares/authHeader.js');
var decodeToken = require('./middlewares/decodeToken.js');
var findUser = require('./middlewares/findUser.js');
var prepareOptions = require('./middlewares/prepareOptions.js');
var platformsSetUp = require('./middlewares/platformsSetUp.js');
var propagateRequest = require('./middlewares/propagateRequest.js');
var checkAccessTokenParam = require('./middlewares/accessTokenParam.js');
var checkVersion = require('./middlewares/version.js');

var server;

function startDaos(cbk){
    userDao.connect(function(){
        cbk();
    });
}

function stopDaos(cbk){
    userDao.disconnect(function(){
        cbk();
    });
}

function startRedis(cbk){
    redisMng.connect(function(){
        cbk();
    });
}

function stopRedis(cbk){
    redisMng.disconnect(function(){
        cbk();
    });
}

function startListener(publicPort, privatePort, cbk){
    server = restify.createServer({
        name: 'cipherlayer-server'
    });

    server.use(restify.queryParser());
    server.use(restify.bodyParser({maxBodySize: 1024 * 1024 * 3}));
    server.use(function(req,res,next){
        debug('> ' + req.method + ' ' + req.url);
        next();
    });

    server.on('after', function(req, res, route, error){
        var timing = Date.now() - new Date(req._time);
        debug('< ' + res.statusCode + ' ' + res._data + ' ' + timing + 'ms');
    });

    server.on('uncaughtException', function(req, res, route, error) {
        var timing = Date.now() - new Date(req._time);
        debug('< ' + res.statusCode + ' ' + error + ' ' + timing + 'ms');
        res.send(500, {err:'internal_error', des: 'uncaught exception'});
    });

    var routesPath = path.join(__dirname, './routes/');
    fs.readdirSync(routesPath).forEach(function(filename) {
        require(routesPath + filename)(server);
    });

    var platformsPath = path.join(__dirname, '/platforms/');
    fs.readdirSync(platformsPath).forEach(function(filename) {
        require(platformsPath + filename).addRoutes(server, passport);
    });

    server.get(/(.*)/, checkVersion, checkAccessTokenParam, checkAuthHeader, decodeToken, findUser, prepareOptions, platformsSetUp, printTraces, propagateRequest);
    server.post(/(.*)/, checkVersion, checkAccessTokenParam, checkAuthHeader, decodeToken, findUser, prepareOptions, platformsSetUp, printTraces, propagateRequest);

    server.use(function(req, res, next){
        debug('< ' + res.statusCode);
        next();
    });

    server.listen(publicPort, function(){
        cbk();
    });
}

function stopListener(cbk){
    server.close(function(){
        cbk();
    });
}

function start(publicPort, privatePort, cbk){
    async.series([
        startDaos,
        startRedis,
        function(done){
            startListener(publicPort, privatePort, done);
        }
    ],function(err){
        cbk(err);
    });
}

function stop(cbk){
    async.series([
        stopDaos,
        stopRedis,
        stopListener
    ],function(err){
        cbk(err);
    });
}

module.exports = {
    start : start,
    stop : stop
};
