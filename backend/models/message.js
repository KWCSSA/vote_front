/** Model for Messages */
class Message{
	/**
     * Create a message with current time.
     * @param {string} sender - The message sender
     * @param {string} message - The message body content
     * @param {string} messageId - The unique id for the message
     */
	constructor(sender = '', message = '', messageId = ''){
		this.sender = sender;
		this.message = message;
		this.messageId = messageId;
		this.messageTime = (new Date().toUTCString());
	}
}

module.exports.Message = Message;