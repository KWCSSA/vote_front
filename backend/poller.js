var syslogger = require( './logger.js' ).sysLogger;
var db = require( './db.js' );
var voters = require( './voters.js' );
var config = require( './config.js' );

class poller{
    constructor(){
        this.pollWinner = '';
    }

    pollAudienceWinner(){
        voters.getAllVoters().then((res) => {
            if (res.length != 0){
                syslogger.info( 'Selecting winner from ' + res.length + ' voters' )
                var selection = Math.floor( Math.random() * res.length );
                syslogger.info( 'Winner is ' + res[ selection ] );
                this.pollWinner = res[ selection ];
            } else {
                throw 'There are no registered voters';
            }
        });
    }

    getPollWinner(){
        return this.pollWinner;
    }
}

module.exports.poller = poller;
