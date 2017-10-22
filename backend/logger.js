var winston = require('winston');
var fs = require('fs');

const logDir = 'log';

if (!fs.existsSync(logDir)){
	fs.mkdirSync(logDir);
}

var logger = new(winston.Logger)({
	level: 'info',
	transports: [
		new winston.transports.File({ name: 'error', filename: `./${logDir}/error.log`, level: 'error' }),
		new winston.transports.File({ name: 'other', filename: `./${logDir}/combined.log` }),
		new winston.transports.Console({name: 'console', })
	]
});

var smsLogger = new(winston.Logger)({
	transports: [
		new winston.transports.File({ name: 'error', filename: `./${logDir}/smsError.log`, level: 'error' }),
    	new winston.transports.File({ name: 'info', filename: `./${logDir}/smsInfo.log`, level: 'info' })
	]
});

module.exports.logger = logger;
module.exports.smsLogger = smsLogger;