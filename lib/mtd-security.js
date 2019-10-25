var gen = require('random-seed');
const base32encode = require('base32-encode');
const authenticator = require('authenticator');
var QRCode = require('qrcode');
var bcrypt = require('bcrypt');

const SECUREID_RANGE = 1000000;
const SALT = 10;

module.exports = {
    validatePasswordRules: _validatePasswordRules,
    generateOtp: _generateOtp,
    validateOtp: _validateOtp,
    makeSecret: _makeSecret,
    makeQR: _makeQR,
    generateSecureId: _generateSecureId,
    validateSecureId: _validateSecureId,
    generatePassword: _generatePasswordHash,
    verifyPassword: _verifyPasswordHash,
    stringToHashCode: _stringToHashCode,
};

function _stringToHashCode(str) {
    return str.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
}

function _generatePasswordHash(rawPassword, cb) {
    bcrypt.hash(rawPassword, SALT, (err, pw) => {
        if (err) {
            cb(err);
        } else {
            cb(null, Buffer.from(pw).toString('hex'));
        }
    });
}

function _verifyPasswordHash(rawPassword, hash, cb) {
    bcrypt.compare(rawPassword, new Buffer(hash, 'hex').toString('ascii'), (err1, res) => {
        if (err1) {
            cb(err1);
        } else {
            cb(null, res);
        }
    });
}

function _makeQR(issuer, user, password, cb) {
    var url = authenticator.generateTotpUri(_makeSecret(user, password, true),
        user, issuer, 'SHA1', 6, 30);
    console.log('makeQR(%s)', url);
    QRCode.toDataURL(url, (err, qr) => {
        var data = {
            qr: qr,
            url: url
        };
        cb(null, data);
    });
}

function _makeSecret(user, password, encode) {
    var token = user+':'+password;
    var secret = encode ? _encodeSecret(token) : secret;
    console.log('makeSecret(%s)=%s', token, secret);
    return secret;
}

function _generateOtp(secret) {
    return authenticator.generateToken(_encodeSecret(secret));
}

function _validateOtp(secret, token, encoded) {
    var key = encoded ? secret : _encodeSecret(secret);
    console.log('validateOtp(%s)', key);
    var ok = authenticator.verifyToken(key, token);
    return ok && ok.hasOwnProperty('delta') ? true : false;
}

function  _encodeSecret(secret) {
    var key = secret.toUpperCase();
    if (key.length < 16) {
        var pad = '';
        for (var i = 0; i < 16 - key.length; i++) {
            pad = pad + '0';
        }
        key = key + pad;
    }
    return base32encode(Buffer.from(key), 'RFC3548');
}

function _generateSecureId(secret, range) {
    var rand = gen.create(secret);

    var steps = _getSteps();

    if (!range) {
        range = SECUREID_RANGE;
    }

    for (var i = 0; i < steps; i++) {
        rand(range);
    }

    return rand(range);
}

function _validateSecureId(secret, secureId, range) {
    var rand = gen.create(secret);

    var steps = _getSteps();

    if (!range) {
        range = SECUREID_RANGE;
    }

    for (var i = 0; i < (steps - 1); i++) {
        rand(range);
    }

    var valids = [
        rand(range),
        rand(range),
        rand(range)
    ];
    return valids.includes(parseInt(secureId));
}

function _validatePasswordRules(pw, errors) {
    if (/[A-Z]+/.test(pw) &&
        /[0-9]+/.test(pw) &&
        /[a-z]+/.test(pw) &&
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(pw)) {
    } else {
        errors.push('Password must have upper/lower case and numeric and at least one special character');
    }
    if (pw.length < 8) {
        errors.push('Password too short, length nust be at least 8 characters');
    }
}

/**
 * return the steps into the PRNG, using the clock. This value increments
 * every minute
 * @returns {number}
 * @private
 */
function _getSteps() {
    var today = new Date();
    return today.getFullYear() - 2000 + today.getMonth() +
        today.getDay() + today.getHours() + today.getMinutes();
}

