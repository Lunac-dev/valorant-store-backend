const db = require("../db.js");
const express = require('express');
const router = express.Router();

const Valorant = require('../auth/main.js');

const rate = require('express-rate-limit');
var unlinklimiter = rate({
    windowMs: 60*60*1000,
    max: 1,
    standardHeaders: true,
    legacyHeaders: false,
    handler: function (_req, res, _next) {
        return res.status(200).json({
            Status: 'You sent too many unlink requests. Please wait a while then try again'
        })
    },
    keyGenerator: (req, _res) => req.headers["cf-connecting-ip"]
});

var limiter = rate({
    windowMs: 60*60*1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: function (_req, res, /*next*/) {
        return res.status(200).json({
            Status: 'You sent too many register requests. Please wait a while then try again'
        })
    },
    keyGenerator: (req, _res) => req.headers["cf-connecting-ip"]
});

router.get('/register/:discordid/:username/:region', limiter, async (req, res, _next) => {

    if (req.get('origin') != "https://valorantstore.net") {
        if (req.get("host") != "localhost:5000") res.status(403).send("403");
    }

    const password = req.header("password");

    if (password == undefined) {
        res.end(JSON.stringify({ Status: "Unauthorized request :("}))
        return;
    }

    const region = req.params.region.toUpperCase();
    
    try {

        //Already inserted
        const [rows, fields] = await db.execute('SELECT `discordid` FROM `users` WHERE `discordid` = ? limit 1;', [req.params.discordid]);
        if (rows.length == 1) {
            res.end(JSON.stringify({ Status: "FAILED"}))
            return;
        }

        const valorantApi = new Valorant.API(region);

        var userid = "";
        var access_token = "";
        var entitlements_token = ""; 
        var ssidcookie = "";


        var status = false;

        //Get puuid , access_token(1h expire) , entitlements_token(1mo) , ssidcookie
        await valorantApi.authorize(req.params.username, password).then(() => {
            userid = valorantApi.user_id;
            access_token = valorantApi.access_token;
            entitlements_token = valorantApi.entitlements_token;
            ssidcookie = valorantApi.ssidcookie;
        }).catch((err) => {
            console.log(err);
            res.end(JSON.stringify({ Status: err.message}));
            status = true;
        });

        if (status) return;

        //insert db
        await db.execute('INSERT INTO `users`(`id`, `playerid`, `access_token`, `entitlements_token`, `ssidcookie`, `region`, `password`, `discordid`) VALUES (null,?,?,?,?,?,?,?)', 
            [userid, access_token, entitlements_token, ssidcookie, region, "none", req.params.discordid]);

        res.end(JSON.stringify({ Status: "OK"}));
    
    } catch (err) {
        res.end(JSON.stringify({ Status: err.message}));
    }
})

router.get('/unlink', unlinklimiter, async (req, res, _next) => {
    const discordid = req.header("discordid");

    if (discordid == undefined) {
        res.end(JSON.stringify({ Status: "Unauthorized request :("}))
        return;
    }

    try {
        await db.execute('DELETE FROM `users` WHERE `discordid` = ?', [discordid]);

        res.end(JSON.stringify({ Status: "OK"}));
    } catch (err) {
        res.end(JSON.stringify({ Status: err.message}));
    }
})

module.exports = router;