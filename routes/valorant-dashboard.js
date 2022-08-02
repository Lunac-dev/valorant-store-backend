const express = require('express');
const router = express.Router();
const axios = require("axios").default;

const Valorant = require('../auth/main.js');

const db = require("../db.js");

const rate = require('express-rate-limit');
var limiter = rate({
    windowMs: 60*60*1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: function (_req, res, _next) {
        return res.status(200).json({
            Status: 'You sent too many requests. Please wait a while then try again'
        })
    },
    keyGenerator: (req, _res) => req.headers["cf-connecting-ip"]
});

router.get('/valorant/updateDashboard', limiter, async (req, res, _next) => {

    const discordid = req.header("discordid");

    if (discordid == undefined) {
      res.end(JSON.stringify({ Status: "Unauthorized request :("}))
      return;
    }

    try {

      const [rows, fields] = await db.execute('SELECT * FROM `users` WHERE `discordid` = ? limit 1;', [discordid])

      if (rows.length == 0) {
        res.end(JSON.stringify({ Status: "FAILED"}))
        return;
      }

      const valorantApi = new Valorant.API(rows[0].region)

      valorantApi.access_token = rows[0].access_token
      valorantApi.entitlements_token = rows[0].entitlements_token

      let missionstmp = ""
      let dailymissions = []
      let weeklymissions = []
      let wallet = ""

      let status = false;

      //Get Player Missions
      await valorantApi.getContract(rows[0].playerid)
        .then((response) => {
          missionstmp = response.data["Missions"];
      })
      .catch((error) => {
        status = error.response.statusText
      })

      //Get Player Wallet
      await valorantApi.getPlayerWallet(rows[0].playerid)
        .then((response) => {
          wallet = response.data
      })
      .catch((error) => {
        status = error.response.statusText
      })

      if (status) {
        res.end(JSON.stringify({ Status: status}));
      } else {
        const missionsdata = await axios.get("https://valorant-api.com/v1/missions/")
        for (var i = 0;  i < Object.keys(missionstmp).length;  i++) {
          const mission = missionsdata.data.data.find((v) => v.uuid == missionstmp[i]["ID"]);
          if (mission.type.includes("Daily")) {
             //Daily
            dailymissions.push({title: mission.title, xpGrant: mission.xpGrant, progressToComplete: mission.progressToComplete,
            ExpirationTime: missionstmp[i]["ExpirationTime"], progress: missionstmp[i]["Objectives"][Object.keys(missionstmp[i]["Objectives"])[0]]})
          } else {
             //Weekly
            weeklymissions.push({title: mission.title, xpGrant: mission.xpGrant, progressToComplete: mission.progressToComplete,
            ExpirationTime: missionstmp[i]["ExpirationTime"], progress: missionstmp[i]["Objectives"][Object.keys(missionstmp[i]["Objectives"])[0]]})
          }
        }

        const m = new Date().getMonth()+1

        const missions = { daily: dailymissions, weekly: weeklymissions }

        await db.execute("INSERT INTO `dashboard-cache`(`userid`, `date`, `json`) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `date` = VALUES(`date`), `json` = VALUES(`json`)",
        [rows[0].id, new Date().getFullYear() + "-" + m + "-" +  new Date().getDate(), JSON.stringify({wallet: wallet, missions: missions })])

        res.json({Status: "OK"});
      }
    } catch (err) {
        res.end(JSON.stringify({ Status: err.message}));
    }
})

router.get('/valorant/getDashboard', async (req, res, _next) => {
  const discordid = req.header("discordid");

  if (discordid == undefined) {
    res.end(JSON.stringify({ Status: "Unauthorized request :("}))
    return;
  }

  try {
    let [rows, fields] = await db.execute('SELECT * FROM `users` WHERE `discordid` = ? limit 1;', [discordid]);

    if (rows.length == 0) {
      res.end(JSON.stringify({ Status: "FAILED"}))
      return;
    }

    [rows, fields] = await db.execute('SELECT * FROM `dashboard-cache` WHERE `userid` = ?', [rows[0].id]);

    if (rows.length == 0) {
      res.end(JSON.stringify({ Status: "EMPTY"}))
      return
    }

    res.json(rows[0].json)
  } catch (err) {
    res.end(JSON.stringify({ Status: err.message}));
  }
})

module.exports = router;