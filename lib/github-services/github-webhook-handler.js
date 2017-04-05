'use strict';

var crypto = require('crypto');
var _ = require('underscore'),
    Octokat = require('octokat');


var githubDataService = require('./github-data-service'),
    utils = require('../utils'),
    CommentObject = require('./comment-object').CommentObject;

var internals = {
  HUBOT_GITHUB_TOKEN: process.env.HUBOT_GITHUB_TOKEN,
  HUBOT_GITHUB_ORG: process.env.HUBOT_GITHUB_ORG,
  HUBOT_GITHUB_WEBHOOK_SECRET: process.env.HUBOT_GITHUB_WEBHOOK_SECRET,
  GITHUB_PULL_REQUESTS_ASSIGNEES_REVIEWERS: 'pr-assignees-reviewers'
};

function WebhookHandler(robot, pr_satus_check) {
  this.robot = robot;
  this.pr_satus_check = pr_satus_check;
  var _this = this;

  this.robot.router.post('/hubot/github-events', function(req, res) {
      var event,
          hmac,
          hub_signature,
          signature;
      if (req.body == null) {
        return;
      }
      if (internals.HUBOT_GITHUB_WEBHOOK_SECRET) {
        hmac = crypto.createHmac('sha1', internals.HUBOT_GITHUB_WEBHOOK_SECRET);
      }
      if (hmac && (hub_signature = req.headers['x-hub-signature'])) {
        hmac.update(new Buffer(JSON.stringify(req.body)));
        signature = 'sha1=' + (hmac.digest('hex'));
        if (signature !== hub_signature) {
          _this.robot.logger.error('Github Webhook Signature did not match, aborting');
          return;
        }
      }
      event = req.body;
      var event_name = req.headers['x-github-event'];
      if (event_name === 'pull_request') {
        internals.onPullRequest(_this.robot, event, _this.pr_satus_check);
      }
      else if (event_name === 'pull_request_review') {
        internals.onPullRequestReview(_this.robot, event);
      }
      else if (event_name === 'pull_request_review_comment') {
        internals.onPullRequestReviewComment(_this.robot, event);
      }
      res.send('OK');
    });
}
internals.onPullRequestReview = function(robot, event) {
  robot.logger.info('Handling PR review : ' + event.action);
  var pr = event.pull_request;
  var review = event.review;
  var author = review.user.login;
  var pr_cache = internals.getAssigneesAndReviewersCache(robot, event);
  if (event.action === 'submitted' || event.action === 'dismissed') {
    if (review.state !== 'commented') {
      var octo = new Octokat({
        token: internals.HUBOT_GITHUB_TOKEN
      });
      var repo = octo.repos(internals.HUBOT_GITHUB_ORG, pr.head.repo.name);
      repo.pulls(pr.number).fetch().then(function(pull_request) {
        var pull_request_object = utils.formatReviewRequest(pull_request, review);
        pull_request_object.requestedReviewers = pr_cache.reviewersList;
        var list_of_users_to_notify = _.union(
          pr_cache.reviewersList, pull_request_object.assignees);
        list_of_users_to_notify.push(pull_request.user.login);
        list_of_users_to_notify = _.uniq(list_of_users_to_notify);
        if (list_of_users_to_notify && pull_request_object.assignees.length > 0) {
          list_of_users_to_notify.map(function(assignee_github_user) {
            if (author !== assignee_github_user) {
              var assignee = utils.lookupUserWithGithub(robot, assignee_github_user);
              if (assignee) {
                robot.emit('GithubPullRequestReviewSubmitted',
                  new CommentObject(pull_request_object), assignee);
              }
            }
          });
        }
      });
    }
  }
};

internals.onPullRequestReviewComment = function(robot, event) {
  robot.logger.info('Handling PR review comment : ' + event.action);
  var pr = event.pull_request;
  var comment = event.comment;
  var author = comment.user.login;
  var pr_cache = internals.getAssigneesAndReviewersCache(robot, event);
  if (event.action === 'created') {
    var octo = new Octokat({
      token: internals.HUBOT_GITHUB_TOKEN
    });
    var repo = octo.repos(internals.HUBOT_GITHUB_ORG, pr.head.repo.name);
    repo.pulls(pr.number).fetch().then(function(pull_request) {
      var pull_request_object = utils.formatCommentRequest(pull_request, comment);
      pull_request_object.requestedReviewers = pr_cache.reviewersList;
      var list_of_users_to_notify = _.union(pr_cache.reviewersList, pull_request_object.assignees);
      list_of_users_to_notify = _.uniq(list_of_users_to_notify);
      if (list_of_users_to_notify && pull_request_object.assignees.length > 0) {
        list_of_users_to_notify.map(function(assignee_github_user) {
          if (author !== assignee_github_user) {
            var assignee = utils.lookupUserWithGithub(robot, assignee_github_user);
            if (assignee) {
              robot.emit('GithubPullRequestReviewComment',
                new CommentObject(pull_request_object), assignee);
            }
          }
        });
      }
    });
  }
};

