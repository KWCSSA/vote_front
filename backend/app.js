require('dotenv').config()

var express = require( 'express' );
var app = express();
var types = require( './parser/IParser.js' );
var Message = types.Message;
var TimedDuelVote = require( './matches/timed_duel.js' ).TimedDuelVote;
var voters = require( './voters.js' );
var config = require( './config.js' );
var logger = require( './logger.js' ).logger;
var smslogger = require('./logger.js').smsLogger;
var Controller = require( './controller.js' ).Controller;

//Want to change the whole structure, since the current one is quite messed up
//controller seems unneccesary



var NexmoParser = require( './parsers/nexmoparser.js' ).NexmoParser;

var parser = new NexmoParser();
var match = new TimedDuelVote();
var control = new Controller( match, parser );

app.use( express.bodyParser() );

function LogMessage( msg ) {
	smslogger.info('MSG ID ' + msg.messageId + ' RECV\'d ON ' + msg.messageTime + ' FROM ' + msg.sender + ':\n');
}

app.post( '/inbound', function( req, res ) {
	
	if( parser.checkMessage( req.body ) ) {
		msg = parser.parseMessage( req.body );
		LogMessage( msg );
		
		if( voters.isRegistration( msg.Message ) ) {
			voters.addUser( msg );
		} else if( voters.isVote( msg.Message ) ){
			//todo change vote pattern here
			match.processVote( msg );
		} else {
			smslogger.error( 'Message received from ' + msg.Sender + ' is not recognizable: \'' + msg.Message + '\'' );
		}
		
	} else {
		logger.error( 'Cannot process received message ' + JSON.stringify( req.body ) );
	}
} );

app.post( '/recipt', function( req, res ) {
	// TODO Deliver this recipt to parser. (Parsers cannot handle recipts for now, to this is a TODO)
	logger.infoLog( 'Received SMS recipt ' + JSON.stringify( req.body ) );
	var log = JSON.stringify( req.body );
	fs.appendFile( './SMSRecipt.log', log, { flags: 'a+' }, function( err ) {
		if( err ) {
			logger.errLog( 'Cannot write SMSRecipt file, ' + err );
		}
	} );
	res.send( 200, '' );
} );

app.post( '/control', function( req, res ) {
	
	console.log( 'Incoming system control from ' + req.ip + ' content ' + JSON.stringify( req.body ).green );
	res.set( 'Access-Control-Allow-Origin', '*' );
	
	control.validateAdminIP( req.ip ).then((res) => {
		if (res)
			control.processControl( req.body );
	}).catch ((err) => logger.error('Cannot validate admin IP ' + err)).then(() => res.send(''));
} );

app.post( '/votectrl', function( req, res ) {
	res.set( 'Access-Control-Allow-Origin', '*' );
	console.log( 'Incoming vote control from ' + req.ip + ' content ' + JSON.stringify( req.body ).green );
	control.validateAdminIP( req.ip ).then((res) => {
		if (res) {
			if( control.getResultMode() != 'vote' ) {
				logger.infoLog( 'Switched to vote mode' );
			}
			control.setResultMode( 'vote' );
			match.processControl( req.body );
		}
	}).catch ((err) => logger.error('Cannot validate admin IP ' + err)).then(() => res.send( 200, '{}' ));
});

app.get( '/result', function( req, res ) {
	res.set( 'Access-Control-Allow-Origin', '*' );
	// logger.infoLog( 'Received result query' );
	if( control.getResultMode() == 'vote' ) {
		match.compileResult( function( err, ret ) {
			ret.mode = 'vote';
			if( err ) {
				logger.errLog( 'Error compiling return result ' + err );
				res.send( 500 );
			} else {
				ret.mode = 'vote';
				res.send( 200, JSON.stringify( ret ) );
			}
		} );
	} else if( control.getResultMode() == 'poll' ) {
		var ret = { mode: 'poll',
					winner: control.getPollWinner() };
		
		res.send( 200, JSON.stringify( ret ) );
	} else {
		res.send( 500 );
	}
} );

app.get( '/', function( req, res ) {
	res.send( 401 );
} );

app.use( function( req, res, next ) {
	res.removeHeader( "x-powered-by" );
	next();
} );

// function accessControl( username, password, route ) {
// 	return username == 'uwcssa' && password == 'cptbtptp';
// }

// function votectrlAccess( username, password ) {
// 	return accessControl( username, password, 'votectrl' );
// }

// function controlAccess( username, password ) {
// 	return accessControl( username, password, 'control' );
// }

//app.use( '/votectrl', express.basicAuth( votectrlAccess ) );
//app.use( '/control',  express.basicAuth( controlAccess ) );

app.listen( 8081 );
