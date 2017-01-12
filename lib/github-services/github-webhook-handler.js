'use strict';

var crypto = require('crypto');


var PrSatusCheckWorker = require('./pr-status-check-worker').PrStatusCheckWorker,
    githubDataService = require('./github-data-service');

var internals = {
  HUBOT_GITHUB_WEBHOOK_SECRET: process.env.HUBOT_GITHUB_WEBHOOK_SECRET
};

function WebhookHandler(robot) {
  this.robot = robot;
  var pr_satus_check = new PrSatusCheckWorker(this.robot);
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
        internals.onPullRequest(_this.robot, event, pr_satus_check);
      }
      res.send('OK');
    });
}

internals.onPullRequest = function(robot, event, pr_satus_check) {
  githubDataService.updatePullRequestsCache(robot, event.pull_request);
  if (event.action !== 'assigned') {
    return;
  }
  if (event.assignee && event.assignee.login) {
    return;
  }
  pr_satus_check.save()(event.pull_request);
};

exports.WebhookHandler = WebhookHandler;

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
