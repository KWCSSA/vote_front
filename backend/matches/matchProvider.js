var GroupMatch = require('./group.js').groupMatch;
var DuelMatch = require('./duel.js').duelMatch;
var NewGroupMatch = require('./newGroup.js').newGroupMatch;

/**
 * Create a match with given type.
 * @param {string} type - The match type
 * @return {Object} the created match
 */
function getMatch(type, socket) {
  switch (type) {
    case 'Group':
      return new GroupMatch(socket);
    case 'Duel':
      return new DuelMatch(socket);
    case 'NewGroup':
      return new NewGroupMatch(socket);
    default:
      throw 'Cannot get match';
  }
}

module.exports.getMatch = getMatch;
