var util = require('../lib/mtd-util');

var args = util.commandLineArgs;
var secret = args.data[0];
var secureId = util.generateSecureId(secret);

console.log(secureId);
