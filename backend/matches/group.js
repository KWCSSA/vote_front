var db = require( '../db.js' );
var logger = require('../logger.js').logger
var syslogger = require('../logger.js').sysLogger
var voters = require( '../voters.js' );
var timer = require('../timer.js');
var candidate = require('../models/candidate.js').baseCandidate;

class groupMatch{
    constructor(){
        this.state = 'IDLE';
        this.initialized = false;
        this.timer = new timer(90000, ()=>{this.state = 'VOTED'}, 1000);
    }

    init(votePerUser, listOfCandidates){
        //did it this way to prevent escaping
        return db.runQuery('SELECT * FROM smsvoting.candidates where c_id in ( ' + listOfCandidates + ' );').then((res) => {
            this.listOfCandidates = res.map((x) => new candidate(x['c_id'], x['c_name']))
            this.votePerUser = parseInt(votePerUser) || 3;
            this.initialized = true;
        }).catch((err) => syslogger.error('Cannot initialize match ' + err))
    }

    setState(newstate){
        if(!this.initialized){
            syslogger.error('Match not initialized, set state failed');
        } else {
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
    }
    
    compileResult(){
        return {mode: 'vote', state: this.state, timerRemain: this.timer.getRemaining(), data: ((this.state === 'IDLE') || (this.state === 'SINGLE')) ? null : this.listOfCandidates};
    }

    addVoteToCandidate(id, votecount){
        this.listOfCandidates.find((x) => {return (x.id === parseInt(id))}).addVote(votecount);
    }

    setCandidateVote(id, votecount){
        this.listOfCandidates.find((x) => {return (x.id === parseInt(id))}).setVote(votecount);
    }

    writeResultToDb(){
        for(var candidate in this.listOfCandidates){
            db.runQuery('INSERT INTO smsvoting.group_result(votes, id) VALUES( ?, ? )', [listOfCandidates[candidate].vote, listOfCandidates[candidate].id])
        }
    }

    processVote(voteString, user){
        let candidateIds = this.listOfCandidates.map((y) => {return y.id});
        var arrayOfVotes = voteString.split(/[^0-9]+/).map(Number).filter((x)=> {return (candidateIds.indexOf(x) !== -1)});
        var filtered = arrayOfVotes.filter((value, index) => {return arrayOfVotes.indexOf(value) == index;}).slice(0,this.votePerUser);
        if (filtered.length != 0){
            db.runQuery('INSERT INTO group_votes(cids, voter) VALUES( ?, ? )', [ filtered.join('-'), user ]).then(() => {
                for(var vote in filtered){
			this.addVoteToCandidate(filtered[vote], 1);
                }
            }).then(()=>{
                logger.info('User ' + user + ' has voted on ' + filtered);
            }).catch((err) => {logger.error('Invalid vote to ' + filtered + ' from ' + user + ' - ' + err )});
        }
    }

    isVoting(){
        return (this.state === 'VOTING')
    }
}

module.exports.groupMatch = groupMatch;
