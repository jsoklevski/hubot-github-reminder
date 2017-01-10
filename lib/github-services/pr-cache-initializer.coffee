Octokat = require "octokat"
Config = require "../config"
Utils = require "../utils"
Promise = require "promise"
CronJob = require("cron").CronJob

octo = new Octokat
  token: Config.github.token
  rootUrl: Config.github.url

class PullRequestsCacheInit
  @GITHUB_PULL_REQUESTS_CACHE: "github-pr-cache"

  constructor: (@robot) ->
    @robot.brain.once 'loaded', =>
      # Run a cron job that runs every day at 4:00 am
      new CronJob('0 0 4 * * *', @clearCache.bind(@), null, true, null, null, true)

  clearCache: ->
    @robot.logger.info "init Cache"
    @getAllOpenPullRequestsForAllRepose()

  getAllOpenPullRequestsForAllRepose= ->
    @robot.logger.info "Reinitialize Cache"
    org = octo.orgs(Config.github.organization)
    org.repos.fetch()
    .then (page) ->
      results = []
      handlePage = (pageResults) ->
        results = results.concat(pageResults);
        if pageResults.nextPage == undefined then return Promise.resolve results;
        return pageResults.nextPage().then(handlePage);
      handlePage(page)
    .catch (error) ->
      Utils.robot.logger.error error
      Promise.reject error
    .then (results)->
      processRepos results
    .catch (error) ->
      Utils.robot.logger.error error
      Promise.reject error
    .then (pullRequestObjects) ->
      cachePullRequests pullRequestObjects
    .catch ( error ) ->
      Utils.robot.logger.error error
      Promise.reject error

  cachePullRequests= (pullRequestObjects) ->
    cacheResult = []
    for repo in pullRequestObjects
      for p in repo when p
        cacheResult.push p
    @robot.brain.set PullRequestsCacheInit.GITHUB_PULL_REQUESTS_CACHE, cacheResult
    @robot.logger.info "Cache Saved key used: github-pr-cache"

  processRepos= (results) ->
    return Promise.all results.map (currentRepo) ->
      repo = octo.repos(Config.github.organization, currentRepo.name)
      repo.pulls.fetch(state: "open")
      .then (json) ->
        return Promise.all json.map (pr) ->
          repo.pulls(pr.number).fetch()
          .then (fetchedPullRequest) ->
            formatPullRequest fetchedPullRequest, currentRepo.name
          .catch (error) ->
            Utils.robot.logger.error error
            Promise.reject error
      .catch (error) ->
        Utils.robot.logger.error error
        Promise.reject error


  formatPullRequest= (fetchedPullRequest, repoName) ->
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
    }
    return pullRequestObject

module.exports = PullRequestsCacheInit
