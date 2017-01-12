'use strict';

var _ = require('underscore'),
  Fuse = require('fuse.js');

var internals = {
  BRAIN_USERS_KEY: 'githubUserIdsByHubotUsername'
};

var _this = this;

internals.getUsers = function(robot_brain) {
  if (robot_brain.adapter != null && robot_brain.adapter.client != null
    && robot_brain.adapter.client.rtm != null
    && robot_brain.adapter.client.rtm.dataStore != null) {
    return robot_brain.adapter.client.rtm.dataStore.users;
  }
  else {
    return robot_brain.users();
  }
};

/**
 * Searches for hubot_user user witht he given username.
 * @param {Object} robot_brain The Hubot brain.
 * @param {String} hubot_username Username known by Hubot.
 */
exports.findUser = function(robot_brain, hubot_username) {
  var f, results, users;
  users = internals.getUsers();
  users = _(users).keys().map(function(id) {
    var u;
    u = users[id];
    return {
      id: u.id,
      name: u.name,
      real_name: u.real_name
    };
  });
  f = new Fuse(users, {
    keys: ['name'],
    shouldSort: true,
    verbose: false,
    threshold: 0.55
  });
  results = f.search(hubot_username);
  if (results && results.length >= 1) {
    return results[0];
  }
  else {
    return 0;
  }
};

/**
 * Stores the provided user <-> github mapping in persistence.
 * @param {Object} robot_brain The Hubot brain.
 * @param {String} hubot_username Username known by Hubot.
 * @param {String} github_user ID of Github user.
 */
exports.rememberUser = function(robot_brain, hubot_user, github_user) {
  var user_ids_by_username = robot_brain.get(internals.BRAIN_USERS_KEY);
  if (!user_ids_by_username) {
    user_ids_by_username = {};
  }

  user_ids_by_username[hubot_user] = github_user;
  robot_brain.set(internals.BRAIN_USERS_KEY, user_ids_by_username);
};


exports.lookupUserWithHubot = function(robot_brain, hubot_username){
  var user_ids_by_username = robot_brain.get(internals.BRAIN_USERS_KEY);
  if (!user_ids_by_username) {
    return undefined;
  }
  return  user_ids_by_username[hubot_username];
};


exports.lookupUserWithGithub = function(robot_brain, github_username){
  var user_ids_by_username = robot_brain.get(internals.BRAIN_USERS_KEY);
  if (!user_ids_by_username) {
    return undefined;
  }

  var hubotUser = _.findKey(user_ids_by_username, function(github) {
    return github === github_username;
  });
  if (hubotUser) {
    _this.findUser(robot_brain, hubotUser);
  }
  else {
    _this.findUser(robot_brain, github_username);
  }
};

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
