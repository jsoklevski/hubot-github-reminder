'use strict';

var _ = require('underscore'),
    Octokat = require('octokat'),
    CronJob = require('cron').CronJob;


var utils = require('../utils'),
    PullRequestObject = require('./pr-object').PullRequestObject;

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
    var _this = this;

    var reminders = this.getStatusChecks();
    if (reminders && reminders.length > 0) {
      reminders.map(function(reminder) {
        var repo;
        _this.robot.logger.info('Handling status check for pr');
        repo = octo.repos(internals.HUBOT_GITHUB_ORG, reminder.repoName);
        repo.pulls(reminder.pr).fetch().then(function(pr) {
          octo.fromUrl(pr.Links.statuses.href).fetch().then(function(checks) {
            var status_result = utils.processStatuses(checks);
            if (!status_result.pendingChecks) {
              _this.clearStatusCheck(reminder);
              internals.findUsersAndFireEvents(_this.robot, pr, status_result, reminder);
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


internals.findUsersAndFireEvents = function (robot, pr, status_result, reminder) {
  var pullRequestObject = utils.formatPullRequest(pr, status_result, reminder.action);
  var user = utils.lookupUserWithGithub(robot, reminder.assignee);
  if (!user) {
    robot.logger.error('No mapped user for github user ' + reminder.assignee);
  }
  else {
    robot.logger.info('Sending notification to ' + user.name);
    robot.emit('GithubPullRequestAssigned', new PullRequestObject(pullRequestObject), user);
  }
};
PrStatusCheckWorker.prototype.save = function(pullRequest, action, assignee) {
  var reminders = this.getStatusChecks();
  var new_reminder = {
    pr: pullRequest.number,
    repoName: pullRequest.head.repo.name,
    action: action,
    assignee: assignee
  };
  reminders.push(new_reminder);
  return this.saveStatusChecks(reminders);
};

PrStatusCheckWorker.prototype.clearStatusCheck = function(reminder) {
  var reminders = this.getStatusChecks();
  var reminders_to_keep = _.reject(reminders, {
    pr: reminder.pr,
    repoName: reminder.repoName,
    action: reminder.action,
    assignee: reminder.assignee
  });
  this.saveStatusChecks(reminders_to_keep);
  this.robot.logger.info('Reminder removed ' + JSON.stringify(reminder));
  return reminders.length - reminders_to_keep.length;
};

PrStatusCheckWorker.prototype.clearStatusCheckForPr = function(pr, repoName) {
  var reminders = this.getStatusChecks();
  var reminders_to_keep = _.reject(reminders, function(reminder){
    return reminder.pr === pr && reminder.repoName === repoName;
  });
  this.robot.logger.info('Removing Status checks for pr' + pr + ' repo ' + repoName);
  this.saveStatusChecks(reminders_to_keep);
  return reminders.length - reminders_to_keep.length;
};


exports.PrStatusCheckWorker = PrStatusCheckWorker;

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
