require('dotenv').config()

var fs = require( 'fs' );
var express = require( 'express' );
var app = express();
var util = require( 'util' );
var types = require( './parser/IParser.js' );
var Message = types.Message;
var SingleVote = require( './matches/single.js' ).SingleVote;
var TimedDuelVote = require( './matches/timed_duel.js' ).TimedDuelVote;
var voters = require( './voters.js' );
var colors = require( 'colors' );
var config = require( './config.js' );
var logger = require( './logger.js' );
var Controller = require( './controller.js' ).Controller;

var NexmoParser = require( './parsers/nexmoparser.js' ).NexmoParser;

var parser = new NexmoParser();
var match = new TimedDuelVote();
var control = new Controller( match, parser );

app.use( express.bodyParser() );

function convertRequest( req ) {
	var ret = '';
	ret = 'Body: ' + JSON.stringify( req.body ) + '\n';
	ret += 'URI: ' + req.originalUrl + '\n';
	return ret;
}

function LogMessage( msg ) {
	if( !( msg instanceof Message ) ) {
		return;
	}
	
	var log = msg.LogString + '\n';
	
	fs.appendFile( './SMSLog.log', log, { flags: 'a+' }, function( err ) {
		if( err ) {
			logger.errLog( 'Cannot write SMSLog file, ' + err );
		}
	} );
}

app.post( '/inbound', function( req, res ) {
	var msg;
	
	if( parser.checkMessage( req.body ) ) {
		msg = parser.parseMessage( req.body );
		LogMessage( msg );
		
		if( voters.isRegistration( msg.Message ) ) {
			voters.addUser( msg );
		} else if( voters.isVote( msg.Message ) ){
			match.processVote( msg );
		} else {
			logger.errLog( 'Message received from ' + msg.Sender + ' is not recognizable: \'' + msg.Message + '\'' );
		}
		
	} else {
		logger.errLog( 'Cannot process received message ' + JSON.stringify( req.body ) );
	}
	
	res.send('');
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

app.get( '/verify_number', function( req, res ) {
	res.set( 'Access-Control-Allow-Origin', '*' );
	if( typeof req.query.number != 'string' ||
		typeof req.query.code != 'string' ) {
		
		res.send( { result: false } );
		logger.errLog( 'Invalid verification request ' + JSON.stringify( req.query ) );
		return;
	}
	
	voters.verifyRegistration( req.query.number, req.query.code, function( result ) {
		res.send( result );
	} );
} );

app.get( '/', function( req, res ) {
	res.send( 401 );
} );

app.use( function( req, res, next ) {
	res.removeHeader( "x-powered-by" );
	next();
} );

function accessControl( username, password, route ) {
	return username == 'uwcssa' && password == 'cptbtptp';
}

function votectrlAccess( username, password ) {
	return accessControl( username, password, 'votectrl' );
}

function controlAccess( username, password ) {
	return accessControl( username, password, 'control' );
}

//app.use( '/votectrl', express.basicAuth( votectrlAccess ) );
//app.use( '/control',  express.basicAuth( controlAccess ) );

app.listen( 8081 );
