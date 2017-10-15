var mysql = require('mysql');
var logger = require('./logger.js');
require('dotenv').config()

var pool = mysql.createPool({
	host: process.env.dbHost,
	user: process.env.dbUser,
	password: process.env.dbPwd,
	database: process.env.dbName
});

function runQuery(query, values) {
	return new Promise((resolve, reject) => {
		pool.query(query, values, (err, results, fields) => {
			if (err) {
				logger.error('Cannot retrieve data from database' + err);
				return reject(err);
			}
			return resolve(results);
		});
	});
}

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

