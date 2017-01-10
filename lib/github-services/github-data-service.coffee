_ = require "underscore"
Utils = require "../utils"
PullRequestObject = require "./pr-object"


class GitHubDataService

  @GITHUB_PULL_REQUESTS_CACHE: "github-pr-cache"

  @openForUser: (hubotUsername) ->
    pullrequestsData = Utils.robot.brain.get(GitHubDataService.GITHUB_PULL_REQUESTS_CACHE)

    githubUserName = Utils.lookupUserWithHubot hubotUsername

    if !githubUsername
      githubUsername = hubotUsername.name
      Utils.robot.emit "GithubPullRequestsOpenForUser", hubotUsername

    pullRequestsForUser = []

    if pullrequestsData != null
      for pr in pullrequestsData
        for assignee in pr.assignees when assignee
          if assignee == githubUserName then pullRequestsForUser.push new PullRequestObject pr githubUserName


    Utils.robot.emit "GithubPullRequestsOpenForUser", pullRequestsForUser, hubotUsername

  @updatePullRequestsCache: (pullRequest) ->
    pullrequestsCachedData = Utils.robot.brain.get(GitHubDataService.GITHUB_PULL_REQUESTS_CACHE)

    assigneesList = []
    pullRequest.assignees.map (assignee) ->
      assigneesList.push assignee.login

    pullRequestObject = {
      number: pullRequest.number
      url : pullRequest.url
      state : pullRequest.state
      title : pullRequest.title
      author : pullRequest.user.login
      updatedAt : pullRequest.updatedAt
      mergeable: pullRequest.mergeable
      additions: pullRequest.additions
      deletions: pullRequest.deletions
      assignees : assigneesList
      repo : pullRequest.repo.name
    }

    pullrequestsCached = _.without pullrequestsCachedData, _.findWhere(pullrequestsCachedData,
      number: pullRequestObject.number
      repo: pullRequestObject.repo)

    pullrequestsCached.push pullRequestObject

    Utils.robot.brain.set GitHubDataService.GITHUB_PULL_REQUESTS_CACHE, pullrequestsCached


module.exports = GitHubDataService