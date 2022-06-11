const express = require('express');
const cors = require('cors');
const app = express();
const axios = require("axios").default;
const cron = require('node-cron');
cron.schedule('0 0 */1 * * *', () => updateStoreFeatured()); //Regularly update bundle data

const dotenv = require('dotenv');

dotenv.config();

const port = 5000;

var whitelist = ["https://valorantstore.net", "https://www.valorantstore.net", "http://localhost:8080/"] //Cors whitelist

app.set('trust proxy', 1)

var corsOptions = {
    origin: whitelist,
    optionsSuccessStatus: 200,
    credentials: true,
    methods: ["GET"],
}

app.use(cors(corsOptions)) //Cors

updateStoreFeatured(); //Setup

var storefeatured = "";

//Unknown if used ↓
function updateStoreFeatured() { //Update Store Bundles
    axios.get("https://api.henrikdev.xyz/valorant/v1/store-featured")
        .then((response) => {
            const data = response.data;
            storefeatured = data;
            console.log("Got store-featured");
    })
}

const wallet = require("./routes/valorantbot-wallet");
const ValorantAuth = require("./routes/valorant-auth");
const ValorantBotAuth = require("./routes/valorantbot-auth");
const Register = require("./routes/valorant-register");
const discord = require("./routes/discord");
const mission = require("./routes/valorantbot-mission");
app.use(wallet, ValorantAuth, ValorantBotAuth, Register, discord, mission);

//Bundles
app.get("/valorant/store-featured", (_req, res) => {
    res.end(JSON.stringify(storefeatured));
});

//404
app.use((_req, res, _next)=>{ res.status(404).send('Content Not Found'); });

var server = app.listen(port, function(){
    console.log("Node.js is listening to PORT:" + server.address().port);
});