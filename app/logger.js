'use strict';
const logger = require('winston');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
require('winston-loggly-bulk');

module.exports = () => {
  const logDir = path.join(process.env.APPDATA, 'ControlCast');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
  const logFolder = path.join(logDir, 'logs');
  if (!fs.existsSync(logFolder)) fs.mkdirSync(logFolder);

  // Log to console
  logger.remove(logger.transports.Console);
  logger.add(logger.transports.Console, {
    colorize: true,
    level: 'debug',
    timestamp: moment().utc().format(),
  });

  // Log to file
  logger.add(logger.transports.File, {
    filename: path.join(logFolder, 'info.log'),
    json: false,
    level: 'info',
    prepend: true,
    timestamp: moment().utc().format(),
  });

  // Log to Loggly
  logger.add(logger.transports.Loggly, {
    level: 'info',
    token: '969270cc-c93f-4c40-8b53-282076a15c1f',
    subdomain: 'dbkynd',
    tags: ['Winston-NodeJS'],
    json: true,
  });

  process.on('unhandledRejection', logger.error);
  return logger;
};
