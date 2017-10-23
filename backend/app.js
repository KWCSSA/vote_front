require('dotenv').config()

var GroupMatch = require('./matches/group.js').groupMatch;
var poller = require('./poller.js').poller
var voters = require( './voters.js' );
var config = require( './config.js' );
var logger = require( './logger.js' ).logger;
var smslogger = require('./logger.js').smsLogger;
var NexmoParser = require( './parsers/nexmoparser.js' ).NexmoParser;
var Netmask = require('netmask').Netmask

var express = require( 'express' );
var bodyParser = require('body-parser')
var app = express();

//in the future consider factory, for the ease of switching between parser / match type

var parser = new NexmoParser();
var match = new GroupMatch();
var draw = new poller();
var currentMode = "poll";

const nexmoIp = [new Netmask('174.37.245.32/29'), new Netmask('174.36.197.192/28'), new Netmask('173.193.199.16/28'), new Netmask('119.81.44.0/28')];

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());

app.post( '/inbound', function( req, res ) {
	let valid = false;
	nexmoIp.forEach((block) => {
		if (block.contains(req.ip.replace(/^.*:/, ''))) {
			valid = true;
		}
	})
	if( valid ) {
		msg = parser.parseMessage( req.body );
		smslogger.info('MSG ID ' + msg.messageId + ' RECEIVED ON ' + msg.messageTime + ' FROM ' + msg.sender + ' DATA ' + msg.text +':\n');
		if( voters.isRegistration( msg.Message ) ) {
			voters.addUser( msg.sender, msg.message );
		} else {
			if (match.isVoting()) {
				match.processVote( msg.message, message.sender );
			}
		}
	} else {
		logger.error( ' Invalid incoming ip ' + JSON.stringify( req.body ) );
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
			throw('ip does not match');
		}
	}).catch((err) => {
		logger.error('Cannot validate admin ip -- ' + err);
		res.sendStatus( 401 );
	})
})

app.post( '/control', function( req, res ) {
	if( req.body.opcode === 'poll' ) {
		draw.pollAudienceWinner();
		let delayNotify = parseInt( req.body.delay );
		currentMode = 'poll';
		logger.info('Switched to poll mode')
		
		if(req.body.notifyWinner === 'true') {
			setTimeout( function() {
				parser.sendMessage( draw.getPollWinner(), 'Congratulations on winning a prize' );
			}, delayNotify * 1000 );
		}
	} else {
		logger.error( 'Invalid controller command' );
	}
	res.sendStatus(200);
});

app.post( '/votectrl', function( req, res ) {
	if( currentMode != 'vote' ) {
		logger.info( 'Switched to vote mode' );
	}
	currentMode = 'vote';
	switch(req.body.opcode){
		case 'setcids':
			match.init(req.body.votePerUser, req.body.cids);
			break;
		case 'setstate':
			match.setState(req.body.newState)
			break;
		case 'addvote':
			req.body.reset ? match.addVoteToCandidate(req.body.candidate, req.body.score) : match.setCandidateVote(req.body.candidate, req.body.score);
			break;
		default:
			res.sendStatus(500);
	}
	if (!res.headersSent) res.sendStatus(200);
});

app.get( '/result', function( req, res ) {
	res.set( 'Access-Control-Allow-Origin', '*' );
	if( currentMode == 'vote' ) {
		res.status(200).send( JSON.stringify(match.compileResult()));
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

app.use( function( req, res, next ) {
	res.removeHeader( "x-powered-by" );
	next();
} );

app.listen( 8080 );
