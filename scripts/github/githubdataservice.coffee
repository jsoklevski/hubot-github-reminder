_ = require "underscore"
Utils = require "../utils"
PullRequest = require "./pullrequest"


class GitHubDataService


  @openForUser: (hubotUsername) ->
    pullrequestsData = Utils.robot.brain.get("github-pr-cache")

    githubUserName = Utils.lookupUserWithHubot hubotUsername

    if !githubUsername
      githubUsername = hubotUsername.name
      Utils.robot.emit "GithubPullRequestsOpenForUser", hubotUsername

    pullRequestsForUser = []

    if pullrequestsData != null
      for pr in pullrequestsData
        for assignee in pr.assignees when assignee
          if assignee == githubUserName then pullRequestsForUser.push new PullRequest pr githubUserName


    Utils.robot.emit "GithubPullRequestsOpenForUser", pullRequestsForUser, hubotUsername

  @updatePullRequestsCache: (pullRequest) ->
    pullrequestsCachedData = Utils.robot.brain.get("github-pr-cache")

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
      mergable: pullRequest.mergeable
      additions: pullRequest.additions
      deletions: pullRequest.deletions
      assignees : assigneesList
      repo : pullRequest.repo.name
    }

    pullrequestsCached = _.without pullrequestsCachedData, _.findWhere(pullrequestsCachedData,
      number: pullRequestObject.number
      repo: pullRequestObject.repo)

    pullrequestsCached.push pullRequestObject

    Utils.robot.brain.set "github-pr-cache", pullrequestsCached


module.exports = GitHubDataService