'use strict';

const superAgent = require('superagent');
var mtd = require("../../lib/mtd-service");
var config = require('../../lib/mtd-config');
var util = require('../../lib/mtd-util');
var db = require('../../lib/mtd-db');
var bodyParser  = require('body-parser');

var express = require('express');
var router = express.Router();

router.use(bodyParser.urlencoded());

var Handlers = {
    createIndividualTestUser: storeTestUser,
    createOrgTestUser: storeTestUser,
    createAgentTestUser: storeTestUser,
    submitVatReturn: storeVatSubmission
};

router.get('/', (req,res) => {
    res.render('index');
});

/**
 * invoked by oauth server when user has been authorised
 */
router.get('/oauthCallback', (req, res) => {
    console.log('oauthCallback() code='+req.query.code);
    db.getOauthConfig(req.user,oauthConfig => {
        const options = {
            redirect_uri: oauthConfig.redirectUri,
            client_id: oauthConfig.clientId,
            client_secret: oauthConfig.clientSecret,
            code: req.query.code,
            grant_type: 'authorization_code'
        };

        const oauth2 = mtd.oauth2(oauthConfig);
        console.log('Requesting token with options: ', util.dump(options));
        oauth2.authorizationCode.getToken(options)
            .then((result) => {
                console.log('Got token: ', result);
                // save token on session and return to calling page
                req.session.oauth2Token = result;
                var caller = req.session.caller || './../';
                delete req.session.caller;
				console.log('redirect => %s', caller);
                res.redirect(caller);
            })
            .catch(e => {
                console.log('Caught error '+util.dump(e));
                var err = "Failed to obtain access token: " +
                    (e.data && e.data.payload ? e.data.payload.error_description : e);
                res.render('serviceResponse', {
                    err: err
                });
            });
    });
});

/**
 * generic service invocation entry point
 */
router.get('/:serviceName', (req, res) => {
    var serviceName = req.params.serviceName;
    var service = mtd.myService(serviceName);
    if (!service) {
        res.render('service', {
            err: 'Invalid service'
        });
        return;
    }

    console.log('service '+serviceName+'='+JSON.stringify(service));
    db.getOauthConfig(req.user).then(oauthConfig => {
        console.log('oauthConfig='+util.dump(oauthConfig));
        if (!oauthConfig || util.hasNull(oauthConfig)) {
            req.session.caller = './..' + req.originalUrl;
			var url = './../admin/oauthConfig';
			console.log('redirect => %s', url);
            res.redirect(url);
            return;
        }

        if (service.access === 'user') {
            ensureOauthAccessToken(req, res, oauthConfig, service);
        }

        if (service.method == 'GET') {
            if (service.request) {
                res.render('service', {
                    service: service,
                    query: req.query
                });
            } else {
                db.getAppConfig(req.user).then(appConfig => {
                    callApi(req, res, service, oauthConfig, appConfig);
                });
            }
        } else {
            res.render('service', {
                service: service,
                query: req.query
            });
        }
    }).catch(err => {
        console.log('Uncaught %s:\n%s', err, err.stack);
        var err = err.message + (config.env === 'test' ? ' ' + err.stack : '');
        res.render('serviceResponse', {
            err: err
        });
    });
});

router.post('/:serviceName', (req, res) => {
    var serviceName = req.params.serviceName;
    var service = mtd.myService(serviceName);
    if (!service) {
        res.render('service', {
            err: 'Invalid service'
        });
        return;
    }

    console.log('service '+serviceName+'='+JSON.stringify(service));

    var validationError = validateForm(req, service);
    if (validationError && Object.keys(validationError).length > 0) {
        res.render('service', {
            service: service,
            query: req.body,
            err: validationError
        });
        return;
    }

    db.getOauthConfig(req.user).then(oauthConfig => {
        console.log('oauthConfig='+util.dump(oauthConfig));
        if (!oauthConfig || util.hasNull(oauthConfig)) {
			var url = './../admin/oauthConfig';
			console.log('redirect => %s', url);
            res.redirect(url);
            return;
        }

        db.getAppConfig(req.user).then(appConfig => {
            callApi(req, res, service, oauthConfig, appConfig);
        }).catch(err => {
            console.log('Uncaught %s:\n%s', err, err.stack);
            res.render('serviceResponse', {
                err: err
            });
        });
    }).catch(err => {
        console.log('Uncaught %s:\n%s', util.inspect(err), err.stack);
        res.render('serviceResponse', {
            err: err
        });
    });
});

