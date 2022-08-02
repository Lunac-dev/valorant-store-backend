const express = require('express');
const router = express.Router();
const axios = require("axios").default;

const db = require("../db.js");

router.get('/vsc/news', async (req, res, _next) => {

  if (req.query.type === undefined || req.query.limit === undefined) {
    res.end(JSON.stringify({ status: "Unauthorized request :("}))
    return;
  }
  try {

    const [rows, fields] = await db.execute('SELECT * FROM `news` where `type` = ? order by id DESC limit ?;', [req.query.type, req.query.limit]);

    let news = [];

    rows.forEach(function(row) {
      news.push({title: row.title, text: row.text, date: row.date})
    });

    res.json(news)

  } catch (err) {
    res.end(JSON.stringify({ status: err.message}));
  }
})

module.exports = router;