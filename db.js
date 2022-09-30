//IF YOU ARE USING MYSQL 8.0.x
//UNDER 8.0, USE MYSQL.
//DATABASE CAN BE NOSQL OR ANYTHING ELSE.

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: "root",
    password: process.env.DB_USER_PASSWORD,
    database: process.env.DB_NAME});

console.log("DB Connected to " + process.env.DB_HOST)

module.exports = {

    async getUser (discordid) {
        const conn = await pool.getConnection();
        const [rows] = await conn.execute('SELECT * FROM `bot-users` WHERE `discordid` = ? limit 1;', [discordid]);
        conn.release();
        return rows[0]
    },

    async getUserData (userid) {
        const conn = await pool.getConnection();
        const [rows] = await conn.execute('SELECT * FROM `bot-users-data` WHERE `userid` = ? limit 1;', [userid]);
        conn.release();
        return rows[0]
    },

    async empty (discordid) {
        const conn = await pool.getConnection();
        const [rows] = await conn.execute('SELECT `discordid` FROM `bot-users` WHERE `discordid` = ? limit 1;', [discordid]);
        conn.release();
        if (rows.length == 1) {
            return false
        } else {
            return true
        }
    },

    async register (userid, access_token, entitlements_token, ssidcookie, region, tdidcookie, discordid, relogin) {
        try {
            const conn = await pool.getConnection();
            await conn.execute('INSERT INTO `bot-users`(`id`, `playerid`, `access_token`, `entitlements_token`, `ssidcookie`, `region`, `tdidcookie`, `discordid`, `date`, `relogin`) VALUES (null,?,?,?,?,?,?,?,?,?)', [userid, access_token, entitlements_token, ssidcookie, region, tdidcookie, discordid, new Date().toISOString(), relogin]);
            conn.release();
            return true
        } catch (err) {
            return false
        }
    },

    async addLoginData (userid, username, password) {
        try {
            const conn = await pool.getConnection();
            await conn.execute('INSERT INTO `bot-users-data`(`userid`, `username`, `password`) VALUES (?,?,?)', [userid, username, password]);
            conn.release();
            return true
        } catch (err) {
            return false
        }
    },

    async remove (discordid) {
        try {
            const conn = await pool.getConnection();
            await conn.execute('DELETE FROM `bot-users` WHERE `discordid` = ?', [discordid]);
            conn.release();
            return true
        } catch (err) {
            return false
        }
    },

    async update (access_token, ssidcookie, tdidcookie, discordid) {
        try {
            const conn = await pool.getConnection();
            await conn.execute('UPDATE `bot-users` SET `access_token`=?,`ssidcookie`=?,`tdidcookie`=?,`date`=? WHERE `discordid` = ?',
            [access_token, ssidcookie, tdidcookie, new Date().toISOString(), discordid]);
            conn.release();
            return true
        } catch (err) {
            return false
        }
    },

    async updatecache (userid, json, type) {
        try {
            const conn = await pool.getConnection();
            await conn.execute('DELETE FROM `bot-cache` WHERE `type`= ? AND `userid` = ?', [type, userid]);
            // const m = new Date().getMonth()+1
            await conn.execute('INSERT INTO `bot-cache`(`userid`, `json`, `date`, `type`) VALUES (?,?,?,?)',
            [userid, json, new Date().toISOString(), type]);
            conn.release();
            return true
        } catch (err) {
            return false
        }
    },

    async getcache (type, userid) {
        const conn = await pool.getConnection();
        const [rows] = await conn.execute('SELECT * FROM `bot-cache` WHERE `type`= ? AND `userid` = ? limit 1;', [type, userid]);
        conn.release();
        if (rows.length == 1) {
            return rows[0]
        } else {
            return false
        }
    }
};