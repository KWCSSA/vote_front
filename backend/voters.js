var db = require( './db.js' );
var logger = require( './logger.js' ).logger;

var codePattern = new RegExp( '^[a-zA-Z]{8}$', '' );
var votePattern = new RegExp( '^[0-9]{1,}$', '' );
var pnbrPattern = new RegExp( '^[0-9]{11}$', '' );

function verifyRegistration( number, code ) {
	db.runQuery( 'SELECT * FROM voters WHERE phone_number = ? AND reg_key = ?', [ number, code.toUpperCase() ]).then((result)=>{return (result.length > 0)}).catch(()=> {return false});
}

function isRegistration( text ) {
	return codePattern.test( text );
}

function isVote( text ) {
	return votePattern.test( text );
}

function addUser( number, code ) {
	var regKey = code.toUpperCase();
	db.runQuery( 'INSERT INTO voters(phone_number, reg_key) VALUES( ?, ? )', [ msg.Sender, regKey ])
		.then(db.runQuery( 'UPDATE reg_key SET used = 1 WHERE reg_key = ?', regKey))
		.catch((err) => {logger.error( 'Error adding user ' + msg.Sender + ' - ' + err )})
}

function getAllVoters( votedInRound ) {
	if ( typeof votedInRound == 'number' ){
		return db.runQuery( 'SELECT DISTINCT voter FROM votes WHERE round = ' + votedInRound, []).then((result) => {return result.map(x => x['voter'])});
	} else {
		return db.runQuery( 'SELECT phone_number FROM voters', []).then((result) => {return result.map(x => x['phone_number'])});
	}
}

module.exports.addUser = addUser;
module.exports.isRegistration = isRegistration;
module.exports.isVote = isVote;
module.exports.verifyRegistration = verifyRegistration;
module.exports.getAllVoters = getAllVoters;
