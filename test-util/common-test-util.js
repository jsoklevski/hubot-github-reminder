'use strict';

exports.mockRobotBrain = function() {
  var brain = {};
  return {
    get: function(key) {
      return brain[key];
    },
    set: function(key, val) {
      brain[key] = val;
    }
  };
};


exports.mockInputMessage = function(pattern, test_string, username) {
  var msg = {};
  msg.match = test_string.match(pattern);
  msg.message = {
    user: { name: username }
  };
  return msg;
};
