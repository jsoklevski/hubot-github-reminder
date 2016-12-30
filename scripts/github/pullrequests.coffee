_ = require "underscore"

Octokat = require "octokat"
Config = require "../config"
Utils = require "../utils"
Promise = require "promise"
cronJob = require("cron").CronJob

octo = new Octokat
  token: Config.github.token
  rootUrl: Config.github.url

class PullRequests

  constructor: (@robot) ->
    @robot.brain.once 'loaded', =>
      # Run a cron job that runs every day at 4:00 am
      new cronJob('00 00 4 * * *', @_clearCache.bind(@), null, true, null, null, true)

  _clearCache: ->
    @robot.logger.info "clear Cache"
    @_getAllOpenPullRequestsForAllRepose()

  initializeCache: ->
    @robot.logger.info "init Cache"
    @_getAllOpenPullRequestsForAllRepose()

  _getAllOpenPullRequestsForAllRepose: ->
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
      Utils.robot.logger.error "0"
      Utils.robot.logger.error error
      Promise.reject error
    .then (results)->
      _processRepos results
    .catch (error) ->
      Utils.robot.logger.error "1"
      Utils.robot.logger.error error
      Promise.reject error
    .then (pullRequestObjects) ->
      _cacheStuff pullRequestObjects
    .catch ( error ) ->
      Utils.robot.logger.error "2"
      Utils.robot.logger.error error
      Promise.reject error

  _cacheStuff= (pullRequestObjects) ->
    cacheResult = []
    for repo in pullRequestObjects
      for p in repo when p
        cacheResult.push p
    @robot.brain.set "github-pr-cache", cacheResult
    @robot.logger.info "Cache Saved key used: github-pr-cache"

  _processRepos= (results) ->
    return Promise.all results.map (currentRepo) ->
      repo = octo.repos(Config.github.organization, currentRepo.name)
      repo.pulls.fetch(state: "open")
      .then (json) ->
        return Promise.all json.map (pr) ->
          repo.pulls(pr.number).fetch()
          .then (fetchedPullRequest) ->
            _formatPullRequest fetchedPullRequest, currentRepo.name
          .catch (error) ->
            Utils.robot.logger.error "3"
            Utils.robot.logger.error error
            Promise.reject error
      .catch (error) ->
        Utils.robot.logger.error "4"
        Utils.robot.logger.error error
        Promise.reject error


  _formatPullRequest= (fetchedPullRequest, repoName) ->
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
      mergable: fetchedPullRequest.mergeable
      additions: fetchedPullRequest.additions
      deletions: fetchedPullRequest.deletions
      assignenes : assigneesList
      repo : repoName
    }
    return pullRequestObject

module.exports = PullRequests
