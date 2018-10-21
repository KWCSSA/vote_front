var db = require( '../db.js' );
var logger = require('../logger.js').logger;
var syslogger = require('../logger.js').sysLogger;
var voters = require( '../voters.js' );
var timer = require('../timer.js');
var candidate = require('../models/candidate.js').baseCandidate;

/**
 * Candidate for group stage
 * @extends candidate
 */
class groupCandidate extends candidate{
    constructor(id, name){
        super(id, name);
        this.vote = 0;
    }

    /**
     * Add vote to the candidate
     * @param {number} count - The amount to add
	 */
    addVote(count){
        this.vote += count;
    }
    
    /**
     * Set vote amount for the candidate
     * @param {number} count - The amount to set to
	 */
    setVote(count){
        this.vote = count;
    }
}

class groupMatch{
    constructor(){
        this.state = 'IDLE';
        this.initialized = false;
        this.timer = new timer(120000, ()=>{this.state = 'VOTED'}, 1000);
    }
    
    /**
     * Initialize the match
     * @param {number} votePerUser - The amount of votes per voter can cast
     * @param {string} listOfCandidates - List of candidates the voter can choose from
     * @return {Promise} Promise that initialize the match
	 */
    init(votePerUser, listOfCandidates){
        this.initialized = false;
        //did it this way to prevent escaping
        return db.runQuery('SELECT * FROM new_candidates where cid in ( ' + listOfCandidates + ' );').then((res) => {
            this.listOfCandidates = res.map((x) => new groupCandidate(x['cid'], x['name']));
            this.votePerUser = parseInt(votePerUser) || 3;
            syslogger.info('Group match initialized, candidates - ' + listOfCandidates);
            this.initialized = true;
        }).catch((err) => syslogger.error('Cannot initialize match ' + err));
    }
    
    /**
     * Update the state
     * @param {string} newstate - The state to update to
	 */
    setState(newstate){
        this.state = newstate;
        if (newstate === 'VOTING'){
            this.timer.start();
        } else {
            this.timer.stop();
        }
        if (newstate === 'RESULT'){
            this.writeResultToDb();
        }
    }
    
    /**
     * Return the result
     * @return {Object} Object containing the information about the match
	 */
    compileResult(){
        return {state: this.state, type: 'Group', timerRemain: this.timer.getRemaining(), data: (this.state === 'IDLE') ? null : this.listOfCandidates};
    }
    
    /**
     * Add vote to a candidate
     * @param {number} id - The candidate id
     * @param {number} votecount - Amount of votes
	 */
    addVoteToCandidate(id, votecount){
        this.listOfCandidates.find((x) => {return (x.id === parseInt(id))}).addVote(votecount);
    }
    
    /**
     * Set vote count of a candidate
     * @param {number} id - The candidate id
     * @param {number} votecount - Amount of votes
	 */
    setCandidateVote(id, votecount){
        this.listOfCandidates.find((x) => {return (x.id === parseInt(id))}).setVote(votecount);
    }
    
    /**
     * Write current match result to database
	 */
    writeResultToDb(){
        for(var candidate in this.listOfCandidates){
            db.runQuery('INSERT INTO group_result(votes, id) VALUES( ?, ? )', [this.listOfCandidates[candidate].vote, this.listOfCandidates[candidate].id]);
        }
    }
    
    /**
     * Process an incoming command
     * @param {Object} body - The command body
	 */
    processCommand(body){
        if(body.opcode == 'setcids'){
            //initialize the match
            this.init(body.votePerUser, body.cids);
        } else if(this.initialized){
            switch(body.opcode){
                //change match state
                case 'setstate':
                    this.setState(body.newState);
                    break;
                //add or set vote for a candidate
                case 'addvote':
                    let targetCid = parseInt(body.candidate);
                    if (targetCid && targetCid > 0 && targetCid < 25) {
                        body.reset ? this.setCandidateVote(body.candidate, parseInt(body.score)) : this.addVoteToCandidate(body.candidate, parseInt(body.score));
                    } else {
                        syslogger.error(`Invalid candidate ${body.candidate} for addScore`);
                    }
                    break;
				default:
					syslogger.error('Invalid opcode - ' + body.opcode);
			}
		} else {
			syslogger.error('Match not initialized yet');
		} 
    }

    /**
     * Process a voter's vote
     * @param {Object} voteString - The string user sent
     * @param {Object} user - The incoming number
     * @returns {Promise} Promise with the result of the vote
	 */
    processVote(voteString, user){
        //Get all current candidates
        let candidateIds = this.listOfCandidates.map((y) => {return y.id});
        //split the string into array of numbers
        var arrayOfVotes = voteString.split(/[^0-9]+/).map(Number).filter((x)=> {return (candidateIds.indexOf(x) !== -1)});
        //filter the votes to only get valid votes and under the allowed count
        var filtered = arrayOfVotes.filter((value, index) => {return arrayOfVotes.indexOf(value) == index;}).slice(0,this.votePerUser);

        return new Promise((resolve, reject) => {
            if (filtered.length != 0){
                //process the votes, unique key constraint will prevent the user from voting twice
                db.runQuery('INSERT INTO group_votes(cids, voter) VALUES( ?, ? )', [ filtered.join('-'), user ]).then(() => {
                    for(var vote in filtered){
                        this.addVoteToCandidate(filtered[vote], 1);
                    }
                    logger.info('User ' + user + ' has voted on ' + filtered);
                    return resolve(filtered);
                }).catch((err) => {
                    logger.error('Invalid vote to ' + filtered + ' from ' + user + ' - ' + err );
                    return reject();
                });
            } else {
                logger.error("Received empty vote from " + user);
                return reject();
            }
        });
    }
    
    /**
     * See if currently accepting votes
     * @returns {boolean} the result of the check
	 */
    isVoting(){
        return (this.state === 'VOTING');
    }

    /**
     * Get current match type
     * @returns {string} the match type
	 */
    getMatchType(){
        return 'Group';
    }
}

module.exports.groupMatch = groupMatch;
