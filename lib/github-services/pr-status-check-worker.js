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

PrStatusCheckWorker.prototype.clearAllStatusChecks = function() {
  return this.robot.brain.set(internals.GITHUB_PULL_REQUESTS_CACHE, []);
};

PrStatusCheckWorker.prototype.check = function() {
  try {
    var octo = new Octokat({
      token: internals.HUBOT_GITHUB_TOKEN
    });
    var _this = this;

    var reminders = this.getStatusChecks();
    if (reminders && reminders.length > 0) {
      reminders.map(function(reminder) {
        var repo;
        if (internals.reminderShouldBeChecked(reminder)) {
          _this.robot.logger.info('Handling status check for pr '
            + reminder.pr + ' repo ' + reminder.repoName);
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


internals.findUsersAndFireEvents = function (
  _this, pr, status_result, reminder) {
  var pull_request_object = utils.formatPullRequest(pr, status_result, reminder.action);
  var author = utils.lookupUserWithGithub(_this.robot, pull_request_object.author);
  var missing_usernames = [];
  if (status_result.allChecksPassed) {
    if (reminder.assigneesList && reminder.assigneesList.length > 0) {
      pull_request_object.action = 'assigned';
      reminder.assigneesList.map(function(assignee_github_user) {
        var assignee = utils.lookupUserWithGithub(_this.robot, assignee_github_user);
        if (!assignee) {
          missing_usernames.push(assignee_github_user);
          _this.robot.logger.error('No mapped user for github user ' + assignee_github_user);
        }
        else {
          _this.robot.emit('GithubPullRequestAssigned',
            new PullRequestObject(pull_request_object), assignee);
        }

      });
    }
    if (reminder.reviewersList && reminder.reviewersList.length > 0) {
      pull_request_object.action = 'review requested';
      reminder.reviewersList.map(function(reviewer_github) {
        var reviewer = utils.lookupUserWithGithub(_this.robot, reviewer_github);
        if (!reviewer) {
          missing_usernames.push(reviewer_github);
          _this.robot.logger.error('No mapped user for github user ' + reviewer_github);
        }
        else {
          _this.robot.emit('GithubPullRequestReviewRequested',
            new PullRequestObject(pull_request_object, null, reviewer_github), reviewer);
        }

      });
    }
    _this.clearStatusCheckForPr(reminder.pr, reminder.repoName);
  }
  else {
    if (reminder.authorNotified) {
      return;
    }
    reminder.authorNotified = true;
    _this.save(reminder);
    pull_request_object.action = 'failed checks';
  }

  // Always notify pr author.
  if (!author) {
    _this.robot.logger.error('No mapped user for github user ' + pull_request_object.author);
  }
  else  {
    if ((status_result.allChecksPassed
      && reminder.assigneesList && reminder.assigneesList.length > 0)
      || !status_result.allChecksPassed) {
      _this.robot.emit('GithubPRAuthorNotification', new PullRequestObject(
          pull_request_object), author, status_result.allChecksPassed, missing_usernames);
    }
  }


};

PrStatusCheckWorker.prototype.save = function(new_reminder) {
  var reminders = this.getStatusChecks();

  var match = _.find(reminders, function(reminder) {
    return reminder.pr === new_reminder.pr
    && reminder.repoName === new_reminder.repoName;
  });
  if (match) {
    match.assigneesList = _.union(match.assigneesList, new_reminder.assigneesList);
    match.reviewersList = _.union(match.reviewersList, new_reminder.reviewersList);
  }
  else {
    reminders.push(new_reminder);
  }
  return this.saveStatusChecks(reminders);
};

PrStatusCheckWorker.prototype.removeAssignee = function(reminder_to_check) {
  var reminders = this.getStatusChecks();

  var match = _.find(reminders, function(reminder) {
    return reminder.pr === reminder_to_check.pr
      && reminder.repoName === reminder_to_check.repoName;
  });

  if (match) {
    if (reminder_to_check.assignee) {
      match.assigneesList = _.reject(match.assigneesList, function(assignee){
        return assignee === reminder_to_check.assignee;
      });
    }
    else if (reminder_to_check.reviewer) {
      match.reviewersList = _.reject(match.reviewersList, function(reviewer){
        return reviewer === reminder_to_check.reviewer;
      });
    }
  }
  return this.saveStatusChecks(reminders);
};

PrStatusCheckWorker.prototype.clearStatusCheckForPr = function(pr, repoName) {
  var reminders = this.getStatusChecks();
  var reminders_to_keep = _.reject(reminders, function(reminder){
    return reminder.pr === pr && reminder.repoName === repoName;
  });
  this.robot.logger.info('Removing Status checks for pr ' + pr + ' repo ' + repoName);
  this.saveStatusChecks(reminders_to_keep);
  return reminders.length - reminders_to_keep.length;
};


exports.PrStatusCheckWorker = PrStatusCheckWorker;

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
