'use strict';

var github_data_service = require('../../lib/github-services/github-data-service'),
    test_util = require('../../test-util/common-test-util.js'),
    cached_pr = require('../mock-data/cached-pr.json'),
    new_pr = require('../mock-data/new-pr.json'),
    formated_pr = require('../mock-data/formated-pr.json'),
    updated_cache = require('../mock-data/updated-cache.json'),
    exiting_pr = require('../mock-data/updated-existing-pr.json'),
    closed_pr = require('../mock-data/close-existing-pr.json'),
    utils = require('../../lib/utils');


describe(__filename, function() {


  describe('execute', function() {
    var robot = test_util.mockRobot();

    beforeEach(function() {
      robot.brain.set('github-pr-cache', cached_pr);
      utils.rememberUser(robot.brain, 'test', 'test');
      utils.rememberUser(robot.brain, 'test123', 'test123');
    });

    describe('tests for getOpenPrforUser', function() {

      it('should retrun the event fired containing open pr for user', function(done) {
        var hubot_username = utils.lookupUserWithGithub(robot.brain, 'test');
        var result = github_data_service.openForUser(robot, hubot_username, false);
        result.eventName.should.eql('GithubPullRequestsOpenForUser');
        result.responseObject.length.should.eql(2);
        done();
      });

      it('should retrun the event fired containing  created pr by user', function(done) {
        var hubot_username = utils.lookupUserWithGithub(robot.brain, 'test123');
        var result = github_data_service.openForUser(robot, hubot_username, true);
        result.eventName.should.eql('GithubPullRequestsOpenForUser');
        result.responseObject.length.should.eql(1);
        done();
      });

      it('should return 0 open pr', function(done) {
        var hubot_username = utils.lookupUserWithGithub(robot.brain, 'test123');
        var result = github_data_service.openForUser(robot, hubot_username, false);
        result.eventName.should.eql('GithubPullRequestsOpenForUser');
        result.responseObject.length.should.eql(0);
        done();
      });

      it('check open prs for hubot user with no github username provided ', function(done) {
        var hubot_username = {
          name: 'test456',
          id: 'test456'
        };
        var result = github_data_service.openForUser(robot, hubot_username, false);
        result.eventName.should.eql('GithubPullRequestsOpenForUser');
        result.responseObject.length.should.eql(0);
        done();
      });
    });

    describe('test for updating open pr cache', function() {

      it('should add new pr', function(done) {
        github_data_service.updatePullRequestsCache(robot, formated_pr, new_pr.state);
        var updated_cache_to_check = robot.brain.get('github-pr-cache');
        updated_cache_to_check.should.eql(updated_cache);
        done();
      });

      it('should update existing pr', function(done) {
        github_data_service.updatePullRequestsCache(robot, exiting_pr, 'open');
        var updated_cache_to_check = robot.brain.get('github-pr-cache');
        updated_cache_to_check.length.should.eql(3);
        done();
      });

      it('should remove closed pr', function(done) {
        github_data_service.updatePullRequestsCache(robot, closed_pr, 'closed');
        var updated_cache_to_check = robot.brain.get('github-pr-cache');
        updated_cache_to_check.length.should.eql(2);
        done();
      });
    });
  });
});
