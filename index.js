const dotenv = require('dotenv');

dotenv.config();
const express = require('express');
const cors = require('cors');
const app = express();

const shopM = require("./valorant/shop")

const cron = require("node-cron")
cron.schedule("0 0 */1 * * *", () => shopM.getData())

const port = 5100;

const log4js = require("log4js");
log4js.configure({
    appenders: {
        app: { type: 'dateFile', filename: 'application.log', numBackups: 3 }
    },
    categories: {
        default: { appenders: ['app'], level: 'all' }
    }
})

const whitelist = ["https://valorantstore.net", "https://www.valorantstore.net", "http://localhost:3000"] //Cors whitelist

app.set('trust proxy', 1)

let corsOptions = {
    origin: whitelist,
    //origin: "*",
    optionsSuccessStatus: 200,
    credentials: true,
    methods: ["GET", "POST"],
}

app.use(cors(corsOptions)) //Cors

const cookieParser = require('cookie-parser')
app.use(cookieParser())

app.use(express.urlencoded({extended: true}))
app.use(express.json())

shopM.getData()

const bundle = require("./routes/bundle");
const vn = require("./routes/valorant-news");
const va = require("./routes/valorant-acc");
const vs = require("./routes/valorant-store");
const vskin = require("./routes/valorant-skin");
const settings = require("./routes/settings");
const vsc = require("./routes/vsc");
const reminder = require("./routes/reminder");
const { getPrometheusClient, prometheusClient } = require('./misc/prometheus');
app.use(bundle, vn, vsc, vs, vskin, settings, va, reminder);

app.get("/metrics", async (req, res) => {
    res.set("Content-Type", "text/plain");
    res.send(await prometheusClient.register.metrics());
});

//404
app.use((_req, res, _next)=>{ res.status(404).send('Content Not Found'); });

var server = app.listen(port, function(){
    console.log("Node.js is listening to port", server.address().port);
});