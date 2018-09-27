var mysql = require('mysql');
var logger = require('./logger.js').logger;
require('dotenv').config()

/* Pool of mysql connections*/
var pool = mysql.createPool({
	host: process.env.dbHost,
	user: process.env.dbUser,
	password: process.env.dbPwd,
	database: process.env.dbName
});

/**
 * Execute a query
 * @param {string} query - The query to run
 * @param {string[]} values - The values to replace ? with
 * @return {Promise} The remaining time.
 */
function runQuery(query, values) {
	return new Promise((resolve, reject) => {
		pool.query(query, values, (err, results, fields) => {
			if (err) {
				logger.error('Database error - ' + err);
				return reject(err);
			}
			return resolve(results);
		});
	});
}

/**
 * Close all connections
 * @return {Promise} Promise with result of closing connections.
 */
function closeDB() {
	return new Promise((resolve, reject) => {
		pool.end(function (err) {
			if (err) {
				console.log('Cannot close DB pool ' + err);
				return reject(err);
			} else {
				console.log('Connection to database terminated');
			}
		});
	});
}

module.exports.runQuery = runQuery;
module.exports.closeDB = closeDB;

