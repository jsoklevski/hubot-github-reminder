'use strict';

var crypto = require('crypto');
var Octokat = require('octokat');


var PrSatusCheckWorker = require('./pr-status-check-worker').PrStatusCheckWorker,
    githubDataService = require('./github-data-service'),
    utils = require('../utils');

var internals = {
  HUBOT_GITHUB_TOKEN: process.env.HUBOT_GITHUB_TOKEN,
  HUBOT_GITHUB_ORG: process.env.HUBOT_GITHUB_ORG,
  HUBOT_GITHUB_WEBHOOK_SECRET: process.env.HUBOT_GITHUB_WEBHOOK_SECRET
};

function WebhookHandler(robot) {
  this.robot = robot;
  this.pr_satus_check = new PrSatusCheckWorker(robot);
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
        hmac.update(JSON.stringify(req.body));
        signature = 'sha1=' + (hmac.digest('hex'));
        if (signature !== hub_signature) {
          _this.robot.logger.error('Github Webhook Signature did not match, aborting');
          return;
        }
      }
      event = req.body;
      if (req.body.pull_request) {
        internals.onPullRequest(_this.robot, event, _this.pr_satus_check);
      }
      res.send('OK');
    });
}

internals.onPullRequest = function(robot, event, pr_satus_check) {
  robot.logger.info('Handling PR update');

  var pr = event.pull_request;
  if (event.action !== 'closed') {
    pr_satus_check.clearStatusCheckForPr(pr.number, pr.head.repo.name );
  }
  else if (event.action !== 'assigned'
    || event.action !== 'reopened'
    || event.action !== 'created') {
    if (pr.assignee && pr.assignee.login) {
      pr_satus_check.save(event.pull_request, pr.assignee.login, event.action);
    }
  }

  var octo = new Octokat({
    token: internals.HUBOT_GITHUB_TOKEN
  });
  var repo = octo.repos(internals.HUBOT_GITHUB_ORG, pr.head.repo.name);
  repo.pulls(pr.number).fetch().then(function(pull_request) {
    octo.fromUrl(pull_request.Links.statuses.href).fetch().then(function (checks) {
      var status_result = utils.processStatuses(checks);
      robot.logger.info('Fetched Statuses');
      var pull_ruest_object = utils.formatPullRequest(pull_request, status_result, event.action);
      githubDataService.updatePullRequestsCache(robot, pull_ruest_object);
    });
  });


};

exports.WebhookHandler = WebhookHandler;

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
