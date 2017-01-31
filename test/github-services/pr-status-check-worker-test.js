'use strict';

var PrStatusCheckWorker = require(
  '../../lib/github-services/pr-status-check-worker').PrStatusCheckWorker,
    test_util = require('../../test-util/common-test-util.js');

describe(__filename, function() {


  describe('execute', function() {
    var robot = test_util.mockRobot();
    var statusCheckWorker = new PrStatusCheckWorker(robot);

    beforeEach(function() {
      statusCheckWorker.clearAllStatusChecks();
    });

    describe('save reminder and list reminders ', function() {

      it('should save a reminder and then display it in the list of checks', function(done) {
        var statusCheck = {
          pr: 123,
          repoName: 'xxx',
          assigneesList: ['yyy'],
          authorNotified: false,
          time_created: new Date()
        };
        statusCheckWorker.save(statusCheck);
        var reminders = statusCheckWorker.getStatusChecks();
        reminders.should.eql([statusCheck]);
        done();
      });
      it('should clear all status checks after one is added', function(done) {
        var statusCheck = {
          pr: 123,
          repoName: 'xxx',
          assigneesList: ['yyy'],
          authorNotified: false,
          time_created: new Date()
        };
        statusCheckWorker.save(statusCheck);
        statusCheckWorker.clearAllStatusChecks();
        var reminders = statusCheckWorker.getStatusChecks();
        reminders.should.eql([]);
        done();
      });

      it('should save one reminder with two assignees', function(done) {
        var statusCheck = {
          pr: 123,
          repoName: 'xxx',
          assigneesList: ['yyy'],
          authorNotified: false,
          time_created: new Date()
        };
        var statusCheck2 = {
          pr: 123,
          repoName: 'xxx',
          assigneesList: ['zzz'],
          authorNotified: false,
          time_created: new Date()
        };
        statusCheckWorker.save(statusCheck);
        statusCheckWorker.save(statusCheck2);
        var reminders = statusCheckWorker.getStatusChecks();
        var result = [{
          pr: 123,
          repoName: 'xxx',
          assigneesList: ['yyy', 'zzz'],
          authorNotified: false,
          time_created: statusCheck.time_created
        }];
        reminders.should.eql(result);
        done();
      });

      it('should remove unassigned user', function(done) {
        var statusCheck = {
          pr: 345,
          repoName: 'xxx',
          assigneesList: ['yyy'],
          authorNotified: false,
          time_created: new Date()
        };
        var statusCheck2 = {
          pr: 345,
          repoName: 'xxx',
          assigneesList: ['zzz'],
          authorNotified: false,
          time_created: new Date()
        };
        statusCheckWorker.save(statusCheck);
        statusCheckWorker.save(statusCheck2);
        statusCheckWorker.removeAssignee({
          pr: 345,
          repoName: 'xxx',
          assigneesList: ['zzz']
        });
        var reminders = statusCheckWorker.getStatusChecks();
        var result = [{
          pr: 345,
          repoName: 'xxx',
          assigneesList: ['yyy'],
          authorNotified: false,
          time_created: statusCheck.time_created
        }];
        reminders.should.eql(result);
        done();
      });
      it('should remove status checks for pr', function(done) {
        var statusCheck = {
          pr: 345,
          repoName: 'xxx',
          assigneesList: ['yyy'],
          authorNotified: false,
          time_created: new Date()
        };
        var statusCheck2 = {
          pr: 345,
          repoName: 'xxx',
          assigneesList: ['zzz'],
          authorNotified: false,
          time_created: new Date()
        };
        var statusCheck3 = {
          pr: 123,
          repoName: 'ccc',
          assigneesList: ['zzz'],
          authorNotified: false,
          time_created: new Date()
        };
        statusCheckWorker.save(statusCheck);
        statusCheckWorker.save(statusCheck2);
        statusCheckWorker.save(statusCheck3);
        statusCheckWorker.clearStatusCheckForPr(345, 'xxx');
        var reminders = statusCheckWorker.getStatusChecks();
        reminders.should.eql([statusCheck3]);
        done();
      });
    });
  });
});
