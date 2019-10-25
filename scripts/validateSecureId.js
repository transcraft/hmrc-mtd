var util = require('../lib/mtd-util');

var args = util.commandLineArgs;

var secret = args.data[0];
var secureId = args.data[1];

var ok = util.validateSecureId(secret, secureId);

console.log(ok ? 'ok' : 'failed');
