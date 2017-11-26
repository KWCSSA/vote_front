var IParser = require( './IParser' );
var Message = require( '../models/message.js' ).Message;
var logger = require( '../logger.js' ).logger;

const accountSid = process.env.twilioAccountSid;
const authToken = process.env.twilioAuthToken;
const twilioNumber = process.env.twilioVirtualNumber;

class TwilioParser extends IParser.IParser{
	constructor(){
		super();
		this.client = require('twilio')(accountSid, authToken);
	}

	parseMessage(msg){
		return new Message(msg.from, msg.body, msg.sid);
	}

	sendMessage(number,msg){
		this.client.messages.create({
			to: number,
			from: twilioNumber,
			body: msg
		})
		.then((message) => logger.info('SMS sent to ' + number + ' MessageID: ' + message.sid))
		.catch((err) => logger.error('Cannot send SMS to ' + number + ' - Content: ' + msg));
	}

	checkMessage(msg){ 
		return ((typeof msg.from !== "undefined") && (msg.to === twilioNumber) && (typeof msg.sid !== "undefined") && (typeof msg.body !== "undefined"));
	}
}

module.exports.TwilioParser = TwilioParser;

// {
// 	"AccountSid":"ACb4c0db00d68a2fd3ed2887d7f2c8fb6c",
// 	"MessageSid":"SMb2f2333441352d2ca7e815ae6e3bc4fe",
// 	"Body":"lalal",
// 	"ToZip":"",
// 	"ToCity":"GUELPH",
// 	"FromState":"ON",
// 	"ToState":"ON",
// 	"SmsSid":"SMb2f2333441352d2ca7e815ae6e3bc4fe",
// 	"To":"+12267804517",
// 	"ToCountry":"CA",
// 	"FromCountry":"CA",
// 	"SmsMessageSid":"SMb2f2333441352d2ca7e815ae6e3bc4fe",
// 	"ApiVersion":"2010-04-01",
// 	"FromCity":"KITCHENER",
// 	"SmsStatus":"received",
// 	"NumMedia":"0",
// 	"From":"+15197816103",
// 	"FromZip":""
// }
