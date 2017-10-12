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
    	new winston.transports.File({ name: 'other', filename: `./${logDir}/combined.log` })
	]
});

module.exports = logger;
