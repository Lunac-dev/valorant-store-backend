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

module.exports = connection;