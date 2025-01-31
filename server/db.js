const mysql = require('mysql2');

require('dotenv').config({
    path: process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env.production'
});

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

console.log(`Database connected to: ${process.env.DB_HOST} (${process.env.NODE_ENV} mode)`);

module.exports = pool;
