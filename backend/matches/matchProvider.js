var GroupMatch = require('./group.js').groupMatch;
var DuelMatch = require('./duel.js').duelMatch;

function getMatch(type){
    switch(type){
        case 'Group':
            return new GroupMatch();
        case 'Duel':
            return new DuelMatch();
        default:
            throw 'Cannot get match';
    }
}

module.exports.getMatch = getMatch;