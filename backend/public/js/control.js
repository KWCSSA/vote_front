// var baseURL = 'http://test.tinnytian.com:8081';
var baseURL = 'http://localhost:8080';
var socket = io();

// socket.io events
socket.on('connect', function () {
	console.log('Connected to server');
});

socket.on('resultUpdate', function (data) {
	$("#resultBar").html(JSON.stringify(data));
	if (data.state != 'IDLE') {
		//$("#cmdSetCid").attr( 'disabled', 'disabled' );
		//$("#BtnSubmitSetRound").attr( 'disabled', 'disabled' );
	} else {
		$("#cmdSetCid").removeAttr('disabled');
		$("#BtnSubmitSetRound").removeAttr('disabled');
	}
});

// function updateResultBar() {
// 	$.ajax({
// 		method: 'GET',
// 		url: baseURL + '/result',
// 		dataType: 'json',
// 		success: function (data) {
// 			$("#resultBar").html(JSON.stringify(data));
// 			if (data.state != 'IDLE') {
// 				//$("#cmdSetCid").attr( 'disabled', 'disabled' );
// 				//$("#BtnSubmitSetRound").attr( 'disabled', 'disabled' );
// 			} else {
// 				$("#cmdSetCid").removeAttr('disabled');
// 				$("#BtnSubmitSetRound").removeAttr('disabled');
// 			}

// 		}
// 	});
// }

// setInterval("updateResultBar()", 500);

function sendVoteCommand(cmd) {
	socket.emit('newVoteCommand', cmd);
}

function sendControlCommand(cmd) {
	socket.emit('newControlCommand', cmd);
}

function switchToState(state, match) {
	var cmd = {
		opcode: 'setstate',
		matchType: match,
		newState: state
	};

	if (state == 'RANK') {
		if (confirm('Accept votes?')) {
			cmd.acceptingVotes = 'true';
		} else {
			cmd.acceptingVotes = 'false';
		}
	}


	sendVoteCommand(cmd);
}

function setCandidateID() {
	var candidates = [];
	for (i = 1; i <= 24; ++i) {
		if (document.forms["setCidForm"][(i - 1).toString()].checked) {
			candidates.push(i.toString());
		}
	}
	var votePerUser = document.forms["setCidForm"]["voteperuser"].value;
	//alert(candidates);
	var cmd = {
		opcode: 'setcids',
		cids: candidates.join(),
		matchType: 'Group',
		votePerUser: parseInt(votePerUser)
	};

	sendVoteCommand(cmd);
}

function addScore() {
	var score = document.forms["addScoreForm"]["scorebox"].value;
	var reset = document.forms["addScoreForm"]["resetbox"].checked;
	var candidate = document.forms["addScoreForm"]["candidatebox"].value;

	if (parseInt(score).toString() !== score) {
		alert('Invalid score');
		return;
	}

	var cmd = {
		opcode: 'addvote',
		score: score,
		matchType: 'Group',
		candidate: candidate
	};

	if (reset) {
		cmd.reset = 'true';
	}

	sendVoteCommand(cmd);

}

function tdSetRoundID() {
	var roundID = document.forms["SetRoundIDForm"]["RoundIDInput"].value;
	var conclude = document.forms["SetRoundIDForm"]["TDConcludeInput"].checked;

	if (parseInt(roundID).toString() !== roundID) {
		alert('Invalid round');
		return false;
	}

	var cmd = {
		opcode: 'setround',
		matchType: 'Duel',
		roundId: roundID
	};

	if (conclude) {
		cmd.concluded = 'true';
	}

	sendVoteCommand(cmd);
}

function tdSetScore() {
	var s = document.forms["TDAddScoreForm"]["ScoreInput"].value;
	var c_id = document.forms["TDAddScoreForm"]["CIDInput"].value;

	if (parseInt(s).toString() !== s) {
		alert('Invalid score');
		return false;
	}

	if (parseInt(c_id).toString() !== c_id) {
		alert('Invalid Candidate ID');
		return false;
	}

	var cmd = {
		opcode: 'setscore',
		matchType: 'Duel',
		candidate: c_id,
		score: s
	};

	sendVoteCommand(cmd);
}

function tdAddVote() {
	var s = document.forms["TDAddVoteForm"]["VoteInput"].value;
	var c_id = document.forms["TDAddVoteForm"]["CIDInput"].value;
	var r = document.forms["TDAddVoteForm"]["TDResetVoteInput"].checked;

	if (parseInt(s).toString() !== s) {
		alert('Invalid score');
		return false;
	}

	if (parseInt(c_id).toString() !== c_id) {
		alert('Invalid Candidate ID');
		return false;
	}

	var cmd = {
		opcode: 'addvote',
		matchType: 'Duel',
		candidate: c_id,
		score: s
	};

	if (r) {
		cmd.reset = 'true';
	}

	sendVoteCommand(cmd);
}

/*function tdSetTimer() {
	var t = document.forms["TDSetTimerForm"]["SetTimerInput"].value;

	if( parseInt( t ).toString() !== t ) {
		alert( 'Invalid timer' );
		return false;
	}

	var cmd = { opcode: 'settimer',
	cd: parseInt( t ) };

	sendVoteCommand( cmd );
}*/

function pollAudienceWinner() {
	var notify = document.forms["PollAudienceWinnerForm"]["NotifyWinnerInput"].checked;
	var delay = document.forms["PollAudienceWinnerForm"]["NotifyWinnerDelayInput"].value;

	var cmd = { opcode: 'poll' };

	if (notify) {
		cmd.notifyWinner = 'true';
	}

	if (parseInt(delay).toString() === delay) {
		cmd.delay = delay;
	}

	sendControlCommand(cmd);
}

function addScoreNG() {
	var score = document.forms["addScoreFormNG"]["scorebox"].value;
	var reset = document.forms["addScoreFormNG"]["resetbox"].checked;
	var candidate = document.forms["addScoreFormNG"]["candidatebox"].value;

	if (parseInt(score).toString() !== score) {
		alert('Invalid score');
		return;
	}

	var cmd = {
		opcode: 'addvote',
		score: score,
		matchType: 'NewGroup',
		candidate: candidate
	};

	if (reset) {
		cmd.reset = 'true';
	}

	sendVoteCommand(cmd);

}

function changeGroup(groupNum) {
	var cmd = {
		opcode: 'changeGroup',
		groupNum: groupNum,
		matchType: 'NewGroup'
	}

	sendVoteCommand(cmd);
}

function changeCandidate(candIndex) {
	var cmd = {
		opcode: 'changeCandidate',
		candidateIndex: candIndex,
		matchType: 'NewGroup'
	}

	sendVoteCommand(cmd);
}

function initNewGroupMatch() {
	var cmd = {
		opcode: 'initMatch',
		matchType: 'NewGroup'
	}

	sendVoteCommand(cmd);
}
