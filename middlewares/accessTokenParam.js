var debug = require('debug')('cipherlayer:service');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));

function checkAccessTokenParam (req, res, next){
    var paramAT = req.params.at;

    if(paramAT){
        req.headers.authorization = config.authHeaderKey + paramAT;
    }

    next();
}

module.exports = checkAccessTokenParam;
