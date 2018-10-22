require('dotenv').config()

const matchProvider = require('./matches/matchProvider.js');
const poller = require('./utils/poller.js').poller
const voters = require( './utils/voters.js' );
const config = require( './configs/config.js' );
const logger = require( './utils/logger.js' ).logger;
const syslogger = require('./utils/logger.js').sysLogger;
const NexmoParser = require( './parsers/nexmoparser.js' ).NexmoParser;
const TwilioParser = require('./parsers/twilioparser.js').TwilioParser;
const db = require('./dbs/db.js');

const express = require( 'express' );
const bodyParser = require('body-parser');
const hbs = require('hbs');
const path = require('path');
const socketIO = require('socket.io');
const http = require('http');

var app = express();
var server = http.createServer(app);
var io = socketIO(server);

//in the future consider factory, for the ease of switching between parser / match type

//Some initialization
var parser = new TwilioParser();
var match;
var draw = new poller();
var currentMode = "poll";

app.use(express.static(path.join(__dirname, '/public')));
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());

app.set('view engine', 'hbs');

app.disable('x-powered-by');

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
// app.use(['/votectrl', '/control', '/register'], function (req, res, next) {
// 	let ip = req.ip.replace(/^.*:/, '');
// 	res.set( 'Access-Control-Allow-Origin', '*' );
// 	syslogger.info( 'Incoming system control from ' + ip + ' content ' + JSON.stringify( req.body ) );
// 	config.getAttribute('admin_ip').then((res) => {
// 		if (res[0]['value'] === ip){
// 			next();
// 		} else {
// 			throw ('ip does not match' + ip);
// 		}
// 	}).catch((err) => {
// 		syslogger.error('Cannot validate admin ip -- ' + err);
// 		res.sendStatus( 401 );
// 	})
// });

app.use((req, res, next) => {
	req.io = io;
	next();
});

app.get('/controlpanel', (req, res) => {
	req.io.on('connection', (socket) => {
		match = matchProvider.getMatch('Group', socket);
		syslogger.info('Control Panel Connected');

		// control commands event
		socket.on('newControlCommand', (cmd) => {
			if (cmd.opcode === 'poll') {
				draw.pollAudienceWinner().then((winner) => {
					let delayNotify = parseInt(cmd.delay);
					currentMode = 'poll';
					syslogger.info('Switched to poll mode');

					if (cmd.notifyWinner === 'true') {
						setTimeout( function() {
							parser.sendMessage( winner, 'Congratulations on winning a prize' );
						}, delayNotify * 1000 );
					}
					socket.emit('resultUpdate', { mode: 'poll', winner: draw.getPollWinner() });
				}).catch((err) =>{syslogger.error( 'Cannot detemine a winner - ' + err)});;
			} else {
				syslogger.error( 'Invalid controller command' );
			}
		});

		socket.on('newVoteCommand', (cmd) => {
			currentMode = 'vote';
			try{
				//if match type doesn't match, change match type
				if (match.getMatchType() !== cmd.matchType)
					match = matchProvider.getMatch(cmd.matchType, socket);
				if( currentMode != 'vote' ) 
					syslogger.info( 'Switched to vote mode' );
				//forward the command to the match class
				match.processCommand(cmd);
			} catch (e){
				syslogger.error(e + JSON.stringify(req.body));
				socket.emit('resultUpdate', {error: e});
			}
		});
	});
	res.render('controlPanel');
});

app.get('/register', (req, res) => {
	req.io.on('connection', (socket) => {
		syslogger.info('Register Page Connected');

		socket.on('registerNumber', (data, callback) => {
			let isValid = /^\d+$/.test(data.number) && data.number.length === 10;
			if (isValid) {
				db.runQuery('INSERT INTO voters(phone_number) VALUES(?)', [`+1${data.number}`]).then(() => {
					callback({success: true});
				}).catch((err) => {
					syslogger.error('Cannot register phone number (Database Error): ' + data.number);
					callback({success: false, error: 'Cannot register phone number (Database Error)'});
				});
			} else {
				syslogger.error('Cannot register phone number (Invalid Number): ' + data.number);
				callback({success: false, error: 'Cannot register phone number (Invalid Number)'});
			}
		});
	});
	res.render('register');
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
});

app.get( '/', function( req, res ) {
	res.sendStatus( 401 );
});

server.listen(8080, () => {
	console.log('Listening on Port 8080');
});
