Config = require "../config"
GithubService = require "./githubdataservice"

url = require "url"
crypto = require "crypto"

class Webhook
  constructor: (@robot, @prStatusChecks) ->
    @robot.router.post "/hubot/github-events", (req, res) =>
      return unless req.body?
      hmac = crypto.createHmac "sha1", Config.github.webhook.secret if Config.github.webhook.secret
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

    GithubService.updatePullRequestsCache event.pull_request

    return unless event.action is "assigned"
    return unless event.assignee?.url?

    prStatusChecks.save() event.pull_request




module.exports = Webhook
