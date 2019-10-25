const util = require('../lib/mtd-util');
const security = require('../lib/mtd-security');

var args = util.commandLineArgs;

var secret = args.data[0];
var hash = args.data[1];

security.generatePassword(secret, (err,pw) => {
    if (err) {
        console.log('Error: %s', err);
    } else {
        console.log('pw=%s',pw);
    }

    security.verifyPassword(secret, hash, (err,ok) => {
        if (err) {
            console.log('Error: %s', err);
        } else {
            console.log('ok=%s',ok);
        }
    });
});

/*
const bcrypt = require('bcrypt');
const saltRounds = 10;
const myPlaintextPassword = secret;
bcrypt.hash(myPlaintextPassword, saltRounds, function(err, hash) {
    console.log('Hash:%s', hash);
    bcrypt.compare(myPlaintextPassword, hash, function(err1, res) {
        console.log('Res:%s',res);
    });
});
*/
