require('dotenv').config()

var matchProvider = require('./matches/matchProvider.js');
var poller = require('./poller.js').poller
var voters = require( './voters.js' );
var config = require( './config.js' );
var logger = require( './logger.js' ).logger;
var syslogger = require('./logger.js').sysLogger;
var NexmoParser = require( './parsers/nexmoparser.js' ).NexmoParser;
var TwilioParser = require('./parsers/twilioparser.js').TwilioParser;

var express = require( 'express' );
var bodyParser = require('body-parser')
var app = express();

//in the future consider factory, for the ease of switching between parser / match type

//Some initialization
var parser = new TwilioParser();
var match = matchProvider.getMatch('Group');
var draw = new poller();
var currentMode = "poll";

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());

app.use( function( req, res, next ) {
	res.removeHeader( "x-powered-by" );
	next();
});

//inbound route for sms provider
app.post( '/inbound', function( req, res ) {
	if( parser.validateMessage(req) ) {
		//parse and log the message
		let msg = parser.parseMessage( req.body );
		logger.info('MSG ID ' + msg.messageId + ' RECEIVED ON ' + msg.messageTime + ' FROM ' + msg.sender + ' DATA ' + msg.message +':\n');
		//first check if it is for registration purpose
		if( voters.isRegistration( msg.message ) ) {
			voters.addUser( msg.sender, msg.message )
			.then(() => parser.sendMessage( msg.sender, 'You have been registered into our system' ))
			.catch((err) => {
				logger.error( 'Error adding user ' + msg.sender + ' - ' + err );
				parser.sendMessage( msg.sender, 'Sorry we could not register you into the system, please try again or contact the site staffs.' );
			});
		} else {
			//pass the message to match class to process
			if (match.isVoting()) {
				match.processVote( msg.message, msg.sender )
				.then((res) => parser.sendMessage( msg.sender, 'You have voted on candidates ' + res ))
				.catch((err) => parser.sendMessage( msg.sender, 'Sorry we could not process the vote, please try again or contact the site staffs.' ));
			} else {
				logger.error('User ' + msg.sender + ' attempted to vote while voting was closed.');
				parser.sendMessage( msg.sender, 'Voting is not open right now' );
			}
		}
	} else {
		syslogger.error( ' Invalid request origin ' + JSON.stringify( req.body ) );
	}
	parser.finish(res);
} );

//Check if control signal comes from the same ip as in db.
//Not very secure, but security throuhg obscurity is better than nothing
app.use(['/votectrl', '/control'], function (req, res, next) {
	let ip = req.ip.replace(/^.*:/, '');
	res.set( 'Access-Control-Allow-Origin', '*' );
	syslogger.info( 'Incoming system control from ' + ip + ' content ' + JSON.stringify( req.body ) );
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

//Route for chaning mode
app.post( '/control', function( req, res ) {
	if( req.body.opcode === 'poll' ) {
		//draw a random audience
		draw.pollAudienceWinner().then((winner) => {
			let delayNotify = parseInt( req.body.delay );
			currentMode = 'poll';
			syslogger.info('Switched to poll mode')
			//send a message alerting the winner
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

//route for chaning various controls related to the match
app.post( '/votectrl', function( req, res ) {
	currentMode = 'vote';
	try{
		//if match type doesn't match, change match type
		if (match.getMatchType() !== req.body.matchType)
			match = matchProvider.getMatch(req.body.matchType);
		if( currentMode != 'vote' ) 
			syslogger.info( 'Switched to vote mode' );
		//forward the command to the match class
		match.processCommand(req.body);
		res.sendStatus(200);
	} catch (e){
		syslogger.error(e + JSON.stringify(req.body));
		res.sendStatus(500);
	}
});

//route to get result of current votes / draw winner
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

app.listen(8080, () => {
	console.log('Listening on Port 8080');
});
