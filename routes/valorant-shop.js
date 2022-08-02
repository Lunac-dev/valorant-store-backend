const express = require('express');
const router = express.Router();

const shop = require("../valorant/shop")
const db = require("../db")

router.get('/valorant/getshop', async (req, res, _next) => {
  const discordid = req.header('discordid');

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: 'Unauthorized request :('}))
    return;
  }
  if (await db.empty(discordid)) {
    res.end(JSON.stringify({ status: "FAILED"}))
  } else {
    const store = await shop.getDailyShop(discordid)
    if (store.success) {
      res.json(store.shop)
    } else {
      res.end(JSON.stringify({ status: store.error}))
    }
  }
});

router.get('/valorant/getnightmarket', async (req, res, _next) => {
  const discordid = req.header('discordid');

  if (discordid == undefined) {
    res.end(JSON.stringify({ status: 'Unauthorized request :('}))
    return;
  }
  if (await db.empty(discordid)) {
    res.end(JSON.stringify({ status: "FAILED"}))
  } else {
    const store = await shop.getNightMarket(discordid)
    if (store.success) {
      res.json(store.nightmarket)
    } else {
      res.end(JSON.stringify({ status: store.error}))
    }
  }
});

module.exports = router;