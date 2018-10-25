var db = require('../dbs/db.js');
var logger = require('../utils/logger.js').logger;
var syslogger = require('../utils/logger.js').sysLogger;
var voters = require('../utils/voters.js');
var timer = require('../utils/timer.js');
var candidate = require('../models/candidate.js').baseCandidate;

/**
* Candidate for group stage
* @extends candidate
*/
class groupCandidate extends candidate {
  constructor(id, name, groupNum) {
    super(id, name);
    this.group = groupNum;
    this.vote = 0;
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
}

class NewGroupMatch {
  constructor(socket) {
    this.state = 'IDLE';
    this.initialized = false;
    this.groupsOfCandidates = {
      '1': [],
      '2': [],
      '3': [],
      '4': []
    };
    this.currentGroup = null;
    this.currentCandidate = null;
    this.listOfCandidates = [];
    this.timer = new timer(180000, () => { this.state = 'VOTED' }, 1000, this.compileResult.bind(this));
    this.socket = socket;
  }

  /**
  * Initialize the match
  * @param {number} votePerUser - The amount of votes per voter can cast
  * @param {string} listOfCandidates - List of candidates the voter can choose from
  * @return {Promise} Promise that initialize the match
  */
  init() {
    this.state = 'IDLE';
    this.initialized = false;
    this.groupsOfCandidates = {
      '1': [],
      '2': [],
      '3': [],
      '4': []
    };
    this.currentGroup = null;
    this.currentCandidate = null;
    this.listOfCandidates = [];
    return db.runQuery('SELECT * FROM new_candidates').then((res) => {
      res.map(row => {
        let groupNum = row['groupNum'];
        let candidateId = parseInt(row['cid']);
        let candidateName = row['name'];
        this.groupsOfCandidates[groupNum].push(candidateId);
        this.listOfCandidates.push(new groupCandidate(candidateId, candidateName, groupNum));
      });
      syslogger.info('NewGroup match initialized');
      syslogger.info(`GroupOne: ${this.groupsOfCandidates['1']}`);
      syslogger.info(`GroupTwo: ${this.groupsOfCandidates['2']}`);
      syslogger.info(`GroupThree: ${this.groupsOfCandidates['3']}`);
      syslogger.info(`GroupFour: ${this.groupsOfCandidates['4']}`);
      this.initialized = true;
      this.compileResult();
    }).catch((err) => syslogger.error('Cannot initialize match ' + err));
  }

  /**
  * Update the state
  * @param {string} newstate - The state to update to
  */
  setState(newstate) {
    this.state = newstate;
    if (newstate === 'VOTING') {
      if (!this.currentGroup) {
        syslogger.error('Did not choose current group');
        this.setState('IDLE');
      } else if (!this.currentCandidate) {
        syslogger.error(`Did not choose current candidate from group: ${this.currentGroup.groupNum}`);
        this.setState('IDLE');
      } else {
        this.timer.start();
      }
    } else {
      this.timer.stop();
    }
    if (newstate === 'RESULT') {
      this.writeResultToDb();
    }
  }

  /**
  * Return the result
  * @return {Object} Object containing the information about the match
  */
  compileResult(doNotEmit) {
    let result = {
      state: this.state,
      type: 'NewGroup',
      timerRemain: this.timer.getRemaining(),
      currentGroup: this.currentGroup? this.currentGroup.groupNum : null,
      currentCandidateId: this.currentCandidate? this.currentCandidate.id : null,
      currentCandidateName: this.currentCandidate? this.currentCandidate.name : null,
      data: this.listOfCandidates
    };
    if (!doNotEmit) {
			this.socket.emit('resultUpdate', result);
		}
    return result;
  }

  changeToGroup(groupNum) {
    syslogger.info(`Changing to group: ${groupNum}`);
    this.currentGroup = {
      groupNum: groupNum,
      candidates: this.groupsOfCandidates[groupNum]
    }
    this.currentCandidate = null;
  }

  changeToCandidate(index) {
    syslogger.info(`Changing to candidate: #${index + 1} in group: ${this.currentGroup.groupNum}`);
    this.currentCandidate = this.listOfCandidates.find(e=> e.id === this.currentGroup.candidates[index]);
    this.setState('SINGLE');
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
  * Write current match result to database
  */
  writeResultToDb() {
    for(var candidate in this.listOfCandidates){
      if(this.listOfCandidates[candidate].group == this.currentGroup.groupNum)
        db.runQuery('INSERT INTO newgroup_result(votes, id) VALUES( ?, ? )', [this.listOfCandidates[candidate].vote, this.listOfCandidates[candidate].id]);
    }
  }

  /**
  * Process an incoming command
  * @param {Object} body - The command body
  */
  processCommand(body) {
    if (body.opcode == 'initMatch') {
      //initialize the match
      this.init();
    } else if (this.initialized) {
      switch (body.opcode) {
        //change match state
        case 'setstate':
          this.setState(body.newState);
          break;
        case 'changeGroup':
          if (this.isVoting()) {
            syslogger.error('Voting in progress');
          } else {
            this.changeToGroup(body.groupNum);
          }
          break;
        case 'changeCandidate':
          if (!this.currentGroup) {
            syslogger.error('Did not choose current group');
          } else if (this.isVoting()) {
            syslogger.error('Voting in progress');
          } else {
            this.changeToCandidate(Number(body.candidateIndex));
          }
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
    this.compileResult();
  }

  /**
  * Process a voter's vote
  * @param {Object} voteString - The string user sent
  * @param {Object} user - The incoming number
  * @returns {Promise} Promise with the result of the vote
  */
  processVote(voteString, user) {
    return db.runQuery('INSERT INTO newgroup_votes(groupNum, cid, voter) VALUES( ?, ?, ? )', [this.currentGroup.groupNum, this.currentCandidate.id, user]).then(() => {
      this.addVoteToCandidate(this.currentCandidate.id, 1);
      logger.info('User ' + user + ' has voted on ' + this.currentCandidate.id);
      this.compileResult();
      return this.currentCandidate.id;
    }).catch((err) => {
      logger.error('Invalid vote to ' + this.currentCandidate.id + ' from ' + user + ' - ' + err);
      throw new Error('Invalid vote to ' + this.currentCandidate.id + ' from ' + user + ' - ' + err);
    });
  }

  /**
  * See if currently accepting votes
  * @returns {boolean} the result of the check
  */
  isVoting() {
    return (this.state === 'VOTING');
  }

  /**
  * Get current match type
  * @returns {string} the match type
  */
  getMatchType() {
    return 'NewGroup';
  }
}

module.exports.newGroupMatch = NewGroupMatch;
