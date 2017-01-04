# Description:
# A hubot script to list and recurrently remind you about open pull requests.
# Optionally receive direct messages when you are assigned to a pull
# request in your organization or for a specific repo or set of repos.
#
# Dependencies:
#  - coffeescript
#  - cron
#  - octokat
#  - moment
#  - underscore
#  - fuse.js
#
# Configuration:
#   HUBOT_GITHUB_TOKEN - Github Application Token
#   HUBOT_GITHUB_WEBHOOK_SECRET - Optional, if you are using webhooks and have a secret set this for additional security checks on payload delivery
#   HUBOT_GITHUB_URL - Set this value if you are using Github Enterprise   default: `https://api.github.com`
#   HUBOT_GITHUB_ORG - Github Organization Name (the one in the url)
#   HUBOT_GITHUB_REPOS_MAP (format: "{"web":["frontend","web"],"android":["android"],"ios":["ios"],"platform":["web"]}"
#
# Commands:
#   hubot github open [for <user>] - Shows a list of open pull requests for the repo of this room [optionally for a specific user]
#   hubot github remind hh:mm - I'll remind about open pull requests in this room at hh:mm every weekday.
#   hubot github list reminders - See all pull request reminders for this room.
#   hubot github reminders in every room - Be nosey and see when other rooms have their reminders set
#   hubot github delete hh:mm reminder - If you have a reminder at hh:mm, I'll delete it.
#   hubot github delete all reminders - Deletes all reminders for this room.
#
# Author:
#   ndaversa


_ = require 'underscore'
Adapters = require "./adapters"
Config = require "./config"
Github = require "./github"
Reminders = require "./reminders"
Utils = require "./utils"

