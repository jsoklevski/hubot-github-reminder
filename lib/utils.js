'use strict';

var _ = require('underscore'),
  Fuse = require('fuse.js');

var internals = {
  BRAIN_USERS_KEY: 'githubUserIdsByHubotUsername'
};

var _this = this;

internals.getUsers = function(robot) {
  if (robot.adapter && robot.adapter.client
    && robot.adapter.client.rtm
    && robot.adapter.client.rtm.dataStore ) {
    return robot.adapter.client.rtm.dataStore.users;
  }
  else {
    return robot.brain.users();
  }
};

exports.formatPullRequest = function(fetched_pull_request, statusChecks, action) {
  var assignees_list = [];
  var pr_assignees = fetched_pull_request.assignees;
  if (pr_assignees && pr_assignees.length > 0) {
    pr_assignees.map(function(assignee) {
      assignees_list.push(assignee.login);
    });
  }
  if (!statusChecks) {
    statusChecks = {};
  }
  if (!action) {
    action = '';
  }
  return {
    number: fetched_pull_request.number,
    url: fetched_pull_request.htmlUrl,
    state: fetched_pull_request.state,
    title: fetched_pull_request.title,
    author: fetched_pull_request.user.login,
    updatedAt: fetched_pull_request.updatedAt,
    mergeable: fetched_pull_request.mergeable,
    additions: fetched_pull_request.additions,
    deletions: fetched_pull_request.deletions,
    assignees: assignees_list,
    repo: fetched_pull_request.head.repo.name,
    statusChecks: statusChecks,
    action: action
  };
};

exports.processStatuses = function(checks) {
  var checks_map = {};
  if (checks || checks.length > 0) {
    checks.map(function(check) {
      var check_state = checks_map[check.context];
      if (!check_state) {
        checks_map[check.context] = check.state;
      }
      else if (check_state === 'pending') {
        checks_map[check.context] = check.state;
      }
    });
  }
  var pending_checks = false;
  var all_checks_passed = true;
  for (var k in checks_map) {
    if (checks_map.hasOwnProperty(k)) {
      var v = checks_map[k];
      if (all_checks_passed && (v === 'error' || v === 'failure')) {
        all_checks_passed = false;
      }
      if (!pending_checks && v === 'pending') {
        pending_checks = true;
      }
    }
  }
  return {
    allChecksPassed: all_checks_passed,
    pendingChecks: pending_checks,
    checksMap: checks_map
  };
};

exports.findUser = function(robot, hubot_username) {
  var f, results, users;
  users = internals.getUsers(robot);
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
    threshold: 0.0
  });
  results = f.search(hubot_username);
  if (results && results.length >= 1) {
    return results[0];
  }
  else {
    return undefined;
  }
};

/**
 * Stores the provided user <-> github mapping in persistence.
 * @param {Object} robot_brain The Hubot brain.
 * @param {String} hubot_user Username known by Hubot.
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


exports.lookupUserWithGithub = function(robot, github_username){
  var user_ids_by_username = robot.brain.get(internals.BRAIN_USERS_KEY);
  if (!user_ids_by_username) {
    return undefined;
  }

  var hubotUser = _.findKey(user_ids_by_username, function(github) {
    return github === github_username;
  });
  if (hubotUser) {
    return _this.findUser(robot, hubotUser);
  }
  else {
    return _this.findUser(robot, github_username);
  }
};

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
