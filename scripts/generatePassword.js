const security = require('../lib/mtd-security');
const util = require('../lib/mtd-util');

var args = util.commandLineArgs;
var secret = args.data[0];

security.generatePassword(secret, (err,pw) => {
    if (err) {
        console.log('Error: %s', err);
    } else {
        console.log(pw);
    }
});
