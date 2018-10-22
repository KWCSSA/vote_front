var db = require('../dbs/db.js');
var logger = require('../utils/logger.js').logger;
var syslogger = require('../utils/logger.js').sysLogger;
var timer = require('../utils/timer.js');
var candidate = require('../models/candidate.js').baseCandidate;

/**
 * Candidate for duel matches
 * @extends candidate
 */
class duelCandidate extends candidate {
	constructor(id, name, firstRoundVote) {
		super(id, name);
		this.vote = 0;
		this.score = 0;
		this.firstRoundVote = firstRoundVote;
	}

	/**
     * Add vote to the candidate
     * @param {number} count - The amount to add
	 */
	addVote(count) {
		this.vote += count;
	}

	/**
     * Set vote amount for the candidate
     * @param {number} count - The amount to set to
	 */
	setVote(count) {
		this.vote = count;
	}

	/**
     * Set scpre for the candidate
     * @param {number} count - The amount to set to
	 */
	setScore(count) {
		this.score = count;
	}

	/**
     * Get the weighted total score of a candidate
     * @return {number} the weighted score
	 */
	getTotal() {
		//temp function, might have to change in the future
		return this.vote * 0.45 + this.score * 0.45 + this.firstRoundVote * 0.1;
	}
}

class duelMatch {
	constructor(socket) {
		this.state = 'IDLE';
		this.initialized = false;
		this.roundNumber = 0;
		this.timer = new timer(300000, () => { this.state = 'VOTED' }, 1000, this.compileResult.bind(this));
		this.socket = socket;
	}

	/**
     * Initialize the match
     * @param {string} listOfCandidates - List of candidates the voter can choose from
     * @return {Promise} Promise that initialize the match
	 */
	init(listOfCandidates) {
		this.initialized = false;
		return db.runQuery('SELECT * FROM smsvoting.candidates where c_id in ( ' + listOfCandidates + ' );')
			.then((res) =>
				db.runQuery('SELECT * FROM smsvoting.group_result where id in ( ' + listOfCandidates + ' );').then((res2) => {
					this.listOfCandidates = res.map((x) => {
						let firstRoundCandidate = res2.find((y) => y['id'] === x['c_id']);
						let firstRoundVote = firstRoundCandidate ? firstRoundCandidate['votes'] : 0;
						return new duelCandidate(x['c_id'], x['c_name'], firstRoundVote);
					})
					syslogger.info('Duel match initialized, candidates - ' + listOfCandidates);
					this.initialized = true;
					this.compileResult();
				}))
			.catch((err) => syslogger.error('Cannot initialize match ' + err));
	}

	/**
     * Update the state
     * @param {string} newstate - The state to update to
	 */
	setState(newstate) {
		this.state = newstate;
		if (newstate === 'VOTING') {
			this.timer.start();
		} else {
			this.timer.stop();
		}
		if (newstate === 'RESULT') {
			this.writeResultToDb();
		}
	}

	/**
     * Update the match to be in the next round
     * @param {number} roundId - The round number to update to
	 */
	setRound(roundId) {
		db.runQuery('SELECT cids FROM smsvoting.duel_matches where round_id = ?', [roundId]).then((res) => {
			this.init(res[0]['cids']);
			this.roundNumber = roundId;
		});
	}

	/**
     * Process an incoming command
     * @param {Object} body - The command body
	 */
	processCommand(body) {
		if (body.opcode == 'setround') {
			this.setRound(body.roundId);
		} else if (this.initialized) {
			switch (body.opcode) {
				case 'setstate':
					this.setState(body.newState);
					break;
				case 'addvote':
					body.reset ? this.setCandidateVote(body.candidate, parseInt(body.score)) : this.addVoteToCandidate(body.candidate, parseInt(body.score));
					break;
				case 'setscore':
					this.setCandidateScore(body.candidate, parseInt(body.score));
					break;
				default:
					syslogger.error('Invalid opcode - ' + body.opcode);
			}
		} else {
			syslogger.error('Match not initialized yet');
		}
		this.compileResult();
	}

	/**
     * Process a voter's vote
     * @param {Object} voteString - The string user sent
     * @param {Object} user - The incoming number
     * @returns {Promise} Promise with the result of the vote
	 */
	processVote(voteString, user) {
		let person = this.listOfCandidates.find((x) => { return (x.id === parseInt(voteString)) });
		return new Promise((resolve, reject) => {
			if (typeof person === 'udnefined') {
				logger.error("Received invalid vote to " + voteString + " from user " + user);
				return reject();
			} else {
				db.runQuery('INSERT INTO duel_votes(round, cid, voter) VALUES( ?, ?, ? )', [this.roundNumber, voteString, user]).then(() => {
					person.addVote(1);
					logger.info('User ' + user + ' has voted on ' + voteString);
					this.compileResult();
					return resolve(voteString);
				}).catch((err) => {
					logger.error('Invalid vote to ' + voteString + ' from ' + user + ' - ' + err);
					return reject();
				});
			}
		});
	}

	/**
     * Write current match result to database
	 */
	writeResultToDb() {
		for (var candidate in this.listOfCandidates) {
			db.runQuery('INSERT INTO smsvoting.duel_result(c_id, round_id, score, votes) VALUES( ?, ?, ?, ? )', [this.listOfCandidates[candidate].id, this.roundNumber, this.listOfCandidates[candidate].score, this.listOfCandidates[candidate].vote]);
		}
	}

	/**
     * See if currently accepting votes
     * @returns {boolean} the result of the check
	 */
	isVoting() {
		return (this.state === 'VOTING');
	}

	/**
     * Add vote to a candidate
     * @param {number} id - The candidate id
     * @param {number} votecount - Amount of votes
	 */
	addVoteToCandidate(id, votecount) {
		this.listOfCandidates.find((x) => { return (x.id === parseInt(id)) }).addVote(votecount);
	}

	/**
	 * Set vote count of a candidate
	 * @param {number} id - The candidate id
	 * @param {number} votecount - Amount of votes
 */
	setCandidateVote(id, votecount) {
		this.listOfCandidates.find((x) => { return (x.id === parseInt(id)) }).setVote(votecount);
	}

	/**
     * Set score of a candidate
     * @param {number} id - The candidate id
     * @param {number} scorecount - Score count
	 */
	setCandidateScore(id, scorecount) {
		this.listOfCandidates.find((x) => { return (x.id === parseInt(id)) }).setScore(scorecount);
	}

	/**
     * Return the result
     * @return {Object} Object containing the information about the match
	 */
	compileResult() {
		let result = { state: this.state, type: 'Duel', round: this.roundNumber, timerRemain: this.timer.getRemaining(), data: (this.state === 'IDLE') ? null : this.listOfCandidates };
		this.socket.emit('resultUpdate', result);
		return result;
	}

	/**
     * Get current match type
     * @returns {string} the match type
	 */
	getMatchType() {
		return 'Duel';
	}
}

module.exports.duelMatch = duelMatch;
