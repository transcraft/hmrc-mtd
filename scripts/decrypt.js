var util = require('../lib/mtd-util');
var crypto = require('crypto');

var args = util.commandLineArgs;

var secret = 'Transcraft-MTD';
let key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);

var arr = args.data[0].split(':');
var iv = arr[0];
var encrypted = arr[1];

const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);

var decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');

console.log(decrypted);

