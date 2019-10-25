const util = require('../lib/mtd-util');
const security = require('../lib/mtd-security');

var args = util.commandLineArgs;

var secret = args.data[0];
var token = args.data[1];

var otp = security.generateOtp(secret);
console.log(otp);
var ok = security.validateOtp(secret, token, false);
console.log(ok);
/*
util.makeQR('david', secret, (err, url) => {
    console.log(url);
});
*/