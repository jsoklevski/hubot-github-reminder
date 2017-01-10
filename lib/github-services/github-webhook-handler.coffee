config = require "../config"
GithubDataService = require "./github-data-service"
PrSatusCheckWorker = require "./pr-status-check-worker"
url = require "url"
crypto = require "crypto"

class WebhookHandler

  constructor: (@robot) ->
    @prStatusChecks = new PrSatusCheckWorker @robot
    @robot.router.post "/hubot/github-events", (req, res) =>
      return unless req.body?
      hmac = crypto.createHmac "sha1", config.github.webhook.secret if config.github.webhook.secret
      if hmac and hubSignature = req.headers["x-hub-signature"]
        hmac.update JSON.stringify req.body
        signature = "sha1=#{hmac.digest "hex"}"
        unless signature is hubSignature
          return @robot.logger.error "Github Webhook Signature did not match, aborting"

      event = req.body

      if req.body.pull_request
        @onPullRequest event

      res.send 'OK'

  onPullRequest: (event) ->

    GithubDataService.updatePullRequestsCache event.pull_request

    return unless event.action is "assigned"
    return unless event.assignee?.url?

    # if pr was assigned to a user add this pr to the status check worker
    # so that user is only notified once all statuses have a finished state
    prStatusChecks.save() event.pull_request




module.exports = WebhookHandler