internals.updateAssigneesAndReviewersCache = function(robot, event) {
  var pr_reviewers_cache = robot.brain.get(
    internals.GITHUB_PULL_REQUESTS_ASSIGNEES_REVIEWERS) || [];
  var pr = event.pull_request;
  var pr_number = pr.number;
  var pr_repo_name = pr.head.repo.name;
  robot.logger.info('Updating pr reviewers cache action: '
    + event.action + ' pr : ' + pr_number + ' repoName: ' + pr_repo_name);
  var match = _.find(pr_reviewers_cache, function(pull_request) {
    return pull_request.pr === pr_number
      && pull_request.repoName === pr_repo_name;
  });
  if (event.action === 'closed') {
    var pr_cache_updated = _.reject(pr_reviewers_cache, function(pull_request){
      return pull_request.pr === pr_number && pull_request.repoName === pr_repo_name;
    });
    return robot.brain.set(internals.GITHUB_PULL_REQUESTS_ASSIGNEES_REVIEWERS, pr_cache_updated);
  }
  else if (event.action === 'review_requested') {
    var requested_reviewer = event.requested_reviewer.login;
    if (match) {
      match.reviewersList = _.union(match.reviewersList, [requested_reviewer]);
    }
    else {
      var new_cache_entry = {
        pr: pr_number,
        repoName: pr_repo_name,
        reviewersList: [requested_reviewer]
      };
      pr_reviewers_cache.push(new_cache_entry);
    }
  }
  else if (event.action === 'opened' || event.action === 'reopened') {
    var cache_entry = {
      pr: pr_number,
      repoName: pr_repo_name,
      reviewersList: []
    };
    if (!match) {
      pr_reviewers_cache.push(cache_entry);
    }
  }
  else if (event.action === 'review_request_removed') {
    var reviewer_to_remove = event.requested_reviewer.login;
    match.reviewersList = _.reject(match.reviewersList, function(reviewer){
      return reviewer === reviewer_to_remove;
    });
  }
  return robot.brain.set(internals.GITHUB_PULL_REQUESTS_ASSIGNEES_REVIEWERS, pr_reviewers_cache);
};

internals.getAssigneesAndReviewersCache = function(robot, event) {
  var pr_reviewers_cache = robot.brain.get(
    internals.GITHUB_PULL_REQUESTS_ASSIGNEES_REVIEWERS) || [];
  var pr = event.pull_request;
  var pr_number = pr.number;
  var pr_repo_name = pr.head.repo.name;
  var match = _.find(pr_reviewers_cache, function(pull_request) {
    return pull_request.pr === pr_number
      && pull_request.repoName === pr_repo_name;
  });
  if (match) {
    return match;
  }
  else {
    robot.logger.error('Missing cache entry for Pr');
  }
};

internals.onPullRequest = function(robot, event, pr_satus_check) {
  robot.logger.info('Handling PR update action: ' + event.action);

  var pr = event.pull_request;
  internals.updateAssigneesAndReviewersCache(robot, event);
  if (event.action === 'closed') {
    pr_satus_check.clearStatusCheckForPr(pr.number, pr.head.repo.name );
  }
  else if (event.action === 'assigned') {
    if (pr.assignee && pr.assignee.login) {
      pr_satus_check.save({
        pr: pr.number,
        repoName: pr.head.repo.name,
        assigneesList: [pr.assignee.login],
        authorNotified: false,
        time_created: new Date()
      });
    }
  }
  else if (event.action === 'review_requested') {
    if (event.requested_reviewer && event.requested_reviewer.login) {
      pr_satus_check.save({
        pr: pr.number,
        repoName: pr.head.repo.name,
        assigneesList: [],
        reviewersList: [event.requested_reviewer.login],
        authorNotified: false,
        time_created: new Date()
      });
    }
  }
  else if (event.action === 'review_request_removed') {
    if (event.requested_reviewer && event.requested_reviewer.login) {
      pr_satus_check.removeAssignee({
        pr: pr.number,
        repoName: pr.head.repo.name,
        reviewer: event.requested_reviewer.login
      });
    }
  }
  else if (event.action === 'unassigned') {
    if (pr.assignee && pr.assignee.login) {
      pr_satus_check.removeAssignee({
        pr: pr.number,
        repoName: pr.head.repo.name,
        assignee: pr.assignee.login
      });
    }
  }
  var octo = new Octokat({
    token: internals.HUBOT_GITHUB_TOKEN
  });
  var repo = octo.repos(internals.HUBOT_GITHUB_ORG, pr.head.repo.name);
  repo.pulls(pr.number).fetch().then(function(pull_request) {
    octo.fromUrl(pull_request.Links.statuses.href).fetch().then(function (checks) {
      var status_result = utils.processStatuses(checks);
      var pull_request_object = utils.formatPullRequest(pull_request, status_result);
      githubDataService.updatePullRequestsCache(robot, pull_request_object);
    });
  });
};

exports.WebhookHandler = WebhookHandler;

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
