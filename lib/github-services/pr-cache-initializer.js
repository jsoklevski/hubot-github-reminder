'use strict';

var Octokat = require('octokat'),
  CronJob = require('cron').CronJob;

var internals = {
  HUBOT_GITHUB_TOKEN: process.env.HUBOT_GITHUB_TOKEN,
  HUBOT_GITHUB_ORG: process.env.HUBOT_GITHUB_ORG,
  GITHUB_PULL_REQUESTS_CACHE: 'github-pr-cache'
};


function PullRequestsCacheInit(robot) {
  this.robot = robot;
  var _this = this;
  robot.brain.once('loaded', function() {
    return new CronJob('0 0 4 * * *', _this.clearCache.bind(_this), null, true, null, null, true);
  });
}

PullRequestsCacheInit.prototype.clearCache = function() {
  try {
    internals.getAllOpenPullRequestsForAllRepos(this.robot);
  }
  catch (e) {
    this.robot.logger.error(e);
  }
};

internals.getAllOpenPullRequestsForAllRepos = function(robot) {
  robot.logger.info('Reinitialize Cache');
  var octo = new Octokat({
    token: internals.HUBOT_GITHUB_TOKEN
  });
  var org = octo.orgs(internals.HUBOT_GITHUB_ORG);
  org.repos.fetch().then(function(page) {
    var results = [];
    function handlePage(pageResults) {
      results = results.concat(pageResults);
      if (!pageResults.nextPage) {
        return Promise.resolve(results);
      }
      return pageResults.nextPage().then(handlePage);
    }
    return handlePage(page);
  }).catch(function(error) {
    robot.logger.error(error);
    return Promise.reject(error);
  }).then(function(results) {
    return internals.processRepos(results, octo, robot);
  }).catch(function(error) {
    robot.logger.error(error);
    return Promise.reject(error);
  }).then(function(pull_request_objects) {
    internals.cachePullRequests(pull_request_objects, robot);
  }).catch(function(error) {
    robot.logger.error(error);
    return Promise.reject(error);
  });
};

internals.cachePullRequests = function(pull_request_objects, robot) {
  var cache_result = [];
  for (var i = 0, len = pull_request_objects.length; i < len; i++) {
    var repo = pull_request_objects[i];
    for (var j = 0, len1 = repo.length; j < len1; j++) {
      cache_result.push(repo[j]);
    }
  }
  robot.brain.set(internals.GITHUB_PULL_REQUESTS_CACHE, cache_result);
  robot.logger.info('Cache Saved key used: github-pr-cache');
};

internals.processRepos = function(results, octo, robot) {
  return Promise.all(results.map(function(currentRepo) {
    var repo = octo.repos(internals.HUBOT_GITHUB_ORG, currentRepo.name);
    return repo.pulls.fetch({
      state: 'open'
    }).then(function(json) {
      return Promise.all(json.map(function(pr) {
        return repo.pulls(pr.number).fetch().then(function(fetchedPullRequest) {
          return Promise.resolve(
            internals.formatPullRequest(robot, fetchedPullRequest, currentRepo.name));
        }).catch(function(error) {
          robot.logger.error(error);
          return Promise.reject(error);
        });
      }));
    }).catch(function(error) {
      robot.logger.error(error);
      return Promise.reject(error);
    });
  }));
};

internals.formatPullRequest = function(robot, fetched_pull_request, repoName) {
  var assignees_list = [];
  var pr_assignees = fetched_pull_request.assignees;
  if (pr_assignees && pr_assignees.length > 0) {
    robot.logger.info('Test');
    pr_assignees.map(function(assignee) {
      robot.logger.info('Processing Pr ' + JSON.stringify(assignee));
      assignees_list.push(assignee.login);
    });
  }
  return {
    number: fetched_pull_request.number,
    url: fetched_pull_request.html_url,
    state: fetched_pull_request.state,
    title: fetched_pull_request.title,
    author: fetched_pull_request.user.login,
    updatedAt: fetched_pull_request.updatedAt,
    mergeable: fetched_pull_request.mergeable,
    additions: fetched_pull_request.additions,
    deletions: fetched_pull_request.deletions,
    assignees: assignees_list,
    repo: repoName
  };
};

exports.PullRequestsCacheInit = PullRequestsCacheInit;

/* istanbul ignore else */
if (process.env.NODE_ENV === 'test') {
  /** @type Object */
  exports.internals = internals;
}
