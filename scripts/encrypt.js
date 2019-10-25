var util = require('../lib/mtd-util');
var crypto = require('crypto');

var args = util.commandLineArgs;

var secret = 'Transcraft-MTD';
let key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);

var iv = new Buffer(crypto.randomBytes(8));
var ivstring = iv.toString('hex');

const cipher = crypto.createCipheriv('aes-256-ctr', key, ivstring);


var encrypted = cipher.update(args.data[0], 'utf8','hex') +
    cipher.final('hex');

console.log(ivstring+':'+encrypted);