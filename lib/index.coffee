# Description:
# A hubot script to list and recurrently remind you about open pull requests.
# Optionally receive direct messages when you are assigned to a pull
# request in your organization.
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
#   Springworks


_ = require 'underscore'
Patterns = require "./patterns"
GitHubDataService = require "./github-services/github-data-service"
PrCacheInitializer = require("./github-services/pr-cache-initializer").PullRequestsCacheInit
GithubWebhookHandler = require("./github-services/github-webhook-handler").WebhookHandler
PrSatusCheckWorker = require("./github-services/pr-status-check-worker").PrStatusCheckWorker
Generic = require("./hubot-message-adapters/generic").GenericAdapter
Reminders = require("./github-services/pr-reminders").Reminders
utils = require "./utils"

class GithubBot

  constructor: (@robot) ->
    return new GithubBot @robot unless @ instanceof GithubBot
    @reminders = new Reminders @robot
    @cacheRefresh = new PrCacheInitializer @robot
    @prSatusCheck = new PrSatusCheckWorker @robot
    @webhook = new GithubWebhookHandler @robot, @prSatusCheck

    @adapter = new Generic @robot

    @registerWebhookListeners()
    @registerEventListeners()
    @registerRobotResponses()

  send: (context, message) ->
    @adapter.send context, message

  registerWebhookListeners: ->
    @robot.on "GithubPullRequestAssigned", (pr, user) =>
      text = ""
      if user
        @robot.logger.info "Sending PR notification to #{user.name}"
        text = "PR notification for user  <@#{user.id}>"
      room = utils.getRoomForNotifications @robot
      @robot.logger.info "Sending PR notification to room  #{room.id}"
      message =
        text: text
        attachments: [ pr.toAttachment() ]
      @adapter.send message: room: room.id, message

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
          Warining: No Github Username provived, i will use slack username, please provide github username if it is different using #{@robot.name} github I am <user>
        """

    @robot.on "CacheInitialization", (user, success) =>
      if success
        @adapter.dm user,
          text: """
              Cache Succesifully Initilized
        """
      else
        @adapter.dm user,
          text: """
              Cache Initialization failed. Please try again.
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

    @robot.respond Patterns.CLEAR_ALL_STATUS_CHECKS, (msg) =>
      @prSatusCheck.clearAllStatusChecks()
      @send msg, "Status checks removed"

    @robot.respond Patterns.REMEMBER_USER, (msg) =>
      hubotUser = msg.message.user.name
      github_user = msg.match[1]
      utils.rememberUser @robot.brain, hubotUser, github_user
      @send msg, " #{hubotUser} saved as #{github_user}"

    @robot.respond Patterns.INIT_CACHE, (msg) =>
      hubotUser = msg.message.user
      @cacheRefresh.clearCache(hubotUser)
      @send msg, "Cache initialization started, please wait..."

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
      githubUserName = utils.lookupUserWithHubot @robot.brain, hubotUser
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
        github list my open pr - Show a list of open PRs that the current user created
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
      GitHubDataService.openForUser @robot, hubotUser, false


    @robot.respond Patterns.LIST_MY_OPEN_PR, (msg) =>
      hubotUser = msg.message.user

      @robot.logger.debug "Get PR for  #{hubotUser.name}"
      GitHubDataService.openForUser @robot, hubotUser, true


  module.exports = GithubBot
