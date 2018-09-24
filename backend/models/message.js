class Message{
	constructor(sender = '', message = '', messageId = ''){
		this.sender = sender;
		this.message = message;
		this.messageId = messageId;
		this.messageTime = (new Date().toUTCString());
	}
}

module.exports.Message = Message;