var db = require( '../db.js' );
var logger = require('../logger.js').logger
var voters = require( '../voters.js' );

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
        this.state = 'idle';
        this.initialized = false;
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
        }
    }
    
    compileResult(){
        return {mode: 'vote', state: this.state, data: (this.state === 'idle') ? null : this.listOfCandidates};
    }

    addVoteToCandidate(id, votecount){
        this.listOfCandidates.find((x) => (x.id === parseInt(id))).addVote(votecount);
    }

    setCandidateVote(id, votecount){
        this.listOfCandidates.find((x) => (x.id === parseInt(id))).setVote(votecount);
    }

    writeResultToDb(){
        for(candidate in listOfCandidates){
            db.runQuery('INSERT INTO smsvoting.group_result(vote, id) VALUES( ?, ? )', [candidate.vote, candidate.id])
        }
    }

    processVote(voteString, user){
        var arrayOfVotes = voteString.split('/[^0-9]/').map(Number).filter((x)=> {x in this.listOfCandidates.map((y) => {y.id})});
        var filtered = arrayOfVotes.filter((value, index) => {return arrayOfVotes.indexOf(value) == index;}).slice(0,this.votePerUser);
        logger.info('User ' + user + ' has voted on ' + filtered);
        db.runQuery('INSERT INTO group_votes(cids, voter) VALUES( ?, ? )', [ filtered, user ]).then(() => {
            for(vote in filtered){
                this.addVoteToCandidate(vote, 1);
            }
        }).catch((err) => {logger.error('Invalid vote to ' + filtered + ' from ' + user + ' - ' + err )});
    }

    isVoting(){
        return (this.state === 'voting')
    }
}

module.exports.groupMatch = groupMatch;