_ = require 'underscore'
Utils = require  "../utils"
cronJob = require("cron").CronJob
Config = require "../config"
Octokat = require 'octokat'

octo = new Octokat
  token: Config.github.token
  rootUrl: Config.github.url

class PrStatusCheck


  constructor: (@robot) ->
  @robot.brain.once 'loaded', =>
  # Run a cron job that runs every 5 minutes, Monday-Friday
  new cronJob('0 */5 * * * *', @_check.bind(@), null, true)


  processStatuses = (checks) ->
    checksMap = {}
    checks.map (check) ->
      if !checksMap[check.context]
        checksMap[check.context] = check.state
      else if checksMap[check.context] != 'success' | 'error' | 'failure'
        checksMap[check.context] = check.state

    pendingChecks = false
    allChecksPassed = true

    for k,v of checksMap
      if allChecksPassed and (v == 'error' or v == 'failure')
        allChecksPassed = false
      if !pendingChecks and v == 'pending'
        pendingChecks = true

    statusResult = {
      allChecksPassed: allChecksPassed
      pendingChecks: pendingChecks
      checksMap: checksMap
    }
    return statusResult

  _get: ->
    @robot.brain.get("pr-status-checks") or []

  _save: (reminders) ->
    @robot.brain.set "pr-status-checks", reminders

  _check: ->
    reminders = @_get()
    reminders.map() (reminder) ->
      repo = octo.repos(Config.github.organization, reminder.repoName)
      repo.pulls(reminder.pr).fetch()
      .then (pr) ->
        octo.fromUrl(pr.Links.statuses.href).fetch()
        .then (checks) ->
          statusResult = processStatuses(checks)

          if !statusResult.pendingChecks
            @_clearStatusCheck(reminder.pr, reminder.repoName)
            pullRequestObject = @_formatPullRequest pr, reminder.repoName, statusResult
            pr.assignees.map (assignee) ->
              user = Utils.lookupUserWithGithub(assignee.login)
              if !user
                @robot.logger.error "No mapped user for github user" + assignee.login
              else
                @robot.emit "GithubPullRequestAssigned", pullRequestObject, user

  _formatPullRequest= (fetchedPullRequest, repoName, statusChecks) ->
    assigneesList = []
    fetchedPullRequest.assignees.map (assignee) ->
      assigneesList.push(assignee.login)

    pullRequestObject = {
      number : fetchedPullRequest.number
      url : fetchedPullRequest.url
      state : fetchedPullRequest.state
      title : fetchedPullRequest.title
      author : fetchedPullRequest.user.login
      updatedAt : fetchedPullRequest.updatedAt
      mergeable: fetchedPullRequest.mergeable
      additions: fetchedPullRequest.additions
      deletions: fetchedPullRequest.deletions
      assignees : assigneesList
      repo : repoName
      statusChecks : statusChecks
    }
    return pullRequestObject

  getAll: ->
    @_get()

  save: (pullRequest) ->
    reminders = @_get()
    newReminder =
      pr: pullRequest.number
      repoName: pullRequest.repo.name
    reminders.push newReminder
    @_save reminders


  _clearStatusCheck: (prNumber, repoName) ->
    reminders = @_get()
    remindersToKeep = _.reject reminders,
      pr: prNumber
      repoName: repoName
    @_save remindersToKeep
    reminders.length - (remindersToKeep.length)


module.exports = PrStatusCheck
