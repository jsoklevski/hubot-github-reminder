_ = require 'underscore'
Utils = require  "../utils"
cronJob = require("cron").CronJob
Config = require "../config"
Octokat = require 'octokat'

octo = new Octokat
  token: Config.github.token
  rootUrl: Config.github.url

# Class containing logic for checking status updates once a pr has been assigned

class PrStatusCheckWorker

  @GITHUB_PULL_REQUESTS_CACHE: "pr-status-checks"

  constructor: (@robot) ->
    @robot.brain.once 'loaded', =>
      # Run a cron job that runs every 5 minutes
      new cronJob('0 */5 * * * *', @check.bind(@), null, true)

  _get: ->
    @robot.brain.get(PrStatusCheck.GITHUB_PULL_REQUESTS_CACHE) or []

  _save: (reminders) ->
    @robot.brain.set PrStatusCheck.GITHUB_PULL_REQUESTS_CACHE, reminders

  check: ->
    # get all recently assigned prs which might have a status update
    reminders = @_get()
    _.chain reminders, (reminder) ->
      repo = octo.repos(Config.github.organization, reminder.repoName)
      repo.pulls(reminder.pr).fetch()
      .then (pr) ->
        octo.fromUrl(pr.Links.statuses.href).fetch()
        .then (checks) ->
          statusResult = processStatuses(checks)
          if !statusResult.pendingChecks
            @_clearStatusCheck(reminder.pr, reminder.repoName)
            pullRequestObject = @formatPullRequest pr, reminder.repoName, statusResult
            pr.assignees.map (assignee) ->
              user = Utils.lookupUserWithGithub(assignee.login)
              if !user
                @robot.logger.error "No mapped user for github user" + assignee.login
              else
                @robot.emit "GithubPullRequestAssigned", pullRequestObject, user


  processStatuses= (checks) ->
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

  formatPullRequest= (fetchedPullRequest, repoName, statusChecks) ->
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


module.exports = PrStatusCheckWorker
