//IF YOU ARE USING MYSQL 8.0.x
//UNDER 8.0, USE MYSQL.
//DATABASE CAN BE NOSQL OR ANYTHING ELSE.

const mysql = require('mysql2/promise');

const dayjs = require('dayjs')
dayjs.extend(require('dayjs/plugin/utc'))

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
        if (rows.length == 1) {
            return rows[0]
        } else {
            return false
        }
    },

    async getStoreStatsRanking () {
        const conn = await pool.getConnection();
        const [rows] = await conn.execute('SELECT id, name, uuid, count, ROW_NUMBER() OVER(ORDER BY count DESC) AS rank_result FROM store_stats limit 30;');
        conn.release();
        return rows
    },

    async getStats () {
        const conn = await pool.getConnection();
        const [rows] = await conn.execute('select * from (select count(*) as users from `bot-users`) a, (select count(type = "store") as daily from `bot-cache2`) b, (SELECT SUM(`count`) as store_stats FROM `store_stats`) c');
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

    async updatecache (userid, json, type, old_store) {
        try {
            const conn = await pool.getConnection();
            await conn.execute('DELETE FROM `bot-cache2` WHERE `type`= ? AND `userid` = ?', [type, userid]);
            // const m = new Date().getMonth()+1
            if (type !== "store") {
                old_store = "none"
            }
            await conn.execute('INSERT INTO `bot-cache2`(`userid`, `json`, `date`, `type`, `old_store`) VALUES (?,?,?,?,?)',
            [userid, json, dayjs().utc().format("YYYY/MM/DD"), type, old_store]);
            conn.release()
            return true
        } catch (err) {
            console.error(err)
            return false
        }
    },

    async add_store_stats (name, uuid) {
        try {
            const conn = await pool.getConnection();
            const [rows] = await conn.execute('SELECT `name` FROM `store_stats` WHERE  `uuid` = ?', [uuid]);
            if (rows.length == 0) {
                await conn.execute('INSERT INTO `store_stats`(`id`, `name`, `uuid`, `count`) VALUES (null,?,?,1)', [name, uuid]);
            } else {
                await conn.execute('UPDATE `store_stats` SET `count` = `count` + 1 WHERE `uuid` = ?;', [uuid]);
            }
            conn.release()
            return true
        } catch (err) {
            return false
        }
    },

    async getcache (type, userid) {
        const conn = await pool.getConnection();
        const [rows] = await conn.execute('SELECT * FROM `bot-cache2` WHERE `type`= ? AND `userid` = ? limit 1;', [type, userid]);
        conn.release();
        if (rows.length == 1) {
            return rows[0]
        } else {
            return false
        }
    },

    async getuserinfo (user_id) {
        const conn = await pool.getConnection();
        const [rows] = await conn.execute('SELECT * FROM `bot-users-info` WHERE `id` = ? limit 1;', [user_id]);
        conn.release()
        if (rows.length == 1) {
            return rows[0]
        } else {
            return false
        }
    },

    async updateuserinfo (user_id, discordid, private, rank) {
        try {
            const conn = await pool.getConnection();
            await conn.execute('INSERT INTO `bot-users-info`(`id`, `discordid`, `private`, `rank`) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE `private` = VALUES (`private`);', [user_id, discordid, private, rank]);
            await conn.release()
            return true
        } catch (err) {
            return false
        }
    },

    async add_reminder_weapons (weapons, discord_id) {
        try {
            const conn = await pool.getConnection();
            await conn.execute('UPDATE `bot-reminder` SET `weapons`= ? WHERE `discordid` = ?', [weapons, discord_id]);
            await conn.release()
            return true
        } catch (err) {
            console.error(err)
            return false
        }
    },

    async reset_reminder_weapons (discord_id) {
        try {
            const conn = await pool.getConnection();
            await conn.execute('UPDATE `bot-reminder` SET `weapons`= ? WHERE `discordid` = ?', ['null', discord_id]);
            await conn.release()
            return true
        } catch (err) {
            return false
        }
    }
};