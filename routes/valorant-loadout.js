const express = require('express');
const router = express.Router();

const db = require("../db")
const cache = require("../misc/cache")
const reauth = require("../valorant/reauth")
const Valorant = require('../auth/main.js')

router.get('/valorant/getloadout', async (req, res, _next) => {
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

    const caches = await cache.getcache('loadout', user.id)

    const valorantApi = new Valorant.API(user.region)

    valorantApi.access_token = user.access_token
    valorantApi.entitlements_token = user.entitlements_token

    let loadout = ""
    let status = false

    if (caches) {
      loadout = caches
    } else {
      await valorantApi.getPlayerLoadout(user.playerid)
      .then((response) => {
        loadout = response.data
        db.updatecache(user.id, loadout, 'loadout')
      })
      .catch((error) => {
        status = error.message
      })
    }
    if (status) {
      res.end(JSON.stringify({ status: status}))
    } else {
      res.json(loadout)
    }
  }
});

module.exports = router;