class GithubBot

  constructor: (@robot) ->
    return new GithubBot @robot unless @ instanceof GithubBot
    Utils.robot = @robot
    @reminders = new Reminders @robot, "github-reminders", (hubotUser) ->
      hubotUserObject = Utils.findUser hubotUser
      Github.GitHubDataService.openForUser hubotUserObject

    @prStatusChecks = new Github.PrStatusCheck @robot
    @cacheRefresh = new Github.PullRequests @robot

    @webhook = new Github.Webhook @robot, @prStatusChecks
    switch @robot.adapterName
      when "slack"
        @adapter = new Adapters.Slack @robot
      else
        @adapter = new Adapters.Generic @robot

    @registerWebhookListeners()
    @registerEventListeners()
    @registerRobotResponses()

  send: (context, message) ->
    @adapter.send context, message

  registerWebhookListeners: ->
    disableDisclaimer = """
      If you wish to stop receiving notifications for pull request assignments, reply with:
      > github disable notifications
    """

    @robot.on "GithubPullRequestAssigned", (pr, sender) =>
      @robot.logger.debug "Sending PR assignment notice to #{pr.assignee}"
      @adapter.dm sender,
        text: """
          You have just been assigned to a pull request
        """
        footer: disableDisclaimer
        attachments: [ pr.toAttachment() ]

  registerEventListeners: ->
    @robot.on "GithubPullRequestsOpenForUser", (prs, user) =>
      @robot.logger.debug "Sending Pulls Requests #{user}"
      if prs.length is 0
        message = text: "No matching pull requests found"
      else
        attachments = (pr.toAttachment() for pr in prs)
        message = attachments: attachments
      @adapter.dm user, message

    @robot.on "NoGithubUserProvided", (user) =>
      @robot.logger.debug "Sending Warning Message to #{user.name}"
      message = text: """
                       Warining: No Github Username provived, i will use slack username, please provide github username if different using #{@robot.name} github I am <user>
                      """
      @adapter.dm user, message
  registerRobotResponses: ->

    @robot.respond /(?:github|gh|git) (allow|start|enable|disallow|disable|stop)( notifications)?/i, (msg) =>
      [ __, state ] = msg.match
      switch state
        when "allow", "start", "enable"
          @adapter.enableNotificationsFor msg.message.user
          @send msg, """
          Github pull request notifications have been *enabled*

          You will start receiving notifications when you are assigned to a pull request on Github

          If you wish to _disable_ them just send me this message:
          > github disable notifications
          """
        when "disallow", "stop", "disable"
          @adapter.disableNotificationsFor msg.message.user
          @send msg, """
          Github pull request notifications have been *disabled*

          You will no longer receive notifications when you are assigned to a pull request on Github

          If you wish to _enable_ them again just send me this message:
          > github enable notifications
          """



    @robot.hear /(?:github|gh|git) I am (.*)/i, (msg) =>
      hubotUser = msg.message.user.name
      github_user = msg.match[1]
      Utils.saveGithubUser hubotUser, github_user
      @send msg, " #{hubotUser} saved as #{github_user}"

    @robot.hear /(?:github|gh|git) Init cache/i, (msg) =>
      @cacheRefresh.initializeCache()
      @send msg, " Cache initialized"

    @robot.respond /(?:github|gh|git) delete all reminders/i, (msg) =>
      hubotUser = msg.message.user.name
      remindersCleared = @reminders.clearAllForUser hubotUser
      @send msg, """
        Deleted #{remindersCleared} reminder#{if remindersCleared is 1 then "" else "s"}.
        No more reminders for you.
      """

    @robot.respond /(?:github|gh|git) delete ([0-5]?[0-9]:[0-5]?[0-9]) reminder/i, (msg) =>
      [__, time] = msg.match
      hubotUser = msg.message.user.name
      remindersCleared = @reminders.clearForUserAtTime hubotUser, time
      if remindersCleared is 0
        @send msg, "Nice try. You don't even have a reminder at #{time}"
      else
        @send msg, "Deleted your #{time} reminder"

    @robot.respond /(?:github|gh|git) remind(?:er)? ((?:[01]?[0-9]|2[0-4]):[0-5]?[0-9])$/i, (msg) =>
      [__, time] = msg.match
      hubotUser = msg.message.user.name
      githubUserName = Utils.lookupUserWithHubot hubotUser
        @reminders.save hubotUser, time
      if githubUserName
        @send msg, "Ok, from now on I'll remind this room about open pull requests every weekday at #{time}"
      else
        @send msg, """
          Please first provide your github username if it is different than hubot username
          #{@robot.name} github I am <user> - Provides the github username for the given slack user
          From now on I'll remind this room about open pull requests every weekday at #{time}
        """

    @robot.respond /(?:github|gh|git) list reminders$/i, (msg) =>
      hubotUser = msg.message.user.name
      reminders = @reminders.getForUser hubotUser
      if reminders.length is 0
        @send msg, "Well this is awkward. You haven't got any github reminders set :-/"
      else
        @send msg, "You have pull request reminders at the following times: #{_.map(reminders, (reminder) -> reminder.time)}"

    @robot.respond /(github|gh|git) help/i, (msg) =>
      @send msg, """
        I can remind you about open pull requests for the repo that belongs to this channel
        Use me to create a reminder, and then I'll post in this room every weekday at the time you specify. Here's how:

        #{@robot.name} github list open pr - Shows a list of open pull requests assigned to the current user
        #{@robot.name} github reminder hh:mm - I'll remind about open pull requests in this room at hh:mm every weekday.
        #{@robot.name} github list reminders - See all pull request reminders for this room.
        #{@robot.name} github delete hh:mm reminder - If you have a reminder at hh:mm, I'll delete it.
        #{@robot.name} github delete all reminders - Deletes all reminders for this room.
        #{@robot.name} github I am <user> - Provides the github username for the given slack user
        #{@robot.name} github Init cache - Reinitializes cache
      """

    @robot.respond /(?:github|gh|git) list open pr/i, (msg) =>
      hubotUser = msg.message.user

      @robot.logger.info "Get PR for  #{hubotUser.name}"
      Github.GitHubDataService.openForUser hubotUser
      .catch (e) => @send msg, e

  module.exports = GithubBot
