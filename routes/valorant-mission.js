const express = require('express');
const router = express.Router();

const db = require("../db")
const cache = require("../misc/cache")
const reauth = require("../valorant/reauth")
const Valorant = require('../auth/main.js')
const axios = require("axios").default;

router.get('/valorant/getmission', async (req, res, _next) => {
  const discordid = req.header('discordid');

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: 'Unauthorized request :('}))
    return;
  }
  if (await db.empty(discordid)) {
    res.end(JSON.stringify({ status: "FAILED"}))
  } else {
    const reauthUser = await reauth.reauthUser(discordid)

    if (!reauthUser.success) {
      res.end(JSON.stringify({ status: reauthUser.error}))
      return
    }

    const user = await db.getUser(discordid)

    const caches = await cache.getcache('mission', user.id)

    const valorantApi = new Valorant.API(user.region)

    valorantApi.access_token = user.access_token
    valorantApi.entitlements_token = user.entitlements_token

    let dailymissions = []
    let weeklymissions = []
    let status = false
    let missions = ""
    let missionstmp = ""

    if (caches) {
      missions = caches
    } else {
      await valorantApi.getContract(user.playerid)
      .then((response) => {
        missionstmp = response.data["Missions"];
      })
      .catch((error) => {
        status = error.message
      })
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

      missions = { daily: dailymissions, weekly: weeklymissions, date: Math.floor(new Date().getTime() / 1000) }
      db.updatecache(user.id, missions, 'mission')
    }
    if (status) {
      res.end(JSON.stringify({ status: status}))
    } else {
      res.json(missions)
    }
  }
});

module.exports = router;