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

  constructor: (@robot, @key) ->
    @robot.brain.once 'loaded', =>
      @robot.logger.error "Loading Cache"
      @robot.logger.error @key
      # Run a cron job that runs every day at 4:00 am
      @initializeCache()
      new cronJob('0 4 * * * *', @_clearCache.bind(@), null, true)

  _clearCache: ->
    @robot.logger.info "clear Cache"
    @_getAllOpenPullRequestsForAllRepose()

  initializeCache: ->
    @robot.logger.info "init Cache"
    @_getAllOpenPullRequestsForAllRepose()

  _getAllOpenPullRequestsForAllRepose: ->
    @robot.logger.info "loading Cache"
    org = octo.orgs(Config.github.organization)
    org.repos.fetch()
    .then (page) ->
      results = []
      @robot.logger.info "Page Loaded"
      handlePage = (pageResults) ->
        results = results.concat(pageResults);
        if pageResults.nextPage == undefined then return results;
        return pageResults.nextPage().then(handlePage);
      handlePage(page)
    .then (results) ->
      return Promise.all results.map (currentRepo) ->
        @robot.logger.info "Porcessing Repo #{currentRepo.name}"
        repo = octo.repos(Config.github.organization, currentRepo.name)
        repo.pulls.fetch(state: "open")
        .then (json) ->
          return Promise.all json.map (pr) ->
            @robot.logger.info "Porcessing PR #{pr.number}"
            repo.pulls(pr.number).fetch()
            .then (fetchedPullRequest) ->
              @robot.logger.info "PullRequest PR #{fetchedPullRequest.number}"
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
                repo : currentRepo.name
              }
              return pullRequestObject

    .then (pullRequestObjects) ->
      cacheResult = []
      for repo in pullRequestObjects
        for p in repo when p
          cacheResult.push p
      @robot.brain.set @key, cacheResult
      @robot.logger.error @key
    .catch ( error ) ->
      Utils.robot.logger.error error
      Promise.reject error

module.exports = PullRequests
