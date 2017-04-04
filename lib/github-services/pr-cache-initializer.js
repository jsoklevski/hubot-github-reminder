'use strict';

var _ = require('underscore'),
  Octokat = require('octokat');

var utils = require('../utils');

var internals = {
  HUBOT_GITHUB_TOKEN: process.env.HUBOT_GITHUB_TOKEN,
  HUBOT_GITHUB_ORG: process.env.HUBOT_GITHUB_ORG,
  GITHUB_PULL_REQUESTS_CACHE: 'github-pr-cache',
  GITHUB_PULL_REQUESTS_CACHE_INITIALIZED: 'github-pr-cache-initialized'
};


function PullRequestsCacheInit(robot) {
  this.robot = robot;
}

PullRequestsCacheInit.prototype.clearCache = function(force_refresh, hubot_user) {
  try {
    var cache_initilaized = this.robot.brain.get(internals.GITHUB_PULL_REQUESTS_CACHE_INITIALIZED);

    if (!cache_initilaized || force_refresh) {
      internals.getAllOpenPullRequestsForAllRepos(this.robot, hubot_user);
    }
  }
  catch (e) {
    this.robot.logger.error(e);
  }
};

internals.getAllOpenPullRequestsForAllRepos = function(robot, hubot_user) {
  robot.logger.info('Reinitialize Cache');
  var octo = new Octokat({
    token: internals.HUBOT_GITHUB_TOKEN
  });
  var org = octo.orgs(internals.HUBOT_GITHUB_ORG);
  org.repos.fetch().then(function(page) {
    var results = [];
    function handlePage(pageResults) {
      results = _.union(results, pageResults.items);
      if (!pageResults.nextPage) {
        return Promise.resolve(results);
      }
      return pageResults.nextPage.fetch().then(handlePage);
    }
    return handlePage(page);
  }).then(function(results) {
    return internals.processRepos(results, octo);
  }).then(function(pull_request_objects) {
    internals.cachePullRequests(pull_request_objects, robot, hubot_user);
  }).catch(function(error) {
    robot.logger.error(error);
    if (hubot_user) {
      robot.emit('CacheInitialization', hubot_user, true);
    }
    return Promise.reject(error);
  });
};

internals.cachePullRequests = function(pull_request_objects, robot, hubot_user) {
  var cache_result = [];
  for (var i = 0, len = pull_request_objects.length; i < len; i++) {
    var repo = pull_request_objects[i];
    for (var j = 0, len1 = repo.length; j < len1; j++) {
      cache_result.push(repo[j]);
    }
  }
  robot.brain.set(internals.GITHUB_PULL_REQUESTS_CACHE, cache_result);
  robot.brain.set(internals.GITHUB_PULL_REQUESTS_CACHE_INITIALIZED, true);
  if (hubot_user) {
    robot.emit('CacheInitialization', hubot_user, true);
  }
  robot.logger.info('Cache Saved key used: github-pr-cache');
};

internals.processRepos = function(results, octo) {
  return Promise.all(results.map(function(currentRepo) {
    var repo = octo.repos(internals.HUBOT_GITHUB_ORG, currentRepo.name);
    return repo.pulls.fetch({
      state: 'open'
    }).then(function(json) {
      return Promise.all(json.items.map(function(pr) {
        return repo.pulls(pr.number).fetch().then(function(fetched_pr) {
          return octo.fromUrl(pr.Links.statuses.href).fetch().then(function(checks) {
              var status_result = utils.processStatuses(checks);
              return Promise.resolve(
                utils.formatPullRequest(fetched_pr, status_result));
          });
        });
      }));
    });
  }));
};



exports.PullRequestsCacheInit = PullRequestsCacheInit;

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
