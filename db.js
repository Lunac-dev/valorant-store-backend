//IF YOU ARE USING MYSQL 8.0.x
//UNDER 8.0, USE MYSQL.
//DATABASE CAN BE NOSQL OR ANYTHING ELSE.

const mysql = require('mysql2/promise');

const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: "root",
    password: process.env.DB_USER_PASSWORD,
    database: process.env.DB_NAME});

console.log("DB Connected to " + process.env.DB_HOST)

module.exports = {

    async getUser (discordid) {
        const [rows] = await connection.execute('SELECT * FROM `bot-users` WHERE `discordid` = ? limit 1;', [discordid]);
        return rows[0]
    },

    async getUserData (userid) {
        const [rows] = await connection.execute('SELECT * FROM `bot-users-data` WHERE `userid` = ? limit 1;', [userid]);
        return rows[0]
    },

    async empty (discordid) {
        const [rows] = await connection.execute('SELECT `discordid` FROM `bot-users` WHERE `discordid` = ? limit 1;', [discordid]);
        if (rows.length == 1) {
            return false
        } else {
            return true
        }
    },

    async register (userid, access_token, entitlements_token, ssidcookie, region, tdidcookie, discordid, relogin) {
        try {
            await connection.execute('INSERT INTO `bot-users`(`id`, `playerid`, `access_token`, `entitlements_token`, `ssidcookie`, `region`, `tdidcookie`, `discordid`, `date`, `relogin`) VALUES (null,?,?,?,?,?,?,?,?,?)', [userid, access_token, entitlements_token, ssidcookie, region, tdidcookie, discordid, new Date().toISOString(), relogin]);
            return true
        } catch (err) {
            return false
        }
    },

    async addLoginData (userid, username, password) {
        try {
            await connection.execute('INSERT INTO `bot-users-data`(`userid`, `username`, `password`) VALUES (?,?,?)', [userid, username, password]);
            return true
        } catch (err) {
            return false
        }
    },

    async remove (discordid) {
        try {
            await connection.execute('DELETE FROM `bot-users` WHERE `discordid` = ?', [discordid]);
            return true
        } catch (err) {
            return false
        }
    },

    async update (access_token, ssidcookie, tdidcookie, discordid) {
        try {
            await connection.execute('UPDATE `bot-users` SET `access_token`=?,`ssidcookie`=?,`tdidcookie`=?,`date`=? WHERE `discordid` = ?',
            [access_token, ssidcookie, tdidcookie, new Date().toISOString(), discordid]);
            return true
        } catch (err) {
            return false
        }
    },

    async updatecache (userid, json, type) {
        try {
            await connection.execute('DELETE FROM `bot-cache` WHERE `type`= ? AND `userid` = ?', [type, userid]);
            const m = new Date().getMonth()+1
            await connection.execute('INSERT INTO `bot-cache`(`userid`, `json`, `date`, `type`) VALUES (?,?,?,?)',
            [userid, json, new Date().toISOString(), type]);
            return true
        } catch (err) {
            return false
        }
    },

    async getcache (type, userid) {
        const [rows] = await connection.execute('SELECT * FROM `bot-cache` WHERE `type`= ? AND `userid` = ? limit 1;', [type, userid]);
        if (rows.length == 1) {
            return rows[0]
        } else {
            return false
        }
    }
};