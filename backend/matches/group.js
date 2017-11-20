var db = require( '../db.js' );
var logger = require('../logger.js').logger;
var syslogger = require('../logger.js').sysLogger;
var voters = require( '../voters.js' );
var timer = require('../timer.js');
var candidate = require('../models/candidate.js').baseCandidate;

class groupCandidate extends candidate{
    constructor(id, name){
        super(id, name);
        this.vote = 0;
    }
    
    addVote(count){
        this.vote += count;
    }
    
    setVote(count){
        this.vote = count;
    }
}

class groupMatch{
    constructor(){
        this.state = 'IDLE';
        this.initialized = false;
        this.timer = new timer(90000, ()=>{this.state = 'VOTED'}, 1000);
    }
    
    init(votePerUser, listOfCandidates){
        this.initialized = false;
        //did it this way to prevent escaping
        return db.runQuery('SELECT * FROM smsvoting.candidates where c_id in ( ' + listOfCandidates + ' );').then((res) => {
            this.listOfCandidates = res.map((x) => new groupCandidate(x['c_id'], x['c_name']));
            this.votePerUser = parseInt(votePerUser) || 3;
            syslogger.info('Group match initialized, candidates - ' + listOfCandidates);
            this.initialized = true;
        }).catch((err) => syslogger.error('Cannot initialize match ' + err));
    }
    
    
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
    
    compileResult(){
        return {state: this.state, type: 'Group', timerRemain: this.timer.getRemaining(), data: ((this.state === 'IDLE') || (this.state === 'SINGLE')) ? null : this.listOfCandidates};
    }
    
    addVoteToCandidate(id, votecount){
        this.listOfCandidates.find((x) => {return (x.id === parseInt(id))}).addVote(votecount);
    }
    
    setCandidateVote(id, votecount){
        this.listOfCandidates.find((x) => {return (x.id === parseInt(id))}).setVote(votecount);
    }
    
    writeResultToDb(){
        for(var candidate in this.listOfCandidates){
            db.runQuery('INSERT INTO smsvoting.group_result(votes, id) VALUES( ?, ? )', [this.listOfCandidates[candidate].vote, this.listOfCandidates[candidate].id]);
        }
    }
    
    processCommand(body){
        if(body.opcode == 'setcids'){
            this.init(body.votePerUser, body.cids);
        } else if(this.initialized){
            switch(body.opcode){
                case 'setstate':
                    this.setState(body.newState);
                    break;
                case 'addvote':
                    body.reset ? this.setCandidateVote(body.candidate, parseInt(body.score)) : this.addVoteToCandidate(body.candidate, parseInt(body.score));
                    break;
				default:
					syslogger.error('Invalid opcode - ' + body.opcode);
			}
		} else {
			syslogger.error('Match not initialized yet');
		} 
    }

    processVote(voteString, user){
        let candidateIds = this.listOfCandidates.map((y) => {return y.id});
        var arrayOfVotes = voteString.split(/[^0-9]+/).map(Number).filter((x)=> {return (candidateIds.indexOf(x) !== -1)});
        var filtered = arrayOfVotes.filter((value, index) => {return arrayOfVotes.indexOf(value) == index;}).slice(0,this.votePerUser);
        return new Promise((resolve, reject) => {
            if (filtered.length != 0){
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
    
    isVoting(){
        return (this.state === 'VOTING');
    }

    getMatchType(){
        return 'Group';
    }
}

module.exports.groupMatch = groupMatch;
