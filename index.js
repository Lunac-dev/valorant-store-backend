const dotenv = require('dotenv');

dotenv.config();
const express = require('express');
const cors = require('cors');
const app = express();

const shopM = require("./valorant/shop")

const port = 5000;

var whitelist = ["https://valorantstore.net", "https://www.valorantstore.net"] //Cors whitelist

app.set('trust proxy', 1)

var corsOptions = {
    //origin: whitelist,
    origin: "*",
    optionsSuccessStatus: 200,
    credentials: true,
    methods: ["GET"],
}

app.use(cors(corsOptions)) //Cors

shopM.getData()

const shop = require("./routes/valorant-shop");
const wallet = require("./routes/valorant-wallet");
const mission = require("./routes/valorant-mission");
const acc = require("./routes/valorant-acc");
const loadout = require("./routes/valorant-loadout");
const vsc = require("./routes/vsc");
app.use(shop, vsc, wallet, mission, acc, loadout);

//404
app.use((_req, res, _next)=>{ res.status(404).send('Content Not Found'); });

var server = app.listen(port, function(){
    console.log("Node.js is listening to port:" + server.address().port);
});