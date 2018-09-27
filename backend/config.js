var db = require('./db.js');

/**
 * Fetch attribute value from database
 * @param {string} attr - The attribute to fetch
 * @return {Promise} Promise containing attribute value.
 */
function getAttribute( attr ) {
	return db.runQuery( 'SELECT value FROM config WHERE attribute = ?', [attr]);
}

/**
 * Updates attribute value in the database
 * @param {string} attr - The attribute to be set
 * @param {string} val - The value of the attribute
 * @return {Promise} Promise represents the result.
 */
function setAttribute( attr, val ) {
	return db.runQuery( 'UPDATE config SET value = ? WHERE attribute = ?', [val, attr]);
}

module.exports.getAttribute = getAttribute;
module.exports.setAttribute = setAttribute;
