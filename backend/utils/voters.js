var db = require( '../dbs/db.js' );
var logger = require( './logger.js' ).logger;

var codePattern = new RegExp( '^[a-zA-Z]{8}$', '' );
var votePattern = new RegExp( '^[0-9]{1,}$', '' );
var pnbrPattern = new RegExp( '^[0-9]{11}$', '' );

/**
 * Check if the incoming message matches registration format
 * @param {string} text - The incoming message
 * @return {boolean} The result.
 */
function isRegistration( text ) {
	return codePattern.test( text );
}

/**
 * Check if the incoming message matches voting format
 * @deprecated
 * @param {string} text - The incoming message
 * @return {boolean} The result.
 */
function isVote( text ) {
	return votePattern.test( text );
}

/**
 * Adds user to the database.
 * @param {string} number - The user's phone number
 * @param {string} code - The code user inputed
 * @return {Promise} Promise represents the result.
 */
function addUser( number, code ) {
	var regKey = code.toUpperCase();
	return db.runQuery( 'INSERT INTO voters(phone_number, reg_key) VALUES( ?, ? )', [ number, regKey ])
		.then(db.runQuery( 'UPDATE reg_key SET used = 1 WHERE reg_key = ?', regKey))
}

/**
 * Get the phone number of all voters
 * @return {Promise} Promise represents the result.
 */
function getAllVoters() {
	return db.runQuery( 'SELECT phone_number FROM voters', []).then((result) => {return result.map(x => x['phone_number'])});
}

module.exports.addUser = addUser;
module.exports.isRegistration = isRegistration;
module.exports.isVote = isVote;
module.exports.getAllVoters = getAllVoters;
