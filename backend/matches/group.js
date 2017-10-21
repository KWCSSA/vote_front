var db = require( '../db.js' );
var logger = require('../logger.js').logger
var voters = require( '../voters.js' );

class candidates{
    constructor(id, name){
        this.id = id;
        this.name = name;
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
        this.initiated = false;
    }

    init(votePerUser, listOfCandidates){
        //did it this way to prevent escaping
        return db.runQuery('SELECT * FROM smsvoting.candidates where c_id in ( ' + listOfCandidates + ' );').then((res) => {
            this.listOfCandidates = res.map((x) => new candidates(x['c_id'], x['c_name']))
            this.voting = false;
            this.votePerUser = votePerUser;
            this.initiated = true;
        }).catch((err) => logger.error('Cannot initialize match ' + err))
    }

    clearMatch(){
        this.initiated = false;
    }

    getAllCandidates(){
        return this.listOfCandidates;
    }

    addVoteToCandidate(id, votecount){
        this.listOfCandidates.find((x) => (x.id === id)).addVote(votecount);
    }

    setCandidateVote(id, votecount){
        this.listOfCandidates.find((x) => (x.id === id)).setVote(votecount);
    }

    writeResultToDb(){
        for(candidate in listOfCandidates){
            db.runQuery('UPDATE smsvoting.candidates SET vote=? WHERE id=?', [candidate.vote, candidate.id])
        }
    }

    processVote(voteString){
        var arrayOfVotes = voteString.split('/[^0-9]/').map(Number).filter((x)=> {x in this.listOfCandidates.map((y) => {y.id})});
        var filtered = arrayOfVotes.filter((value, index) => {return arrayOfVotes.indexOf(value) == index;}).slice(0,this.votePerUser);
        for(vote in filtered){
            this.addVoteToCandidate(vote, 1);
        }
        
    }

    stopVoting(){
        this.voting = false;
    }

    startVoting(){
        this.voting = true;
    }
}

module.exports.groupMatch = groupMatch;