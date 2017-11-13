var db = require( '../db.js' );
var logger = require( '../logger.js' ).logger;
var syslogger = require('../logger.js').sysLogger;
var timer = require('../timer.js');
var candidate = require('../models/candidate.js').baseCandidate;

class duelCandidate extends candidate{
    constructor(id, name, firstRoundVote){
        super(id, name);
		this.vote = 0;
		this.score = 0;
		this.firstRoundVote = firstRoundVote;
    }
    
    addVote(count){
        this.vote += count;
    }
    
    setVote(count){
        this.vote = count;
	}
	
	setScore(count){
		this.score = count;
	}

	getTotal(){
		//temp function, might have to change in the future
		return this.vote * 0.45 + this.score * 0.45 + this.firstRoundVote * 0.1;
	}
}

class duelMatch{
	constructor(){
		this.state = 'IDLE';
		this.initialized = false;
		this.roundNumber = 0;
        this.timer = new timer(120000, ()=>{this.state = 'VOTED'}, 1000);
	}

	init(listOfCandidates){
		return db.runQuery('SELECT * FROM smsvoting.candidates where c_id in ( ' + listOfCandidates + ' );')
		.then((res) =>
			db.runQuery('SELECT * FROM smsvoting.group_result where id in ( ' + listOfCandidates + ' );').then((res2) => {
				if (this.round != 0)
					this.writeResultToDb();
				this.listOfCandidates = res.map((x) => new duelCandidate(x['c_id'], x['c_name'], res2.find((y) => y['id'] === x['c_id'])['votes']));
				this.initialized = true;
				this.roundNumber += 1;
				syslogger.info('Match initialized, candidates - ' + listOfCandidates);
			}))
		.catch((err) => syslogger.error('Cannot initialize match ' + err));
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

	next(){
		db.runQuery('SELECT cids FROM smsvoting.duel_matches where round_id = ?', [this.roundNumber + 1]).then((res) => {
			this.init(res[0]['cids']);
		});
	}

	processCommand(body){
		if (body.opcode == 'next'){
			this.next();
		} else if(this.initialized){
			switch(body.opcode){
				case 'setstate':
					this.setState(body.newState);
					break;
				case 'addvote':
					body.reset ? this.setCandidateVote(body.candidate, parseInt(body.score)) : this.addVoteToCandidate(body.candidate, parseInt(body.score));
					break;
				case 'addscore':
					this.setCandidateScore(body.candidate, parseInt(body.score));
				default:
					syslogger.error('Invalid opcode' + body.opcode);
			}
		} else {
			syslogger.error('Match not initialized yet');
		}
	}
	
	processVote(voteString, user){
		let person = this.listOfCandidates.find((x) => {return (x.id === parseInt(voteString))});
		return new Promise((resolve, reject) => {
			if (typeof person === 'udnefined'){
				logger.error("Received invalid vote to " + voteString + " from user " + user);
				return reject();
			} else {
				db.runQuery('INSERT INTO duel_votes(round, cid, voter) VALUES( ?, ?, ? )', [this.roundNumber, voteString, user ]).then(() => {
					person.addVote(1);
					logger.info('User ' + user + ' has voted on ' + voteString);
					return resolve(voteString);
				}).catch((err) => {
					logger.error('Invalid vote to ' + voteString + ' from ' + user + ' - ' + err );
					return reject();
				});
			}
		});	
    }
	
	writeResultToDb(){
		for(var candidate in this.listOfCandidates){
            db.runQuery('INSERT INTO smsvoting.duel_result(c_id, round_id, score, votes) VALUES( ?, ?, ?, ? )', [this.listOfCandidates[candidate].id, this.roundNumber, this.listOfCandidates[candidate].score, this.listOfCandidates[candidate].vote]);
        }
	}

	isVoting(){
        return (this.state === 'VOTING');
	}

	addVoteToCandidate(id, votecount){
        this.listOfCandidates.find((x) => {return (x.id === parseInt(id))}).addVote(votecount);
    }
    
    setCandidateVote(id, votecount){
        this.listOfCandidates.find((x) => {return (x.id === parseInt(id))}).setVote(votecount);
	}
	
	setCandidateScore(id, scorecount){
		this.listOfCandidates.find((x) => {return (x.id === parseInt(id))}).setScore(scorecount);		
	}
	
	compileResult(){
        return {state: this.state, type: 'Duel', round: this.roundNumber, timerRemain: this.timer.getRemaining(), data: (this.state === 'IDLE') ? null : this.listOfCandidates};
	}
	
	getMatchType(){
		return 'Duel';
	}
}

module.exports.duelMatch = duelMatch;