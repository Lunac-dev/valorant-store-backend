const express = require('express');
const router = express.Router();
const axios = require("axios").default;
const db = require("../db.js");

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

var map = new Map();

router.get('/auth', (_req, res, _next) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=identify`);
})

router.get('/auth-callback', async (req, res) => {

    const code = req.query.code;

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI
    });

    try {
        const tokenRes = await axios.post('https://discordapp.com/api/oauth2/token', params, {});
        const token = tokenRes.data.access_token;

        const userRes = await axios.get(`https://discord.com/api/v6/users/@me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        //User was linked?
        const [rows, fields] = await db.execute('SELECT * FROM `users` WHERE `discordid` = ? limit 1;', [userRes.data.id]);

        var playerid = "none";
        var region = "none";

        if (rows.length != 0) {
            playerid = rows[0].playerid;
            region = rows[0].region;
        }

        const random = Math.random().toString(32).substring(2);

        map.set(random, {id: userRes.data.id, username: userRes.data.username, avatar: userRes.data.avatar, puuid: playerid, region: region});
        return res.redirect("https://valorantstore.net/getuser?key=" + random);
    } catch (err) {
        return res.send(err.response.data)
    }
});

router.get('/checkuser', (req, res, _next) => {
    if (req.header("key") == undefined) {
        res.end(JSON.stringify({ Status: "Unauthorized request :("}))
        return;
    }

    if (map.has(req.header("key"))) {
        res.json(map.get(req.header("key")))
        map.delete(req.header("key"));
    } else {
        res.end(JSON.stringify({ Status: "FAILED"}))
    }
})

module.exports = router;