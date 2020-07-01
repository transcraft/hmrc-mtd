'use strict';
const os = require('os');
const publicIp = require('public-ip');
const { setTimeout } = require('timers');

let obj = Object.keys(os.networkInterfaces())
    .map(iface => os.networkInterfaces()[iface]
        .map(entry => ({ address: entry.address, family: entry.family, iface: iface, mac: entry.mac }))
    )
    .reduce((a, b) => a.concat(b));
console.log(obj.filter(entry => entry.family === 'IPv6' && entry.iface !== 'lo')[0]);

const util = require('../lib/mtd-util');

console.log('My public IP is %s', util.myPublicIp());
