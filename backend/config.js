var db = require('./db.js');

function getAttribute( attr ) {
	return db.runQuery( 'SELECT value FROM config WHERE attribute = ?', [attr]);
}

function setAttribute( attr, val ) {
	return db.runQuery( 'UPDATE config SET value = ? WHERE attribute = ?', [val, attr]);
}

module.exports.getAttribute = getAttribute;
module.exports.setAttribute = setAttribute;
