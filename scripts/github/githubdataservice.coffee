_ = require "underscore"
Utils = require "../utils"
PullRequest = require "./pullrequest"


class GitHubDataService
  githubPullRequestsData = "github-pr-cache"


  @openForUser: (githubUserName) ->
    pullrequestsData = Utils.robot.brain.get(githubPullRequestsData)

    pullRequestsForUser = []

    for pr in pullrequestsData
      for assignee in pr.assignenes when assignee
        if assignee == githubUserName then pullRequestsForUser.push new PullRequest pr githubUserName

    Utils.robot.emit "GithubPullRequestsOpenForUser", pullRequestsForUser, githubUserName

  @updatePullRequestsCache: (pullRequest) ->
    pullrequestsCachedData = Utils.robot.brain.get(githubPullRequestsData)

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
      assignenes : assigneesList
      repo : pullRequest.repo.name
    }

    pullrequestsCached = _.without pullrequestsCachedData, _.findWhere(pullrequestsCachedData,
      number: pullRequestObject.number
      repo: pullRequestObject.repo)

    pullrequestsCached.push pullRequestObject

    Utils.robot.brain.set githubPullRequestsData, pullrequestsCached


module.exports = GitHubDataService