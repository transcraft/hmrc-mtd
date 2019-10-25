const security = require('../lib/mtd-security');
const util = require('../lib/mtd-util');

var args = util.commandLineArgs;
var secret = args.data[0];

var otp = security.generateOtp(secret);
console.log(otp);
/*
util.makeQR('david', secret, (err, url) => {
    console.log(url);
});
 */
