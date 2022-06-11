const express = require('express');
const router = express.Router();
const axios = require("axios").default;

const Valorant = require('../auth/main.js');
    
const db = require("../db.js");

router.get('/valorantbot/getContract', async (req, res, _next) => {

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

        var missionstmp = "";
        var dailymissions = [];
        var weeklymissions = [];

        var status = false;

        //Get Player Missions
        await valorantApi.getContract(rows[0].playerid)
        .then((response) => {
            missionstmp = response.data["Missions"];
        })
        .catch((error) => {
            res.end(JSON.stringify({ Status: error.response.statusText}));
            status = true;
        })

        if (status) return;

        for (var i = 0;  i < Object.keys(missionstmp).length;  i++) {
            const mission = await axios.get("https://valorant-api.com/v1/missions/" + missionstmp[i]["ID"])
            if (mission.data.data["type"].includes("Daily")) {
                //Daily
                dailymissions.push({title: mission.data.data["title"], xpGrant: mission.data.data["xpGrant"], progressToComplete: mission.data.data["progressToComplete"],
                ExpirationTime: missionstmp[i]["ExpirationTime"], progress: missionstmp[i]["Objectives"][Object.keys(missionstmp[i]["Objectives"])[0]]})
            } else {
                //Weekly
                weeklymissions.push({title: mission.data.data["title"], xpGrant: mission.data.data["xpGrant"], progressToComplete: mission.data.data["progressToComplete"],
                ExpirationTime: missionstmp[i]["ExpirationTime"], progress: missionstmp[i]["Objectives"][Object.keys(missionstmp[i]["Objectives"])[0]]})
            }
        }

        res.json({daily: dailymissions, weekly: weeklymissions});


    } catch (err) {
        res.end(JSON.stringify({ Status: err.message}));
    }
})

module.exports = router;