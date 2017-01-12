'use strict';

var should = require('chai').should();

var utils = require('../lib/utils'),
    test_util = require('../test-util/common-test-util.js'),
    new_pr = require('./mock-data/new-pr.json'),
    formated_pr = require('./mock-data/formated-pr.json');



describe(__filename, function() {


  describe('execute', function() {
    var robot = test_util.mockRobot();

    describe('test users memory', function() {

      it('should save user and return it', function(done) {
        utils.rememberUser(robot.brain, 'test', 'test');
        var hubotUser = utils.lookupUserWithGithub(robot.brain, 'test');
        hubotUser.should.eql({
          name: 'test',
          id: 'test',
          real_name: 'test'
        });
        done();
      });

      it('should save user and return it', function(done) {
        utils.rememberUser(robot.brain, 'test', 'test789');
        var github_username = utils.lookupUserWithHubot(robot.brain, 'test');
        github_username.should.eql('test789');
        done();
      });

      it('should save user and return it', function(done) {
        var github_username = utils.lookupUserWithHubot(robot.brain, 'test89');
        should.not.exist(github_username);
        done();
      });

      it('should return hubot user if there is one same as github username', function(done) {
        var hubotUser = utils.lookupUserWithGithub(robot.brain, 'test123');
        hubotUser.should.eql({
          name: 'test123',
          id: 'test123',
          real_name: 'test123'
        });
        done();
      });

      it('should not return anything for not exisitng user', function(done) {
        var hubotUser = utils.lookupUserWithGithub(robot.brain, 'test456');
        should.not.exist(hubotUser);
        done();
      });
    });

    describe('test logic for formation pr', function() {

      it('should format pr', function(done) {
        var formated_pr_to_check = utils.formatPullRequest(new_pr, 'test-repo');
        formated_pr_to_check.should.eql(formated_pr);
        done();
      });
    });
  });
});
