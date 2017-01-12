'use strict';

var _ = require('underscore'),
    Octokat = require('octokat'),
    CronJob = require('cron').CronJob;


var utils = require('../utils');

var internals = {
  HUBOT_GITHUB_TOKEN: process.env.HUBOT_GITHUB_TOKEN,
  HUBOT_GITHUB_ORG: process.env.HUBOT_GITHUB_ORG,
  GITHUB_PULL_REQUESTS_CACHE: 'pr-status-checks'
};


function PrStatusCheckWorker(robot) {
  this.robot = robot;
  var _this = this;
  robot.brain.once('loaded', function() {
    return new CronJob('0 */5 * * * *',  _this.check.bind(_this), null, true);
  });
}

PrStatusCheckWorker.prototype.getStatusChecks = function() {
  return this.robot.brain.get(internals.GITHUB_PULL_REQUESTS_CACHE) || [];
};

PrStatusCheckWorker.prototype.saveStatusChecks = function(reminders) {
  return this.robot.brain.set(internals.GITHUB_PULL_REQUESTS_CACHE, reminders);
};

PrStatusCheckWorker.prototype.check = function() {
  try {
    this.robot.logger.info('Checking for status updates on prs');
    var octo = new Octokat({
      token: internals.HUBOT_GITHUB_TOKEN
    });
    var robot = this.robot;

    var reminders = this.getStatusChecks();
    if (reminders && reminders.length > 0) {
      reminders.map()(function(reminder) {
        var repo;
        repo = octo.repos(internals.HUBOT_GITHUB_ORG, reminder.repoName);
        repo.pulls(reminder.pr).fetch().then(function(pr) {
          octo.fromUrl(pr.Links.statuses.href).fetch().then(function(checks) {
            var status_result;
            status_result = internals.processStatuses(checks);
            if (!status_result.pendingChecks) {
              internals.findUsersAndFireEvents(robot, pr, reminder.repoName, status_result);
              this._clearStatusCheck(reminder.pr, reminder.repoName);
            }
          });
        });
      });
    }
  }
  catch (e){
    this.robot.logger.error(e);
  }
};


internals.findUsersAndFireEvents = function (robot, pr, reponame, statusResult) {
  var pullRequestObject = internals.formatPullRequest(pr, reponame, statusResult);
  pr.assignees.map(function(assignee) {
    var user;
    user = utils.lookupUserWithGithub(this.robot.brain, assignee.login);
    if (!user) {
      robot.logger.error('No mapped user for github user' + assignee.login);
    }
    else {
      robot.emit('GithubPullRequestAssigned', pullRequestObject, user);
    }
  });
};
PrStatusCheckWorker.prototype.save = function(pullRequest) {
  var reminders = this.getStatusChecks();
  var new_reminder = {
    pr: pullRequest.number,
    repoName: pullRequest.repo.name
  };
  reminders.push(new_reminder);
  return this.saveStatusChecks(reminders);
};

PrStatusCheckWorker.prototype._clearStatusCheck = function(prNumber, repoName) {
  var reminders = this.getStatusChecks();
  var reminders_to_keep = _.reject(reminders, {
    pr: prNumber,
    repoName: repoName
  });
  this.saveStatusChecks(reminders_to_keep);
  return reminders.length - reminders_to_keep.length;
};

internals.processStatuses = function(checks) {
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
internals.formatPullRequest = function(fetchedPullRequest, repoName, statusChecks) {
  var assigneesList = [];
  if (fetchedPullRequest.assignees) {
    fetchedPullRequest.assignees.map(function(assignee) {
      return assigneesList.push(assignee.login);
    });
  }
  return {
    number: fetchedPullRequest.number,
    url: fetchedPullRequest.url,
    state: fetchedPullRequest.state,
    title: fetchedPullRequest.title,
    author: fetchedPullRequest.user.login,
    updatedAt: fetchedPullRequest.updatedAt,
    mergeable: fetchedPullRequest.mergeable,
    additions: fetchedPullRequest.additions,
    deletions: fetchedPullRequest.deletions,
    assignees: assigneesList,
    repo: repoName,
    statusChecks: statusChecks
  };
};


exports.PrStatusCheckWorker = PrStatusCheckWorker;

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
