'use strict';

const fs = require("fs");
const path = require("path");

module.exports = {
    myConfig: myConfig(),
    env: myEnv(),
    port: myPort(),
    title: myTitle(),
    startupFolder: myStartupFolder(),
    dataFolder: myDataDir(),
    absPath: makeAbsPath
};

function myStartupFolder() {
    return path.join(__dirname, '../');
}

function makeAbsPath(dir) {
    if (!dir) {
        return dir;
    }
    if (dir.startsWith('/')) {
        return dir;
    } else {
        return path.join(myStartupFolder(), dir);
    }
}

function myTitle() {
    return "[" + myEnv() + "] " + (myConfig().title || "Transcraft MTD");
}

function myEnv() {
    return process.env.MTD_ENV || 'dev';
}

function myPort() {
    return process.env.MTD_PORT || '3030';
}

function myDataDir() {
    return path.join(__dirname, '../data');
}

function myConfigDir() {
    return path.join(__dirname, '../config');
}

function myConfig() {
    if (myConfig.cached) {
        return myConfig.cached;
    }
    var dataDir = myDataDir();
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, '0700');
    }
    var config = {
        admin: process.env['USER'],
        dataDir: dataDir
    };

    mergeConfigFile(config, 'mtd-' + myEnv());

    console.log('my config ' + JSON.stringify(config));

    myConfig.cached = config;
    return config;
}

function mergeConfigFile(config, bn) {
    var envConfigFile = path.join(myConfigDir(), bn + '.json');
    if (fs.existsSync(envConfigFile)) {
        console.log('Merge config with ' + envConfigFile);
        var envConfig = require(envConfigFile);
        for (var k in envConfig) {
            config[k] = envConfig[k];
        }
    } else {
        console.log('%s not found', envConfigFile);
    }
}
