'use strict';
// Motive of batch V2 (weddings II): the parts live in _v2-*.js (an underscore: the build only loads m-*.js).
module.exports = { pieces: [
  ...require('./_v2-rock').pieces,
  ...require('./_v2-nature').pieces,
  ...require('./_v2-ritter').pieces,
] };
