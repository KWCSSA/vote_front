//Interface, unfortunately JS does not support interface, so be sure don't directly use it
/**
 * Parser class interface
 * @interface
 */

class IParser{
	parseMessage(msg){throw('Trying to access function of interface class IParser')}
	sendMessage(number, msg){throw('Trying to access function of interface class IParser')}
}

module.exports.IParser = IParser;