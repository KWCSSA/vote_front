class baseCandidate{
    constructor(id, name){
        this.id = id;
        this.name = name;
        this.vote = 0;
        this.score = 0;
    }

    addVote(count){
        this.vote += count;
    }

    setVote(count){
        this.vote = count;
    }
}

module.exports.baseCandidate = baseCandidate;