var assert = require('assert');
var async = require('async');
var nock = require('nock');
var request = require('request');
var ciphertoken = require('ciphertoken');
var dao = require('../dao.js');
var cipherlayer = require('../cipherlayer');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));

var accessTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration * 60
};

describe('Redirect', function(){

    beforeEach(function(done){
        cipherlayer.start(config.public_port, config.private_port, function (err) {
            assert.equal(err, null);
            dao.deleteAllUsers(function (err) {
                assert.equal(err, null);
                done();
            });
        });
    });

    afterEach(function(done){
        cipherlayer.stop(done);
    });


    it('OK', function(done){

        var redirectURL = 'http://www.google.es';

        var expectedUser = {
            id:'a1b2c3d4e5f6',
            username:'user1',
            password:'pass1'
        };
        dao.addUser(expectedUser, function(err,createdUser) {
            assert.equal(err, null);
            assert.notEqual(createdUser, null);

            ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {

                var options = {
                    url: 'http://localhost:' + config.public_port + '/whatever',
                    method: 'POST',
                    followRedirect: false,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Authorization': 'bearer ' + loginToken
                    }
                };
                options.headers[config.version.header] = "test/1";

                nock('http://localhost:' + config.private_port)
                    .post('/whatever')
                    .reply(302, 'Redirecting', {
                        'Location': redirectURL
                    });

                request(options, function (err, res, body) {
                    assert.equal(err, null, body);
                    assert.equal(res.statusCode, 302, body);
                    assert.equal(res.headers.location, redirectURL, 'Bad redirect URL');
                    done();
                });
            });

        });

    });
});
