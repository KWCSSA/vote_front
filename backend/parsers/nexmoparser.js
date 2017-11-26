var IParser = require( './IParser' );
var Message = require( '../models/message.js' ).Message;
var Nexmo = require( 'nexmo' );
var logger = require( '../logger.js' ).logger;
var Netmask = require('netmask').Netmask;

const nexmoIp = [new Netmask('174.37.245.32/29'), new Netmask('174.36.197.192/28'), new Netmask('173.193.199.16/28'), new Netmask('119.81.44.0/28')];

class NexmoParser extends IParser.IParser{
	constructor(){
		super();
		this.nexmo_api = new Nexmo({
			apiKey: process.env.nexmoApiKey,
			apiSecret: process.env.nexmoApiSecret,
		});
	}

	parseMessage(msg){
		return new Message(msg.msisdn, msg.text, msg.messageId);
	}

	sendMessage(number,msg){
		this.nexmo_api.message.sendSms(process.env.nexmoVirtualNumber, number, msg, (err, apiResponse)=>{
			//err is slightly broken, so we are implementing our own error handling
			if (err || apiResponse == null || apiResponse.messages[0].status !== '0'){
				logger.error('Cannot send SMS to ' + number + ' - Content: ' + msg );			
			} else {
				logger.info('SMS sent to ' + number + ' MessageID: ' + apiResponse.messages[0]['message-id']);
			}
		});
	}

	validateMessage(msg){
		let valid = false;
		nexmoIp.forEach((block) => {
			if (block.contains(req.ip.replace(/^.*:/, ''))) {
				valid = true;
			}
		});
		return valid;
	}
}

module.exports.NexmoParser = NexmoParser;

// {
// 	"msisdn":"15197816103",
// 	"to":"12893490912",
// 	"messageId":"0300000027F1072A",
// 	"text":"nexmo message",
// 	"type":"text",
// 	"message-timestamp":"2013-10-26 16:40:46"
// }
