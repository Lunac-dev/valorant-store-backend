const express = require("express");
const axios = require("axios").default;
const router = express.Router();
const db = require("../db.js");

const Valorant = require('../auth/main.js');

const RiotAPI = require('@valapi/valorant-api.com').Client;

const Riot = new RiotAPI({
    language: 'en-US',
});

var skinlevels = ""
var skindata = ""
var offers = "";

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

router.get('/valorantbot/getStore', async (req, res) => {

    const discordid = req.header("discordid");

    if (discordid == undefined) {
        res.end(JSON.stringify({ Status: "Unauthorized request :("}))
        return;
    }

    try {
        //User linked?
        const [rows, fields] = await db.execute('SELECT * FROM `users` WHERE `discordid` = ? limit 1;', [discordid]);

        if (rows.length == 0) {
            res.end(JSON.stringify({ Status: "FAILED"}))
            return;
        }

        const valorantApi = new Valorant.API(rows[0].region);
    
        valorantApi.access_token = rows[0].access_token;
        valorantApi.entitlements_token = rows[0].entitlements_token;

        var store = "";
        var status = false;

        //Get Player Store
        await valorantApi.getPlayerStoreFront(rows[0].playerid)
        .then((response) => {
            store = response.data;
        })
        .catch((error) => {
            res.end(JSON.stringify({ Status: error.response.statusText}));
            status = true;
        })

        if (status) return;


        const offersIDs = store["SkinsPanelLayout"]["SingleItemOffers"];

        const offerleft = store["SkinsPanelLayout"]["SingleItemOffersRemainingDurationInSeconds"];

        var offersweapons = [];

        offersweapons.push({ offerleft: offerleft });

        for (var i = 0;  i < 4;  i++) {
            var weapon1 = skinlevels.data.data.find((v) => v.uuid == offersIDs[i]);
            //Get offers
            var offer = offers.data.Offers.find((v) => v.OfferID == offersIDs[i]);
            var offerid = Object.keys(offer.Cost)[0];
            var vp = offer.Cost[offerid];
        
            //Get Tier
            var tierid = skindata.data.data.filter((v) => v.levels[0]["uuid"] == weapon1.uuid)[0]["contentTierUuid"];
        
            //Push
            offersweapons.push({ name: weapon1.displayName, imgsrc: weapon1.displayIcon, vp: vp, tierimgsrc: get_weapon_tierimg(tierid), videosrc: weapon1.streamedVideo })
        }

        //Night Marcket
        if ("BonusStore" in store) {
            var bonusweapons = [];
            const bonus = store["BonusStore"]["BonusStoreOffers"];

            const bonusleft = store["BonusStore"]["BonusStoreRemainingDurationInSeconds"];

            for (var i = 0;  i < 6;  i++) {
                var weapon1 = skinlevels.data.data.find((v) => v.uuid == bonus[i]["Offer"]["Rewards"][0]["ItemID"]);
                var discount = Object.keys(bonus[i]["DiscountCosts"])[0];
            
                //Get Tier
                var tierid = skindata.data.data.filter((v) => v.levels[0]["uuid"] == weapon1.uuid)[0]["contentTierUuid"];
            
                //Push
                bonusweapons.push({ name: weapon1.displayName, imgsrc: weapon1.displayIcon, vp: bonus[i]["DiscountCosts"][discount], vpold: bonus[i]["Offer"]["Cost"][discount],tierimgsrc: get_weapon_tierimg(tierid), videosrc: weapon1.streamedVideo})
            }
            bonusweapons.push({BonusLeft: bonusleft});
            offersweapons.push({BonusStore: bonusweapons});
        }
        res.json(offersweapons);

    } catch (err) {
        console.log(err)
        res.end(JSON.stringify({ Status: err.message}));
    }
});

function get_weapon_tierimg(id) {
    return "https://media.valorant-api.com/contenttiers/" + id + "/displayicon.png"
}

module.exports = router;