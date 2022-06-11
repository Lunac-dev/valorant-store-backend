const express = require('express');
const router = express.Router();
const db = require("../db.js");

const Valorant = require('../auth/main.js');

router.get('/valorantbot/getWallet', async (req, res, _next) => {

    const discordid = req.header("discordid");

    if (discordid == undefined) {
        res.end(JSON.stringify({ Status: "Unauthorized request :("}))
        return;
    }

    try {   
        const [rows, fields] = await db.execute('SELECT * FROM `users` WHERE `discordid` = ? limit 1;', [discordid]);
    
        if (rows.length == 0) {
            res.end(JSON.stringify({ Status: "FAILED"}))
            return;
        }
        
        const valorantApi = new Valorant.API(rows[0].region);
        
        valorantApi.access_token = rows[0].access_token;
        valorantApi.entitlements_token = rows[0].entitlements_token;

        //Get Player Wallet
        await valorantApi.getPlayerWallet(rows[0].playerid)
        .then((response) => {
            res.json(response.data)
        })
        .catch((error) => {
            res.end(JSON.stringify({ Status: error.response.statusText}));
        })

    } catch (err) {
        res.end(JSON.stringify({ Status: err.message}));
    }
});

module.exports = router;