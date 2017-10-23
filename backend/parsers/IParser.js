class Message{
	constructor(sender = '', message = '', messageId = ''){
		this.sender = sender;
		this.message = message;
		this.messageId = messageId;
		this.messageTime = (new Date().toUTCString());
	}
}

//Interface, unfortunately JS does not support interface, so be sure don't directly use it
class IParser{
	parseMessage(msg){throw('Trying to access function of interface class IParser')}
	sendMessage(number, msg){throw('Trying to access function of interface class IParser')}
}
module.exports.Message = Message;
module.exports.IParser = IParser;