function callApi(req, res, service, oauthConfig, appConfig) {
    try {
        console.log('callApi => appConfig='+JSON.stringify(appConfig));
        const fullUrl = mtd.fullUrl(oauthConfig.host, service, req, appConfig);
        var apiReq;

        var opts = {};
        for (var k in service.request) {
            if (fullUrl.indexOf('req.body.'+k) < 0) {
                opts[k] = service.request[k] === 'boolean' ? req.body[k] === 'true' :
                    req.body[k];
            }
        }
        console.log('callApi => '+fullUrl+'<='+JSON.stringify(opts));

        if (service.method == 'GET') {
            apiReq = superAgent.get(fullUrl)
                .query(opts);
        } else if (service.method == 'POST') {
            apiReq = superAgent.post(fullUrl)
                .send(opts);
        }

        if (service.access === 'app') {
            console.log('callApi => Using server token: '+oauthConfig.serverToken);
            apiReq.set('Authorization', 'Bearer '+oauthConfig.serverToken);
        } else if (service.access === 'user') {
            const oauth2 = mtd.oauth2(oauthConfig);
            var accessToken = oauth2.accessToken.create(req.session.oauth2Token);
            apiReq.set('Authorization', 'Bearer '+accessToken.token.access_token);
        }

        populateFraudPreventionHeaders(appConfig, req, apiReq);

        const acceptHeader = 'application/vnd.hmrc.1.0+json';
        console.log('callApi => Calling '+fullUrl+' with Accept: '+acceptHeader);
        apiReq
            .accept(acceptHeader)
            .end((err, callRes) => handlerServiceCallResponse(service, req, res, err, callRes));

    } catch (e) {
        console.log('Unhandled exception:%s\n%s', util.inspect(e), e.stack);
        res.render('serviceResponse', {
            err: e
        });
    }
}

function populateFraudPreventionHeaders(appConfig, req, apiReq) {
    var ts = req.session.loginTimestamp;
    var tsOffset = (new Date().getTimezoneOffset() / 60) * -1;
    console.log('TimeZoneOffset='+tsOffset);
    apiReq.set('Gov-Client-Connection-Method', 'WEB_APP_VIA_SERVER');
    apiReq.set('Gov-Client-Public-IP', req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddres || '');
    apiReq.set('Gov-Client-Public-Port', req.connection.remotePort ||
        req.socket.remotePort ||
        req.connection.socket.remotePort || '');
    apiReq.set('Gov-Client-Device-ID', req.user);
    apiReq.set('Gov-Client-User-IDs', 'os='+req.user);
    apiReq.set('Gov-Client-Timezone', 'UTC'+(tsOffset >= 0 ? '+' : '')+tsOffset);
    apiReq.set('Gov-Client-Local-IPs', '');
    apiReq.set('Gov-Client-MAC-Addresses', '');
    apiReq.set('Gov-Client-Screens', '');
    apiReq.set('Gov-Client-Window-Size', '');
    apiReq.set('Gov-Client-User-Agent', req.headers['user-agent']);
    apiReq.set('Gov-Client-Browser-Plugins', '');
    apiReq.set('Gov-Client-Browser-JS-User-Agent', req.headers['user-agent']);
    apiReq.set('Gov-Client-Browser-Do-Not-Track', 'false');
    apiReq.set('Gov-Client-Multi-Factor', 'type=AUTH_CODE&timestamp='+ts+'&unique-reference='+
        req.user+',type=TOTP&timestamp='+ts+'&unique-reference='+req.session.loginOtp);
    apiReq.set('Gov-Vendor-Version', '');
    apiReq.set('Gov-Vendor-License-IDs', '');
    apiReq.set('Gov-Vendor-Public-IP', '');
    apiReq.set('Gov-Vendor-Forwarded', '');
}

