'use strict';

var util = require('../../lib/mtd-util');
var security = require('../../lib/mtd-security');
var config = require('../../lib/mtd-config');
var db = require('../../lib/mtd-db');
const superAgent = require('superagent');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var bodyParser  = require('body-parser');

const RECAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify';

passport.use('otp-local', new Strategy({
        passReqToCallback: true,
        passwordField: 'secret',
    }, (req, foo, bar, done) => {
        var user = req.body.username;
        console.log('Authenticating user %s, otp %s ', user, req.body.otp);
        db.getAppConfig(user, appConfig => {
            security.verifyPassword(req.body.secret, appConfig.secret, (err, ok) => {
               if (ok == false) {
                   return done('Authentication failed (code 0x900)');
               } else {
                   if (security.validateOtp(security.makeSecret(user, appConfig.otpSeed, true),
                       req.body.otp, true)) {
                       req.session.loginTimestamp = new Date().toISOString();
                       req.session.loginOtp = appConfig.otpSeed;
                       return done(null, user);
                   } else {
                       return done('Authentication failed (code 0x913)');
                   }
               }
            });
        });
    })
);

passport.serializeUser(function(user, cb) {
    console.log('serialise %s', user);
    cb(null, user);
});

passport.deserializeUser(function(id, cb) {
    console.log('deserialise '+id);
    cb(null, id);
});

var express = require('express');
var router = express.Router();

router.use(bodyParser.json());

router.get('/', (req,res) => {
    res.render('index');
});

router.get('/login', (req,res) => {
    res.render('login');
});

router.post('/login', (req, res, next) => {
    passport.authenticate('otp-local', (err, user, info, status) => {
        console.log('authenticate()=>%s,%s,%s,%s', err, user, info, status);
        if (err) {
            console.log('User log in failed: %s', err);
            return res.render('login', { err: err });
        }
        if (!user) {
            var url = './login';
            console.log('User log in failed, no user => %s', url);
            return res.redirect(url);
        }
        req.logIn(user, (err) => {
            var url = './../';
            console.log('%s log in ok => %s', user, url);
            return res.redirect(url);
        });
    })(req, res, next);
});

router.get('/createUser', (req,res) => {
    res.render('createUser', { recaptchaKey: config.myConfig.recaptchaSiteKey });
});

router.post('/createQR', (req, res) => {
    var user = req.user ? req.user : req.body.username;
    var secret = security.stringToHashCode(req.body.secret);
    security.makeQR(config.title, user, secret, (err, data) => {
        res.json(data);
    });
});

router.post('/createUser', (req,res) => {
    var recaptchaToken = req.body['g-recaptcha-response'];
    console.log('recaptcha token %s', recaptchaToken);
    if (!recaptchaToken) {
        res.render('createUser', { recaptchaKey: config.myConfig.recaptchaSiteKey });
        return;
    }
    var opts = {
        secret: config.myConfig.recaptchaSecretKey,
        response: recaptchaToken
    };
    console.log('recaptchaRequest=%s', JSON.stringify(opts, null, 4));
    superAgent.post(RECAPTCHA_URL)
        .type('form')
        .send(opts)
        .then(recapchaRes => {
            console.log('recaptchaRes=%s', JSON.stringify(recapchaRes.body, null, 4));
            if (recapchaRes.body.success) {
                doCreateUser(req, res);
            } else {
                res.render('createUser', { recaptchaKey: config.myConfig.recaptchaSiteKey });
            }
        })
        .catch(err => {
            console.log('Can not verify recaptcha: %s', err);
            res.render('createUser', { recaptchaKey: config.myConfig.recaptchaSiteKey });
        });
});

function doCreateUser(req, res) {
    var errors = [];
    if (!req.body.username) {
        errors.push('No user name specified');
    }
    if (!req.body.qrDone) {
        console.log('qrDone=%s', req.body.qrDone);
        errors.push('You need to tick the box to indicate you have set up the QR code on your authenticator app');
    }
    if (req.body.secret !== req.body.secret2) {
        errors.push('Password and password (again) fields are not the same');
    }
    if (/[@]/.test(req.body.email)) {
    } else {
        errors.push('Invalid email');
    }
    security.validatePasswordRules(req.body.secret, errors);

    var user = req.body.username;
    db.getAppConfig(user, appConfig => {
        if (appConfig) {
            console.log('User already exists %s', JSON.stringify(appConfig));
            errors.push('Invalid user specified');
        }
        if (errors.length > 0) {
            res.render('createUser', { err: errors, recaptchaKey: config.myConfig.recaptchaSiteKey });
            return;
        }

        appConfig = makeAppConfig(req);
        security.generatePassword(req.body.secret, (err, pw) => {
            appConfig.secret = pw;
            appConfig.otpSeed = security.stringToHashCode(req.body.secret);
            db.storeAppConfig(user, appConfig, (err, newAppConfig) => {
                if (err) {
                    res.render('createUser', { err: err, recaptchaKey: config.myConfig.recaptchaSiteKey });
                    return;
                }
                var url = './login';
                console.log('redirect => %s', url);
                res.redirect(url);
            });
        });
    });
}

router.get('/logout', (req,res) => {
    if (req.user) {
        console.log('User '+req.user+' logged out');
        delete req.session.user;
        // force a log out of HMRC too
        delete req.session.oauth2Token;
        req.logout();
    }
    var url = './../';
    console.log('redirect => %s', url);
    res.redirect(url);
});

router.get('/resetToken', (req, res) => {
    try {
        delete req.session.oauth2Token;
        res.render('index', { err: 'Token has been reset' });
    } catch(e) {
        res.render('index', { err: e });
    }
});

/**
 * all these parameters have to be non-null to proceed with service calls
 * @param req
 * @returns {{redirectUri: *, clientId: string, host: *, clientSecret: *, serverToken: *}}
 */
