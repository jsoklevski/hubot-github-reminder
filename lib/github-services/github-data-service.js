'use strict';

var _ = require('underscore');

var utils = require('../utils'),
    PullRequestObject = require('./pr-object').PullRequestObject;

var internals = {
  GITHUB_PULL_REQUESTS_CACHE: 'github-pr-cache'
};

exports.openForUser = function(robot, hubot_username) {
  var pull_requests_data = robot.brain.get(internals.GITHUB_PULL_REQUESTS_CACHE);
  robot.logger.info('Find open pr for ' + hubot_username.name);
  var github_username = utils.lookupUserWithHubot(robot.brain, hubot_username.name);
  if (!github_username) {
    github_username = hubot_username.name;
    robot.emit('NoGithubUserProvided', hubot_username);
  }

  var pull_requests_for_user = [];
  if (pull_requests_data) {
    for (var i = 0, len = pull_requests_data.length; i < len; i++) {
      var pr = pull_requests_data[i];
      var assignees_list = pr.assignees;
      for (var j = 0, len1 = assignees_list.length; j < len1; j++) {
        var assignee = assignees_list[j];
        if (assignee) {
          if (assignee === github_username) {
            var pull_request_object = new PullRequestObject(pr);
            pull_requests_for_user.push(pull_request_object);
          }
        }
      }
    }
  }
  return robot.emit('GithubPullRequestsOpenForUser', pull_requests_for_user, hubot_username);
};

exports.updatePullRequestsCache = function(robot, pullRequest) {
  var pull_requests_cached_data = robot.brain.get(internals.GITHUB_PULL_REQUESTS_CACHE);
  robot.logger.info('New PullRequest Event');
  var assignees_list = [];
  pullRequest.assignees.map(function(assignee) {
    return assignees_list.push(assignee.login);
  });
  var pullRequestObject = {
    number: pullRequest.number,
    url: pullRequest.html_url,
    state: pullRequest.state,
    title: pullRequest.title,
    author: pullRequest.user.login,
    updatedAt: pullRequest.updatedAt,
    mergeable: pullRequest.mergeable,
    additions: pullRequest.additions,
    deletions: pullRequest.deletions,
    assignees: assignees_list,
    repo: pullRequest.repo.name
  };
  var pullrequests_cached = _.without(pull_requests_cached_data,
    _.findWhere(pull_requests_cached_data, {
    number: pullRequestObject.number,
    repo: pullRequestObject.repo
  }));
  pullrequests_cached.push(pullRequestObject);
  return robot.brain.set(internals.GITHUB_PULL_REQUESTS_CACHE, pullrequests_cached);
};
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
