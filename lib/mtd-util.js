const os = require('os');
const https = require('https');

var MY_PUBLIC_IP;

var TAXONOMY = {};

module.exports = {
    taxonomy: _addTaxonomy,
    prettifyCamelCase: _prettifyCamelCase,
    hasNull: _hasNull,
    dump: _dumpObj,
    buildUrl: _buildUrl,
    inspect: _inspect,
    commandLineArgs: parseCommandLine(),
    myIps: _getMyIps(),
    myIp: _getMyIp,
    myPublicIp: _getMyPublicIp,
};

/**
 * returns an array of all my IP addresses as [ { family, address, iface, mac }, ... ].
 * This is essentially a remap of os.networkIterfaces() into an easier structure to work with
 */
function _getMyIps() {
    return Object.keys(os.networkInterfaces())
        .map(iface => os.networkInterfaces()[iface]
            .map(entry => ({ address: entry.address, family: entry.family, iface: iface, mac: entry.mac }))
        )
        .reduce((a, b) => a.concat(b));
}

/**
 * return my IP address for the specified family. The family is expected to be 'IPv4' or 'IPv6'
 * 
 * @param {*} family 
 */
function _getMyIp(family) {
    return _getMyIps().filter(entry => entry.family === family && entry.iface !== 'lo')[0];
}

function _getMyPublicIp() {
    if (!MY_PUBLIC_IP) {
        https.get('https://myexternalip.com/raw', res => {
                res.setEncoding('utf8');
                res.on('data', ip => {
                    if (!MY_PUBLIC_IP) {
                        MY_PUBLIC_IP = ip; 
                        console.log('My public IP is %s', MY_PUBLIC_IP);
                    }
                });
            });
    }
    return MY_PUBLIC_IP;
}

// cache the value
_getMyPublicIp();

/**
 * dump the contents of a Http Response's body (JSON.stringify does not work because of cyclical references)
 * 
 * @param {*} obj 
 */
function _inspect(obj) {
    var buf = "";
    if (Array.isArray(obj)) {
        for (var i in obj) {
            buf += '['+i+']='+_inspect(obj[i])+"\n";
        }
    } else if (obj.constructor == Object) {
        buf += "{\n";
        for (var k in obj) {
            buf += k+':'+_inspect(obj[k])+"\n";
        }
        buf += "}\n";
    } else {
        buf += obj+'('+typeof(obj)+')';
    }
    return buf;
}

/**
 * similar to Java String.format()
 * 
 * @param {*} origUrl 
 * @param {*} params 
 */
function _buildUrl(origUrl, params) {
    for (var k in params) {
        eval('var '+k+'=params[k]');
    }
    var url = origUrl;
    var rxp = new RegExp('\{([^\}]+)\}', 'g');
    url = url.replace(rxp, (str, v) => {
        console.log('Substitute('+v+')=>'+eval(v));
        return eval(v);
    });
    return url;
}

/**
 * inject application specific Taxonomy into common dictionary. This is used to
 * display a more user friendly string instead of the property name itself
 * 
 * @param {*} taxonomy 
 */
function _addTaxonomy(taxonomy) {
    for (var k in taxonomy) {
        TAXONOMY[k] = taxonomy[k];
    }
}

/**
 * Changes camel case to a human readable format. So helloWorld, hello-world and hello_world becomes "Hello World".
 * */
function _prettifyCamelCase(str) {
    if (TAXONOMY.hasOwnProperty(str)) {
        return TAXONOMY[str];
    }

    var output = "";
    if (str) {
        var len = str.length;
        var char;

        for (var i=0 ; i<len ; i++) {
            char = str.charAt(i);

            if (i==0) {
                output += char.toUpperCase();
            }
            else if (char !== char.toLowerCase() && char === char.toUpperCase()) {
                output += " " + char;
            }
            else if (char == "-" || char == "_") {
                output += " ";
            }
            else {
                output += char;
            }
        }
    }
    return output;
}

function _isDate(v) {
    return Object.prototype.toString.call(v) === '[object Date]';
}

/**
 * mask out sensitive fields when dumping out in logs
 * 
 * @param {*} masked 
 * @param {*} k 
 * @param {*} v 
 */
function _doMask(masked, k, v) {
    if (!masked) { return v; }
    if (k.match(/password|secret/i)) {
        return "********";
    }
    if (v.toString().match(/mysql/)) {
        return v.replace(/:\/\/[^@]*@/, '://********@');
    }
    return v;
}

/**
 * dump the contents of a Http Request (JSON.stringify does not work because of cyclical references)
 *
 * @param {*} obj 
 * @param {*} attrs 
 */
function _dumpObj(obj, attrs) {
    return JSON.stringify(_toJsObj(obj, attrs, true), null, 4);
}


function _hasNull(obj) {
    for (var k in obj) {
        if (!obj[k] || obj[k] === "") {
            console.log('Key '+k+'('+obj[k]+') is null');
            return true;
        }
    }
    return false;
}

function _toJsObj(obj, attrs, masked, level) {
    if (!level) { level = 0; }
    var js = Array.isArray(obj) ? [] : {};
    for (var k in obj) {
        var v = obj[k];
        if (!v) continue;
        if (Object.prototype.toString.call(v) === '[object Array]') {
            if (level < 4) {
                js[k] = _toJsObj(v, attrs, masked, level + 1);
            }
        } else {
            if (!Array.isArray(obj) &&
                attrs && attrs.indexOf('all') < 0 && attrs.indexOf(k) < 0) {
                continue;
            }
            if (['number', 'string', 'boolean'].indexOf(typeof(v)) >= 0) {
                js[k] = _doMask(masked, k, v);
            } else if (_isDate(v)) {
                js[k] = v;
            } else if (v.constructor == Object) {
                if (level < 4) {
                    js[k] = _toJsObj(v, attrs, masked, level + 1);
                }
            }
        }
    }
    return js;
}

function parseCommandLine() {
    var args = {};
    for (var i = 2; i < process.argv.length; i++) {
        var token = process.argv[i];
        var matched = /--([^=]+)[=]?(.*)$/.exec(token);
        if (matched && matched.length > 1) {
            if (matched[2]) {
                args[matched[1]] = matched[2];
            } else {
                args[matched[1]] = true;
            }
        } else {
            if (!args.data) {
                args.data = [];
            }
            args.data.push(token);
        }
    }
    return args;
}
