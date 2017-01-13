'use strict';
var internals = {

};
internals.mockRobotBrain = function() {
  var brain = {};
  return {
    get: function(key) {
      return brain[key];
    },
    set: function(key, val) {
      brain[key] = val;
    },
    post: function(when, callback) {
      setTimeout(callback, 1000);
    },
    users: function() {
      return [{
        name: 'test',
        id: 'test',
        real_name: 'test'
      },
        {
          name: 'test123',
          id: 'test123',
          real_name: 'test123'
        }];
    }
  };
};

exports.mockRobot = function () {
  return {
    brain: internals.mockRobotBrain(),

    logger: {
        info: function(expression) {
          console.log(expression);
        },
        error: function(expression) {
          console.log(expression);
        },
        debug: function(expression) {
          console.log(expression);
        }
    },
    once: function(when, callback) {
      setTimeout(callback, 1000);
    },
    emit: function (eventName, responseObject ) {
      return {
        eventName: eventName,
        responseObject: responseObject
      };
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
