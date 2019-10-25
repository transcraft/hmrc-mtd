'use strict';

var db = require('../../lib/mtd-db');

var express = require('express');
var router = express.Router();
var bodyParser  = require('body-parser');

router.use(bodyParser.urlencoded());

router.get('/testUsers', (req, res) => {
    db.getTestUsers(req.user,users => {
        res.render('testUsers', {
            users: users
        });
    });
});

router.get('/vatSubmissions', (req, res) => {
    db.getVatSubmissions(req.user,submissions => {
        res.render('submissions', {
            submissions: submissions
        });
    });
});

module.exports = router;
