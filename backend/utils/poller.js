var syslogger = require( './logger.js' ).sysLogger;
var db = require( '../dbs/db.js' );
var voters = require( './voters.js' );
var config = require( '../configs/config.js' );

/** Poller Class: Used to draw prize from the audiences */
class poller{
    /**
     * Create a poller.
     */
    constructor(){
        this.pollWinner = '';
    }

    /**
     * Randomly find a winner and store it
     * @return {Promise} interval - Promise with a winning number.
     */
    pollAudienceWinner(){
        return voters.getAllVoters().then((res) => {
            if (res.length != 0){
                syslogger.info( 'Selecting winner from ' + res.length + ' voters' )
                var selection = Math.floor( Math.random() * res.length );
                syslogger.info( 'Winner is ' + res[ selection ] );
                this.pollWinner = res[ selection ];
                return this.pollWinner;
            } else {
                throw 'There are no registered voters';
            }
        });
    }

    /**
     * Return the last winner
     * @return {String} The last winnner.
     */
    getPollWinner(){
        return this.pollWinner;
    }
}

module.exports.poller = poller;
