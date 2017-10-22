var logger = require( './logger.js' ).logger;
var db = require( './db.js' );
var voters = require( './voters.js' );
var config = require( './config.js' );

class Controller{
	constructor( match, parser ){
		this.voteProcessor = match;
		this.smsParser = parser;
		
		this.currentResultMode = 'vote';
		this.pollWinner = '';
		
		this.debug = false;
		config.getAttribute('debug').then((val) => {this.debug = (val === 'true'); logger.info( 'Controller in debug ');}).catch((err) => {logger.error('Cannot retrive debug switch from database')})
	}
	
	setMatch(match){
		this.voteProcessor = match;
	}
	
	setSMSParser(parser){
		this.smsParser = parser;
	}
	
	validateAdminIP(ip){
		return new Promise((resolve, reject) => {
			if (this.debug)
				resolve(true);
			config.getAttribute('admin_ip').then((res) => {
				resolve(res[0]['value'] === ip);
			})
		});
	}

	processControl(cmd){
		if( cmd.opcode === 'poll' ) {
			this.pollAudienceWinner( cmd );
		} else {
			logger.errLog( 'Invalid controller command' );
		}
	}

	pollAudienceWinner(cmd){
		var lastRound = this.voteProcessor.getCurrentRoundID();
		var notify = false;
		var delayNotify = 0;
		
		if( cmd.notifyWinner === 'true' ) {
			notify = true;
		}
		
		if( !isNaN(cmd.delay) ) {
			delayNotify = parseInt( cmd.delay );
		}
		
		if( this.currentResultMode != 'poll' ) {
			logger.infoLog( 'Switched to poll mode' );
		}
		this.currentResultMode = 'poll';
		
		voters.getAllVoters().then((res) => {
			if (res.length != 0){
				logger.info( 'Selecting winner from ' + res.length + ' voters' )
				var selection = Math.floor( Math.random() * result.length );
				logger.infoLog( 'Winner is ' + result[ selection ] );
				this.pollWinner = result[ selection ];
				if( notify ) {
					setTimeout( function() {
						self.smsParser.sendMessage( result[ selection ], 'Congratulations on winning a prize' );
					}, delayNotify * 1000 );
				}
			} else {
				logger.error( 'There are no voters');
			}
		}).catch((err)=>{logger.error( 'Cannot get voters ' + err)});
	}

	getPollWinner(){
		return this.pollWinner;
	}

	getResultMode(){
		return this.currentResultMode;
	}

	setResultMode(mode){
		if (mode !== 'vote' && mode !== 'poll'){
			logger.error( 'Invalid result mode ' + mode );
		} else {
			this.currentResultMode = model;
		}
	}
}

module.exports.Controller = Controller;
