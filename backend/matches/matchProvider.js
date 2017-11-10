var GroupMatch = require('./group.js').groupMatch;
var timedDuel = require('./timed_duel.js').timedDuelMatch;

function getMatch(type){
    switch(type){
        case 'Group':
            return new GroupMatch();
        case 'TimedDuel':
            return new timedDuel();
        default:
            throw 'Cannot get match';
    }
}

module.exports.getMatch = getMatch;