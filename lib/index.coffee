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
#
# Commands:
#   hubot github list open pr - Shows a list of open pull requests for the repo of this room [optionally for a specific user]
#   hubot github remind hh:mm - I'll remind about open pull requests in this room at hh:mm every weekday.
#   hubot github list reminders - See all pull request reminders for this room.
#   hubot github delete hh:mm reminder - If you have a reminder at hh:mm, I'll delete it.
#   hubot github delete all reminders - Deletes all reminders for this room.
#
# Author:
#   ndaversa


_ = require 'underscore'
Adapters = require "./adapters"
Patterns = require "./patterns"
GitHubDataService = require "./github-services/github-data-service"
PrCacheInitializer = require "./github-services/pr-cache-initializer"
GithubWebhookHandler = require "./github-services/github-webhook-handler"
Reminders = require "./reminders"
Utils = require "./utils"

class GithubBot

  constructor: (@robot) ->
    return new GithubBot @robot unless @ instanceof GithubBot
    Utils.robot = @robot
    @reminders = new Reminders @robot, "github-reminders", (hubotUser) ->
      hubotUserObject = Utils.findUser hubotUser
      GitHubDataService.openForUser hubotUserObject

    @cacheRefresh = new PrCacheInitializer @robot
    @webhook = new GithubWebhookHandler @robot

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
        message = text: "No open pull requests found"
      else
        attachments = (pr.toAttachment() for pr in prs)
        message = attachments: attachments
      @adapter.dm user, message

    @robot.on "NoGithubUserProvided", (user) =>
      @robot.logger.debug "Sending Warning Message to #{user.name}"
      @adapter.dm user,
        text: """
          Warining: No Github Username provived, i will use slack username, please provide github username if different using #{@robot.name} github I am <user>
        """
  registerRobotResponses: ->

    @robot.respond Patterns.NOTIFICATIONS_SWITCH, (msg) =>
      [ __, state ] = msg.match
      switch state
        when "enable"
          @adapter.enableNotificationsFor msg.message.user
          @send msg, """
          Github pull request notifications have been *enabled*

          You will start receiving notifications when you are assigned to a pull request on Github

          If you wish to _disable_ them just send me this message:
          > github disable notifications
          """
        when "disable"
          @adapter.disableNotificationsFor msg.message.user
          @send msg, """
          Github pull request notifications have been *disabled*

          You will no longer receive notifications when you are assigned to a pull request on Github

          If you wish to _enable_ them again just send me this message:
          > github enable notifications
          """



    @robot.hear Patterns.REMEMBER_USER, (msg) =>
      hubotUser = msg.message.user.name
      github_user = msg.match[1]
      Utils.saveGithubUser hubotUser, github_user
      @send msg, " #{hubotUser} saved as #{github_user}"

    @robot.hear Patterns.INIT_CACHE, (msg) =>
      @cacheRefresh.clearCache()
      @send msg, "Cache initialized"

    @robot.respond Patterns.DELETE_REMINDERS, (msg) =>
      hubotUser = msg.message.user.name
      remindersCleared = @reminders.clearAllForUser hubotUser
      @send msg, """
        Deleted #{remindersCleared} reminder#{if remindersCleared is 1 then "" else "s"}.
        No more reminders for you.
      """

    @robot.respond Patterns.DELETE_REMINDER, (msg) =>
      [__, time] = msg.match
      hubotUser = msg.message.user.name
      remindersCleared = @reminders.clearForUserAtTime hubotUser, time
      if remindersCleared is 0
        @send msg, "Nice try. You don't even have a reminder at #{time}"
      else
        @send msg, "Deleted your #{time} reminder"

    @robot.respond Patterns.CREATE_REMINDER, (msg) =>
      [__, time] = msg.match
      hubotUser = msg.message.user.name
      githubUserName = Utils.lookupUserWithHubot hubotUser
      @reminders.save hubotUser, time
      if githubUserName
        @send msg, "Ok, from now on I'll remind this room about open pull requests every weekday at #{time}"
      else
        @send msg, """
          Please first provide your github username if it is different than hubot username
          github I am <user> - Provides the github username for the given slack user
          From now on I'll remind this room about open pull requests every weekday at #{time}
        """

    @robot.respond Patterns.LIST_REMINDERS, (msg) =>
      hubotUser = msg.message.user.name
      reminders = @reminders.getForUser hubotUser
      if reminders.length is 0
        @send msg, "Well this is awkward. You haven't got any github reminders set :-/"
      else
        @send msg, "You have pull request reminders at the following times: #{_.map(reminders, (reminder) -> reminder.time)}"

    @robot.respond Patterns.BOT_HELP, (msg) =>
      @send msg, """
        I can remind you about open pull requests for the assigned to you
        Use me to create a reminder, and then I'll post in this room every weekday at the time you specify. Here's how:

        github list open pr - Shows a list of open pull requests assigned to the current user
        github remind hh:mm - I'll remind about open pull requests in this room at hh:mm every weekday.
        github list reminders - See all pull request reminders for this room.
        github delete hh:mm reminder - If you have a reminder at hh:mm, I'll delete it.
        github delete all reminders - Deletes all reminders for this room.
        github I am <user> - Provides the github username for the given slack user
        github Init cache - Reinitializes cache
      """

    @robot.respond Patterns.LIST_OPEN_PR, (msg) =>
      hubotUser = msg.message.user

      @robot.logger.debug "Get PR for  #{hubotUser.name}"
      GitHubDataService.openForUser hubotUser

  module.exports = GithubBot
