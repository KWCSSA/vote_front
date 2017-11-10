require('dotenv').config()

var matchProvider = require('./matches/matchProvider.js');
var poller = require('./poller.js').poller
var voters = require( './voters.js' );
var config = require( './config.js' );
var logger = require( './logger.js' ).logger;
var smslogger = require('./logger.js').smsLogger;
var syslogger = require('./logger.js').sysLogger;
var NexmoParser = require( './parsers/nexmoparser.js' ).NexmoParser;
var Netmask = require('netmask').Netmask

var express = require( 'express' );
var bodyParser = require('body-parser')
var app = express();

//in the future consider factory, for the ease of switching between parser / match type

var parser = new NexmoParser();
var match = matchProvider.getMatch('Group');
var matchtype = 'Group';
var draw = new poller();
var currentMode = "poll";

const nexmoIp = [new Netmask('174.37.245.32/29'), new Netmask('174.36.197.192/28'), new Netmask('173.193.199.16/28'), new Netmask('119.81.44.0/28')];

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());

app.use( function( req, res, next ) {
	res.removeHeader( "x-powered-by" );
	next();
});

app.post( '/inbound', function( req, res ) {
	let valid = false;
	nexmoIp.forEach((block) => {
		if (block.contains(req.ip.replace(/^.*:/, ''))) {
			valid = true;
		}
	})
	if( valid ) {
		msg = parser.parseMessage( req.body );
		smslogger.info('MSG ID ' + msg.messageId + ' RECEIVED ON ' + msg.messageTime + ' FROM ' + msg.sender + ' DATA ' + msg.message +':\n');
		if( voters.isRegistration( msg.message ) ) {
			voters.addUser( msg.sender, msg.message )
			.then(() => parser.sendMessage( msg.sender, 'You have been registered into our system' ))
			.catch((err) => {
				logger.error( 'Error adding user ' + number + ' - ' + err );
				parser.sendMessage( msg.sender, 'Sorry we could not register you into the system, please try again or contact the site staffs.' );
			});
		} else {
			if (match.isVoting()) {
				match.processVote( msg.message, msg.sender )
				.then((res) => parser.sendMessage( msg.sender, 'You have voted on candidates ' + res ))
				.catch(() => parser.sendMessage( msg.sender, 'Sorry we could not process the vote, please try again or contact the site staffs.' ));
			} else {
				logger.error(' User ' + msg.sender + ' attempted to vote while voting was closed.');
				parser.sendMessage( msg.sender, 'Voting is not open right now' );
			}
		}
	} else {
		syslogger.error( ' Invalid incoming ip for sms ' + JSON.stringify( req.body ) );
	}
	res.sendStatus(200);
} );

app.use(['/votectrl', '/control'], function (req, res, next) {
	let ip = req.ip.replace(/^.*:/, '');
	res.set( 'Access-Control-Allow-Origin', '*' );
	console.log( 'Incoming system control from ' + ip + ' content ' + JSON.stringify( req.body ) );
	config.getAttribute('admin_ip').then((res) => {
		if (res[0]['value'] === ip){
			next();
		} else {
			throw ('ip does not match' + ip);
		}
	}).catch((err) => {
		syslogger.error('Cannot validate admin ip -- ' + err);
		res.sendStatus( 401 );
	})
})

app.post( '/control', function( req, res ) {
	if( req.body.opcode === 'poll' ) {
		draw.pollAudienceWinner().then((winner) => {
			let delayNotify = parseInt( req.body.delay );
			currentMode = 'poll';
			syslogger.info('Switched to poll mode')
			
			if(req.body.notifyWinner === 'true') {
				setTimeout( function() {
					parser.sendMessage( winner, 'Congratulations on winning a prize' );
				}, delayNotify * 1000 );
			}
		}).catch((err) =>{syslogger.error( 'Cannot detemine a winner - ' + err)});
		
	} else {
		syslogger.error( 'Invalid controller command' );
	}
	res.sendStatus(200);
});

app.post( '/votectrl', function( req, res ) {
	if( currentMode != 'vote' ) {
		syslogger.info( 'Switched to vote mode' );
	}
	currentMode = 'vote';
	try{
		match.processCommand(res.body);
		res.sendStatus(200);
	} catch (e){
		syslogger.error(e + JSON.stringify(res.body));
		res.sendStatus(500);
	}
});

app.get( '/result', function( req, res ) {
	res.set( 'Access-Control-Allow-Origin', '*' );
	if( currentMode == 'vote' ) {
		res.status(200).send( JSON.stringify(Object.assign({ mode: 'vote' }, match.compileResult())));
	} else if( currentMode == 'poll' ) {
		var ret = { mode: 'poll', winner: draw.getPollWinner() };
		res.status(200).send( JSON.stringify( ret ) );
	} else {
		res.sendStatus( 500 );
	}
} );

app.get( '/', function( req, res ) {
	res.sendStatus( 401 );
} );

app.listen( 8080 );
