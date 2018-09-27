var GroupMatch = require('./group.js').groupMatch;
var DuelMatch = require('./duel.js').duelMatch;

/**
 * Create a match with given type.
 * @param {string} type - The match type
 * @return {Object} the created match 
 */
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