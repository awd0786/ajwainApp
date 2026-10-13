/**
 * Extends app.json at build time.
 *
 * Android push notifications need Firebase Cloud Messaging. Put the
 * `google-services.json` you download from the Firebase console in the project
 * root and it is picked up automatically; without it the app still builds,
 * but Android devices can't receive pushes.
 */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const gs = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(gs)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
