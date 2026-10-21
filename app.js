'use strict';
/**
 * Root entry point for hosting providers like GoDaddy cPanel (Phusion Passenger),
 * Railway, Heroku, or Plesk that expect app.js in the application root.
 */
const { main } = require('./server/src/index');

main().catch(err => {
  console.error('Fatal startup error in ZKSurvey:', err);
  process.exit(1);
});

module.exports = require('./server/src/app');