function handlerServiceCallResponse(service, req, res, err, callRes) {
    var cb = function(err, entity) {
        console.log('Post handler call returned service='+service.name);
        res.render('serviceResponse', {
            err: err,
            query: req.body,
            callRes: callRes,
            service: service
        });
    };

    if (err) {
        console.log('API call ('+service.name+') error '+JSON.stringify(err, null, 4));
        if (Handlers.hasOwnProperty(service.name)) {
            console.log('Invoking post API call handler');
            Handlers[service.name](service, req, err, callRes,  cb);
        } else {
            console.log('No post API call handler defined for %s', service.name);
            cb(err);
        }
    } else {
        console.log('API call ('+service.name+')=>'+JSON.stringify(callRes, null, 4));
        if (Handlers.hasOwnProperty(service.name)) {
            console.log('Invoking post API call handler');
            Handlers[service.name](service, req, err, callRes,  cb);
        } else {
            console.log('No post API call handler defined for %s', service.name);
            cb();
        }
    }
}

function validateForm(req, service) {
    console.log('form='+util.inspect(req.body));
    var error = {};
    if (!service.hasOwnProperty('request')) {
        return error;
    }
    for (var k in service.request) {
        if (!req.body.hasOwnProperty(k) || !req.body[k]) {
            error[k] = 'not specified';
        } else {
            var v = req.body[k];
            var type = service.request[k];
            console.log(k+'='+v+'('+type+')');
            if (type === 'number') {
                if (isNaN(v)) {
                    error[k] = 'not a number';
                }
            } else if (type === 'date') {
                var n = Date.parse(v);
                if (isNaN(n)) {
                    error[k] = 'not a date';
                }
            }
        }
    }
    return error;
}

function ensureOauthAccessToken(req, res, oauthConfig, service) {
    const oauth2 = mtd.oauth2(oauthConfig);
    if (req.session.oauth2Token){
        var accessToken = oauth2.accessToken.create(req.session.oauth2Token);

        if(accessToken.expired()){
            console.log('Token expired: ', accessToken.token);
            accessToken.refresh()
                .then((result) => {
                    console.log('Refreshed token: ', result.token);
                    req.session.oauth2Token = result.token;
                })
                .catch((error) => {
                    console.log('Error refreshing token: ', error);
                    res.send(error);
                });
        } else {
            console.log('Using token from session: ', accessToken.token);
        }
    } else {
        console.log('Need to request token');
        req.session.caller = './..' + req.originalUrl;
        var opts = {
            redirect_uri: oauthConfig.redirectUri,
            response_type: 'code',
            scope: mtd.allScopes(service),
        };
        console.log('Request authorisation code with '+JSON.stringify(opts));
        var authorizationUri = oauth2.authorizationCode.authorizeURL(opts);
        res.redirect(authorizationUri);
    }
}

/**
 * handler for successful creation of test user
 *
 * @param service
 * @param callRes
 * @param cb
 */
function storeTestUser(service, req, err, callRes, cb) {
    if (callRes) {
        return db.storeTestUser(req.user, callRes.body, cb);
    } else {
        cb(err, callRes);
    }
}

/**
 * handler for successful VAT submission
 * @param service
 * @param callRes
 * @param cb
 */
function storeVatSubmission(service, req, err, callRes, cb) {
    var submission = {
        request: req.body
    };
    if (err) {
        submission.err = err.response.text;
    } else if (callRes) {
        submission.response = callRes.body;
    }
    return db.storeVatSubmission(req.user, submission, cb);
}

module.exports = router;
