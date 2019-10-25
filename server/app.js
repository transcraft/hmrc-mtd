var express = require("express");
var path = require('path');
var morgan = require('morgan');
var cookieSession = require("cookie-session");
var passport = require('passport');
var flash = require("connect-flash");

var mtd = require("../lib/mtd-service");
var config = require('../lib/mtd-config');
var util = require('../lib/mtd-util');
var db = require('../lib/mtd-db');

var serviceRouter = require('./routes/services');
var adminRouter = require('./routes/admins');
var reportRouter = require('./routes/reports');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded());
app.use(cookieSession({
    name: 'session',
    keys: ['oauth2Token', 'caller', 'error'],
    maxAge: 10 * 60 * 60 * 1000 // 10 hours
}));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals = {
        mtdEnv: config.env,
        menu: mtd.myMenu(),
        util: util,
        mtd: mtd,
        user: req.user,
        req: req,
        err: req.flash()
    };
    next();
});

app.use(express.static('public'));
app.use(morgan('combined'));
app.use('/service', serviceRouter);
app.use('/admin', adminRouter);
app.use('/report', reportRouter);

app.get('/', (req, res) => {
    res.render('index');
});

module.exports = app;
