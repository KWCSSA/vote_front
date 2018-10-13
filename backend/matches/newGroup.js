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
  constructor(id){
    super(id, 'lalala');
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

class NewGroupMatch{
  constructor(){
    this.state = 'IDLE';
    this.initialized = false;
    this.groupsOfCandidates = {};
    this.currentGroup = {};
    this.currentCandidate = null;
    this.listOfCandidates = [];
    this.timer = new timer(300000, ()=>{this.state = 'VOTED'}, 1000);
  }

  /**
  * Initialize the match
  * @param {number} votePerUser - The amount of votes per voter can cast
  * @param {string} listOfCandidates - List of candidates the voter can choose from
  * @return {Promise} Promise that initialize the match
  */
  init(){
    this.initialized = false;
    //did it this way to prevent escaping
    return db.runQuery('SELECT * FROM newGroupCandidates').then((res) => {
      res.map(row => {
        let groupNum = row['groupNum'];
        let candidates = row['ids'].split(',').replace(/ /g,'');
        let compiledCandidates = [];
        candidates.map(id => {compiledCandidates.push(new groupCandidate(id))});
        this.groupsOfCandidates.groupNum = compiledCandidates;
        this.listOfCandidates.concat(compiledCandidates);
      }
      syslogger.info('NewGroup match initialized, candidates - ' + listOfCandidates);
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
    } else (newstate === 'VOTED'){
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
    return {
      state: this.state,
      type: 'NewGroup',
      timerRemain: this.timer.getRemaining(),
      currentGroup: this.currentGroup.groupNum,
      currentCandidate: this.currentCandidate.id,
      data: ((this.state === 'IDLE') || (this.state === 'SINGLE')) ? null : this.listOfCandidates
    };
  }

  changeToGroup(groupNum) {
    this.currentCandidateIndex = -1;
    this.currentGroup = {
      groupNum: groupNum,
      groupCandidates: this.groupsOfCandidates[groupNum]
    }
  }

  changeToCandidate(index) {
    this.currentCandidate = this.currentGroup.groupCandidates[index];
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
    for(let candidate in this.currentGroup.groupCandidates){
      db.runQuery('INSERT INTO group_result(votes, id) VALUES( ?, ? )', [this.currentGroup.groupCandidates[candidate].vote, this.currentGroup.groupCandidates[candidate].id]);
    }
  }

  /**
  * Process an incoming command
  * @param {Object} body - The command body
  */
  processCommand(body){
    if(body.opcode == 'initMatch'){
      //initialize the match
      this.init();
    } else if(this.initialized){
      switch(body.opcode){
        //change match state
        case 'setstate':
          this.setState(body.newState);
          break;
        //add or set vote for a candidate
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

  /**
  * Process a voter's vote
  * @param {Object} voteString - The string user sent
  * @param {Object} user - The incoming number
  * @returns {Promise} Promise with the result of the vote
  */
  processVote(voteString, user){
    return db.runQuery('INSERT INTO group_votes(cids, voter) VALUES( ?, ? )', [ this.currentCandidate.id, user ]).then(() => {
      this.currentCandidate.addVote(1);
      logger.info('User ' + user + ' has voted on ' + this.currentCandidate.id);
      return this.currentCandidate.id;
    }).catch((err) => {
      logger.error('Invalid vote to ' + this.currentCandidate.id + ' from ' + user + ' - ' + err );
      throw new Error('Invalid vote to ' + this.currentCandidate.id + ' from ' + user + ' - ' + err );
    });
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
  return 'NewGroup';
}
}

module.exports.groupMatch = groupMatch;
