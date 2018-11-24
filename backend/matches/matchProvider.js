var GroupMatch = require('./group.js').groupMatch;
var DuelMatch = require('./duel.js').duelMatch;
var NewGroupMatch = require('./newGroup.js').newGroupMatch;

gm = null;
dm = null;
ngm = null;

/**
* Create a match with given type.
* @param {string} type - The match type
* @return {Object} the created match
*/
function getMatch(type){
    switch(type){
        case 'Group':
            if (gm == null) gm = new GroupMatch();
            return gm;
        case 'Duel':
            if (dm == null) dm = new DuelMatch();
            return gm;
        case 'NewGroup':
            if (ngm == null) ngm = new NewGroupMatch();
            return ngm;
        default:
            throw 'Cannot get match';
    }
}

module.exports.getMatch = getMatch;
