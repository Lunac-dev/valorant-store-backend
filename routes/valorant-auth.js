const express = require('express');
const router = express.Router();
const db = require("../db.js");

const Valorant = require('../auth/main.js');

const rate = require('express-rate-limit');
var storelimiter = rate({
    windowMs: 1*60*1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    handler: function (_req, res, /*next*/) {
        return res.status(200).json({
            Status: 'You sent too many store requests. Please wait a while then try again'
        })
    },
    keyGenerator: (req, _res) => req.headers["cf-connecting-ip"]
});

router.get('/valorant/getStore', storelimiter, async (req, res, _next) => {
    const discordid = req.header("discordid");

    if (discordid == undefined) {
        res.end(JSON.stringify({ Status: "Unauthorized request :("}))
        return;
    }

    try {
    
        const [rows, fields] = await db.execute('SELECT * FROM `users` WHERE `discordid` = ? limit 1;', [discordid]); //Find User from DB

        if (rows.length == 0) { //User linked?
            res.end(JSON.stringify({ Status: "Your account is not yet linked."}))
            return;
        }
    
        const valorantApi = new Valorant.API(rows[0].region);
    
        valorantApi.access_token = rows[0].access_token;
        valorantApi.entitlements_token = rows[0].entitlements_token;

        var store = "";
    
        //Get Player Store
        await valorantApi.getPlayerStoreFront(rows[0].playerid)
        .then((response) => {
            store = response.data;
        })
        .catch((error) => {
            res.end(JSON.stringify({ Status: error.response.statusText}));
        })

        //Get Player Wallet
        //85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741 : Valorant Points
        //e59aa87c-4cbf-517a-5983-6e81511be9b7 : Radianite Points
        valorantApi.getPlayerWallet(rows[0].playerid)
        .then((response) => {
            const wallet = response.data;
            res.json({store, wallet})
        })
        .catch((error) => {
            res.end(JSON.stringify({ Status: error.response.statusText}));
        })
    } catch (err) {
        res.end(JSON.stringify({ Status: err.message}));
    }
});

router.get('/valorant/reauth', async (req, res, _next) => {

    const discordid = req.header("discordid");

    if (discordid == undefined) {
        res.end(JSON.stringify({ Status: "Unauthorized request :("}))
        return;
    }

    try {

        const [rows, fields] = await db.execute('SELECT * FROM `users` WHERE `discordid` = ? limit 1;', [discordid]);
        const valorantApi = new Valorant.API(rows[0].region);

        var ssidcookie = rows[0].ssidcookie;

        var access_token = "";

        var status = false;

        //Cookie reauth
        //Sometimes the response is empty.
        await valorantApi.reauthorize(ssidcookie).then(() => {
            ssidcookie = valorantApi.ssidcookie;
            access_token = valorantApi.access_token;
        }).catch((err) => {
            console.log(err);
            ssidcookie = valorantApi.ssidcookie;
            status = true;
        });
        
        if (status) {
            console.log("Reauth Error!" + discordid)
            // await connection.execute('UPDATE `users` SET `ssidcookie`=? WHERE `discordid` = ?', 
            // [ssidcookie, req.params.discordid]);
            // console.log("Updated access token")
            res.end(JSON.stringify({ Status: "An error occurred during the re-authentication process. Sorry, please relink or try again."}));
        } else {
            await db.execute('UPDATE `users` SET `access_token`=?,`ssidcookie`=? WHERE `discordid` = ?', 
            [access_token, ssidcookie, discordid]);

            res.end(JSON.stringify({ Status: "OK"}));
        }

    } catch (err) {
        console.log(err)
        res.end(JSON.stringify({ Status: err.message}));
    }
});
module.exports = router;