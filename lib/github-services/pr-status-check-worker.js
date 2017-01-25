'use strict';

var _ = require('underscore'),
    Octokat = require('octokat'),
    CronJob = require('cron').CronJob,
    moment = require('moment');


var utils = require('../utils'),
    PullRequestObject = require('./pr-object').PullRequestObject;

var internals = {
  HUBOT_GITHUB_TOKEN: process.env.HUBOT_GITHUB_TOKEN,
  HUBOT_GITHUB_ORG: process.env.HUBOT_GITHUB_ORG,
  GITHUB_PULL_REQUESTS_CACHE: 'pr-status-checks'
};


function PrStatusCheckWorker(robot) {
  this.robot = robot;
  robot.brain.set(internals.GITHUB_PULL_REQUESTS_CACHE, []);
  var _this = this;
  robot.brain.once('loaded', function() {
    return new CronJob('0 * * * * *',  _this.check.bind(_this), null, true);
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
        _this.robot.logger.info('Checking if checks should be preformed for reminder '
          + reminder.pr + ' repo ' + reminder.repoName);
        if (internals.reminderShouldBeChecked(reminder)) {
          _this.robot.logger.info('Handling status check for pr');
          repo = octo.repos(internals.HUBOT_GITHUB_ORG, reminder.repoName);
          repo.pulls(reminder.pr).fetch().then(function(pr) {
            octo.fromUrl(pr.Links.statuses.href).fetch().then(function(checks) {
              var status_result = utils.processStatuses(checks);
              if (!status_result.pendingChecks) {
                internals.findUsersAndFireEvents(_this, pr, status_result, reminder);
              }
            });
          });
        }
      });
    }
  }
  catch (e){
    this.robot.logger.error(e);
  }
};

internals.reminderShouldBeChecked = function (reminder) {
  var difference = moment().diff(moment(reminder.time_created), 'minutes');
  return difference > 0 && difference % 5 === 0;
};


internals.findUsersAndFireEvents = function (_this, pr, status_result, reminder) {
  var send_notification_to;
  var pull_request_object = utils.formatPullRequest(pr, status_result, reminder.action);
  if (status_result.allChecksPassed) {
    send_notification_to = reminder.assignee;
    pull_request_object.action = 'assigned';
    _this.clearStatusCheck(reminder);
  }
  else {
    send_notification_to = pull_request_object.author;
    pull_request_object.action = 'failed checks';
    if (reminder.authorNotified) {
      return;
    }
    reminder.authorNotified = true;
    _this.save(reminder);
  }
  var user = utils.lookupUserWithGithub(_this.robot, send_notification_to);
  if (!user) {
    _this.robot.logger.error('No mapped user for github user ' + send_notification_to);
  }
  _this.robot.logger.info('Sending notification to room');
  _this.robot.emit('GithubPullRequestAssigned', new PullRequestObject(pull_request_object), user);
};

PrStatusCheckWorker.prototype.save = function(new_reminder) {
  var reminders = this.getStatusChecks();
  var reminders_to_keep = _.reject(reminders, function(reminder){
    return reminder.pr === new_reminder.pr
      && reminder.repoName === new_reminder.repoName
      && reminder.assignee === new_reminder.assignee;
  });
  reminders_to_keep.push(new_reminder);
  return this.saveStatusChecks(reminders_to_keep);
};

PrStatusCheckWorker.prototype.clearStatusCheck = function(reminder_to_be_removed) {
  var reminders = this.getStatusChecks();
  var reminders_to_keep = _.reject(reminders,  function(reminder){
    return reminder.pr === reminder_to_be_removed.pr
      && reminder.repoName === reminder_to_be_removed.repoName
      && reminder.assignee === reminder_to_be_removed.repoName;
  });
  this.saveStatusChecks(reminders_to_keep);
  this.robot.logger.info('Reminder removed ' + JSON.stringify(reminder_to_be_removed));
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
