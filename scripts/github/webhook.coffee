Config = require "../config"
Octokat = require "octokat"
Utils = require "../utils"
PullRequest = require "./pullrequest"
GithubService = require "./githubdataservice"

url = require "url"
crypto = require "crypto"

octo = new Octokat
  token: Config.github.token
  rootUrl: Config.github.url

class Webhook
  constructor: (@robot) ->
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

    GithubService.updatePullRequestsCacheevent event.pull_request

    return unless event.action is "assigned"
    return unless event.assignee?.url?

    user = null
    sender = null
    Utils.lookupUserWithGithub(event.assignee.login)
    .then (u) ->
      user = u
      Utils.lookupUserWithGithub(event.sender.login)
      .then (s) ->
        sender = s
      .catch (error) ->
        Utils.robot.logger.error "Github Webhook: Unable to find webhook sender #{event.sender.login}"
      .then ->
       new PullRequest event.pull_request
    .then (pr) ->
      pr.assignee = user
      @robot.emit "GithubPullRequestAssigned", pr, sender
    .catch (error) ->
      Utils.robot.logger.error "Github Webhook: Unable to find user to send notification to #{event.assignee.login}"
      Utils.robot.logger.error error
      Utils.robot.logger.error error.stack


module.exports = Webhook
