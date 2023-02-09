const express = require("express")
const router = express.Router()

const db = require("../db.js")

const cron = require("node-cron")
cron.schedule("0 */10 * * * *", () => getData())

let ranking_json = null
let date = null

let vsc_stats = null

getData()

async function getData() {
  let tmp = []
  const stats = await db.getStoreStatsRanking()
  stats.forEach(function (row) {
    tmp.push({ name: row.name, uuid: row.uuid, count: row.count, rank: row.rank_result })
  })
  ranking_json = tmp

  let today = new Date();
  let formatted = today.toLocaleString('ja-JP');
  date = formatted

  vsc_stats = await db.getStats()
}

router.get("/ranking", async (req, res, _next) => {
  res.json({ data: ranking_json, date })
})

router.get("/stats", async (req, res, _next) => {
  res.json({ data: vsc_stats, date })
})

module.exports = router
