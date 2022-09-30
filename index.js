const dotenv = require('dotenv');

dotenv.config();
const express = require('express');
const cors = require('cors');
const app = express();

const shopM = require("./valorant/shop")

const port = 5000;

const log4js = require("log4js");
log4js.configure({
    appenders: {
        app: { type: 'dateFile', filename: 'application.log', pattern: 'yyyy-MM-dd', daysToKeep: 3 }
    },
    categories: {
        default: { appenders: ['app'], level: 'all' }
    }
})

let whitelist = ["https://valorantstore.net", "https://www.valorantstore.net"] //Cors whitelist

app.set('trust proxy', 1)

let corsOptions = {
    origin: whitelist,
    //origin: "*",
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
const inventory = require("./routes/valorant-inventory");
const vsf = require("./routes/valorant-store-featured");
const vn = require("./routes/valorant-news");
const vk = require("./routes/valorant-skin");
const vsc = require("./routes/vsc");
app.use(shop, vsc, wallet, mission, acc, loadout, vsf, vn, vk, inventory);

//404
app.use((_req, res, _next)=>{ res.status(404).send('Content Not Found'); });

var server = app.listen(port, function(){
    console.log("Node.js is listening to port:" + server.address().port);
});