function makeOauthConfig(req) {
    console.log('headers=%s,baseUrl=%s,originalUrl=%s',JSON.stringify(req.headers), req.baseUrl, req.originalUrl);
    var url = req.headers.referrer;
    try {
        var url = req.headers.referrer;
        var idx = url.indexOf(req.baseUrl);
        if (idx >= 0) {
            url = url.substring(0, idx + req.baseUrl + '/');
        }
    } catch(e) {
        /*
         * really annoying having to hardcode the proxied path here, but not sure how to derive it (yet)
         */
        url = req.protocol + '://' + req.headers.host
            + (req.headers.hasOwnProperty('x-forwarded-host') ? '/mtd' : '')
            + '/service';
    }
    url = url + '/oauthCallback';
    console.log('redirectUri=%s', url);
    return {
        host: req.body.host,
        clientId: req.body.clientId,
        clientSecret: req.body.clientSecret,
        serverToken: req.body.serverToken,
        redirectUri: url
    };
}

function makeAppConfig(req) {
    return {
        email: req.body.email,
        vrn: req.body.vrn,
        ctUtr: req.body.ctUtr,
        empRef: req.body.empRef,
        mtdVrn: req.body.mtdVrn,
        mtdItId: req.body.mtdItId,
        nino: req.body.nino,
        saUtr: req.body.saUtr
    };
}

/**
 * all methods from here are are protected. They are only accessible for logged in users
 * *************************************************************************************
 */

router.all('*', (req,res,next) => {
    if (req.user) {
        console.log('user is ' + req.user);
        return next();
    } else {
        var url = './login';
        console.log('Not logged in, redirect => %s', url);
        res.redirect(url);
    }
});

router.get('/oauthConfig', (req, res) => {
    db.getOauthConfig(req.user,oauthConfig => {
        console.log('loaded oauth='+JSON.stringify(oauthConfig));
        if (!oauthConfig) {
            oauthConfig = makeOauthConfig(req);
        }
        res.render('oauthConfig', {
            oauth: oauthConfig
        });
    });
});

router.post('/oauthConfig', (req, res) => {
    var oauthConfig = makeOauthConfig(req);
    console.log('posted oauth '+JSON.stringify(oauthConfig));
    if (util.hasNull(oauthConfig)) {
        res.render('oauthConfig', { err: 'All fields must be filled in' });
    } else {
        db.storeOauthConfig(req.user, oauthConfig, (err, newOauth) => {
            if (err) {
                res.render('oauthConfig', { err: err });
                return;
            }
            var page = req.session.caller || '';
            delete req.session.caller;
            var url = './' + page;
            console.log('redirect => %s', url);
            res.redirect(url);
        });
    }
});

router.get('/appConfig', (req, res) => {
    db.getAppConfig(req.user,appConfig => {
        console.log('loaded appConfig='+JSON.stringify(appConfig));
        res.render('appConfig', {
            appConfig: appConfig
        });
    });
});

router.post('/appConfig', (req, res) => {
    db.getAppConfig(req.user,appConfig => {
        var newAppConfig = makeAppConfig(req);
        for (var k in newAppConfig) {
            if (newAppConfig[k]) {
                appConfig[k] = newAppConfig[k];
            }
        }
        console.log('posted appConfig ' + JSON.stringify(appConfig));
        var errors = [];
        if (errors.length > 0) {
            res.render('appConfig', {err: errors});
            return;
        }
        db.storeAppConfig(req.user, appConfig, (err, newAppConfig) => {
            if (err) {
                res.render('appConfig', {err: err});
                return;
            }
            var page = req.session.caller || '';
            delete req.session.caller;
            var url = './' + page;
            console.log('redirect => %s', url);
            res.redirect(url);
        });
    });
});

router.get('/deleteTestUser/:testUser', (req, res) => {
    var testUser = req.params.testUser;
    db.deleteTestUser(req.user, testUser, (err, users) => {
        res.render('testUsers', {
            users: users
        });
    });
});

router.get('/updatePassword', (req, res) => {
    db.getAppConfig(req.user,appConfig => {
        console.log('loaded appConfig='+JSON.stringify(appConfig));
        res.render('updatePassword', {
            appConfig: appConfig
        });
    });
});

router.post('/updatePassword', (req, res) => {
    db.getAppConfig(req.user,appConfig => {
        var errors = [];
        security.verifyPassword(req.body.oldSecret, appConfig.secret, (err, ok) => {
            if (ok == false) {
                errors.push('Old password incorrect');
            }
            if (req.body.oldSecret === req.body.secret) {
                errors.push('New password must be different to old password');
            }
            if (!req.body.qrDone) {
                errors.push('You need to tick the box to indicate you have set up the QR code on your authenticator app');
            }
            if (req.body.secret !== req.body.secret2) {
                errors.push('Password and password (again) fields are not the same');
            }
            if (/[@]/.test(req.body.email)) {
            } else {
                errors.push('Invalid email');
            }
            security.validatePasswordRules(req.body.secret, errors);
            if (errors.length > 0) {
                res.render('updatePassword', { err: errors, appConfig: appConfig });
                return;
            }
            security.generatePassword(req.body.secret, (err, pw) => {
                appConfig.secret = pw;
                appConfig.otpSeed = security.stringToHashCode(req.body.secret);
                appConfig.email = req.body.email;
                db.storeAppConfig(req.user, appConfig, (err, newAppConfig) => {
                    if (err) {
                        res.render('updatePassword', { err: err, appConfig: appConfig });
                        return;
                    }
                    var url = './logout';
                    console.log('redirect => %s', url);
                    res.redirect(url);
                });
            });
        });
    });
});

module.exports = router;
