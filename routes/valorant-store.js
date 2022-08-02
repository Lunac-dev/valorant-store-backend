const express = require('express');
const router = express.Router();
const axios = require("axios").default;

const Valorant = require('../auth/main.js');

const RiotAPI = require('@valapi/valorant-api.com').Client;

const Riot = new RiotAPI({
    language: 'en-US',
});

let skinlevels = ""
let skindata = ""
let offers = "";

getData();

async function getData() {
    skinlevels = await Riot.Weapons.getSkinLevels();
    skindata = await Riot.Weapons.getSkins();
    await axios.get("https://api.henrikdev.xyz/valorant/v1/store-offers")
    .then((response) => {
        const data = response.data;
        offers = data;
    })
}

const db = require("../db.js");

const rate = require('express-rate-limit');
var limiter = rate({
    windowMs: 20*60*1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: function (_req, res, _next) {
        return res.status(200).json({
            Status: 'You sent too many requests. Please wait a while then try again.'
        })
    },
    keyGenerator: (req, _res) => req.headers["cf-connecting-ip"]
});

router.get('/valorant/updateStore', limiter, async (req, res, _next) => {

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

      let store = "";
      let status = false;

      //Get Player Store
      await valorantApi.getPlayerStoreFront(rows[0].playerid)
      .then((response) => {
          store = response.data;
      })
      .catch((error) => {
          status = error.response.statusText;
      })

      if (status) {
        res.end(JSON.stringify({ Status: status}));
      } else {
        const offersIDs = store["SkinsPanelLayout"]["SingleItemOffers"];

        const offerleft = store["SkinsPanelLayout"]["SingleItemOffersRemainingDurationInSeconds"];

        let offersweapons = [];

        offersweapons.push({ offerleft: offerleft, date: new Date().getTime() });

        for (var i = 0;  i < 4;  i++) {
          const weapon1 = skinlevels.data.data.find((v) => v.uuid == offersIDs[i]);
          //Get offers
          const offer = offers.data.Offers.find((v) => v.OfferID == offersIDs[i]);
          const offerid = Object.keys(offer.Cost)[0];
          const vp = offer.Cost[offerid];

          //Get Tier
          const tierid = skindata.data.data.filter((v) => v.levels[0]["uuid"] == weapon1.uuid)[0]["contentTierUuid"];

          //Weapon Videos and Image
          const image = 'https://s3.valorantstore.net/weaponskinlevels/' + offersIDs[i] + '.png'
          let video = 'null'
          if (weapon1.streamedVideo != undefined) {
            video = 'https://s3.valorantstore.net/streamedVideo/' + offersIDs[i] + '.mp4'
          }

          //Push
          offersweapons.push({ name: weapon1.displayName, imgsrc: image, vp: vp, tierid: tierid, videosrc: video })
        }

        //Night Marcket
        if ("BonusStore" in store) {
          let bonusweapons = [];
          const bonus = store["BonusStore"]["BonusStoreOffers"];

          const bonusleft = store["BonusStore"]["BonusStoreRemainingDurationInSeconds"];

          for (var i = 0;  i < 6;  i++) {
            let weapon1 = skinlevels.data.data.find((v) => v.uuid == bonus[i]["Offer"]["Rewards"][0]["ItemID"]);
            let discount = Object.keys(bonus[i]["DiscountCosts"])[0];

            //Get Tier
            let tierid = skindata.data.data.filter((v) => v.levels[0]["uuid"] == weapon1.uuid)[0]["contentTierUuid"];

            //Weapon Videos and Image
            const image = 'https://s3.valorantstore.net/weaponskinlevels/' + weapon1.uuid + '.png'
            let video = 'null'
            if (weapon1.streamedVideo != undefined) {
              video = 'https://s3.valorantstore.net/streamedVideo/' + weapon1.uuid + '.mp4'
            }

            //Push
            bonusweapons.push({ name: weapon1.displayName, imgsrc: image, vp: bonus[i]["DiscountCosts"][discount], vpold: bonus[i]["Offer"]["Cost"][discount],tierid: tierid, videosrc: video})
          }
          bonusweapons.push({BonusLeft: bonusleft});
          offersweapons.push({BonusStore: bonusweapons});
        }

        const m = new Date().getMonth()+1

        await db.execute("INSERT INTO `store-cache`(`userid`, `date`, `json`) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `date` = VALUES(`date`), `json` = VALUES(`json`)",
        [rows[0].id, new Date().getFullYear() + "-" + m + "-" +  new Date().getDate(), JSON.stringify(offersweapons)])

        res.json({Status: "OK"});
      }
    } catch (err) {
        res.end(JSON.stringify({ Status: err.message}));
    }
})

router.get('/valorant/getStore', async (req, res, _next) => {
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

    [rows, fields] = await db.execute('SELECT * FROM `store-cache` WHERE `userid` = ? limit 1;', [rows[0].id]);

    if (rows.length == 0) {
      res.end(JSON.stringify({ Status: "EMPTY"}))
      return
    }

    res.json(rows[0].json)
  } catch (err) {
    res.end(JSON.stringify({ Status: err.message}));
  }
})

router.get('/valorant/getStoreShare', async (req, res, _next) => {
  const discordid = req.header("userid");

  if (discordid == undefined) {
    res.end(JSON.stringify({ Status: "Unauthorized request :("}))
    return;
  }

  try {

    let [rows, fields] = await db.execute('SELECT * FROM `users` WHERE `discordid` = ? limit 1;', [discordid]);

    if (rows.length == 0) {
      res.end(JSON.stringify({ Status: "EMPTY"}))
      return
    }

    [rows, fields] = await db.execute('SELECT * FROM `store-cache` WHERE `userid` = ? limit 1;', [rows[0].id]);

    if (rows.length == 0) {
      res.end(JSON.stringify({ Status: "FAILED"}))
      return
    }

    res.json(rows[0].json)
  } catch (err) {
    res.end(JSON.stringify({ Status: err.message}));
  }
})

module.exports = router;