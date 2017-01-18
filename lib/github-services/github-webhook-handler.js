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
          _this.robot.logger.error('Computed signature is ' + signature);
          _this.robot.logger.error('Received signature is ' + signature);
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
  robot.logger.info('Action ' + event.action);

  var pr = event.pull_request;
  if (event.action === 'closed') {
    pr_satus_check.clearStatusCheckForPr(pr.number, pr.head.repo.name );
  }
  else if (event.action === 'assigned') {
    if (pr.assignee && pr.assignee.login) {
      pr_satus_check.save(pr, event.action, pr.assignee.login);
    }
  }
  else if (event.action === 'unassigned') {
    if (pr.assignee && pr.assignee.login) {
      pr_satus_check.clearStatusCheck({
        pr: pr.number,
        repoName: pr.head.repo.name,
        action: 'assigned',
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
