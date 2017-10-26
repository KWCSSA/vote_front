var db = require( '../db.js' );
var logger = require('../logger.js').logger
var voters = require( '../voters.js' );
var timer = require('../timer.js');

class candidates{
    constructor(id, name){
        this.id = id;
        this.name = name;
        this.vote = 0;
        this.score = 0;
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
        this.timer = new timer(60000, ()=>{this.state = 'RESULT'}, 1000);
    }

    init(votePerUser, listOfCandidates){
        //did it this way to prevent escaping
        return db.runQuery('SELECT * FROM smsvoting.candidates where c_id in ( ' + listOfCandidates + ' );').then((res) => {
            this.listOfCandidates = res.map((x) => new candidates(x['c_id'], x['c_name']))
            this.votePerUser = parseInt(votePerUser) || 3;
            this.initialized = true;
        }).catch((err) => logger.error('Cannot initialize match ' + err))
    }

    setState(newstate){
        if(!this.initialized){
            logger.error('Match not initialized, set state failed');
        } else {
            this.state = newstate;
            if (newstate === 'VOTING'){
                this.timer.start();
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
        for(candidate in listOfCandidates){
            db.runQuery('INSERT INTO smsvoting.group_result(vote, id) VALUES( ?, ? )', [candidate.vote, candidate.id])
        }
    }

    processVote(voteString, user){
        let candidateIds = this.listOfCandidates.map((y) => {return y.id});
        var arrayOfVotes = voteString.split(/[^0-9]+/).map(Number).filter((x)=> {return (x in candidateIds)});
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
