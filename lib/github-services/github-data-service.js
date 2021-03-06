'use strict';

var _ = require('underscore');

var utils = require('../utils'),
    PullRequestObject = require('./pr-object').PullRequestObject;

var internals = {
  GITHUB_PULL_REQUESTS_CACHE: 'github-pr-cache'
};

exports.openForUser = function(robot, hubot_username, is_author) {
  var pull_requests_data = robot.brain.get(internals.GITHUB_PULL_REQUESTS_CACHE);
  var github_username = utils.lookupUserWithHubot(robot.brain, hubot_username.name);
  robot.logger.info('Getting oper pr for  ' + hubot_username.name);
  if (!github_username) {
    github_username = hubot_username.name;
    robot.logger.info('No guthub username provided for ' + hubot_username.name);
    robot.emit('NoGithubUserProvided', hubot_username);
  }

  var pull_requests_for_user = [];
  if (pull_requests_data) {
    for (var i = 0, len = pull_requests_data.length; i < len; i++) {
      var pr = pull_requests_data[i];
      if (is_author) {
        if (pr.author === github_username) {
          pull_requests_for_user.push( new PullRequestObject(pr));
        }
      }
      else {
        var assignees_list = pr.assignees;
        for (var j = 0, len1 = assignees_list.length; j < len1; j++) {
          var assignee = assignees_list[j];
          if (assignee === github_username) {
            pull_requests_for_user.push(new PullRequestObject(pr));
          }
        }
      }
    }
  }
  return robot.emit('GithubPullRequestsOpenForUser', pull_requests_for_user, hubot_username);
};

exports.updatePullRequestsCache = function(robot, pullRequestObject) {
  var pull_requests_cached_data = robot.brain.get(internals.GITHUB_PULL_REQUESTS_CACHE);
  var pull_requests_cached = _.without(pull_requests_cached_data,
    _.findWhere(pull_requests_cached_data, {
    number: pullRequestObject.number,
    repo: pullRequestObject.repo
  }));
  if (pullRequestObject.state === 'open') {
    pull_requests_cached.push(pullRequestObject);
  }
  robot.brain.set(internals.GITHUB_PULL_REQUESTS_CACHE, pull_requests_cached);
};
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
