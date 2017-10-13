var mysql = require('mysql');
var logger = require('logger.js');

var dbHost = 'localhost';
var dbName = 'smsvoting';
var dbUser = 'smsvoting';
var dbPwd = 'smsvoting';

var pool = mysql.createPool({
	host: dbHost,
	user: dbUser,
	password: dbPwd,
	database: dbName
});

function runQuery(query, values) {
	return new Promise((resolve, reject) => {
		pool.query(query, values, (err2, results, fields => {
			if (err2) {
				logger.error('Cannot retrieve data from database' + err2);
				return reject(err2);
			}
			return resolve(results);
		}));
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

