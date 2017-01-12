'use strict';

var Reminders = require('../../lib/github-services/pr-reminders').Reminders,
    test_util = require('../../test-util/common-test-util.js');

describe(__filename, function() {


  describe('execute', function() {
    var robot = test_util.mockRobot();

    describe('save reminder and list reminder for user', function() {

      it('should seve a reminder for user and thn remove it', function(done) {
        var reminders = new Reminders(robot, function () {
        });
        reminders.save('test', '09:10');
        var remindersForUser = reminders.getForUser('test');
        remindersForUser.should.eql([
          {
            user: 'test',
            time: '09:10'
          }]);
        reminders.clearAllForUser('test');
        remindersForUser = reminders.getForUser('test');
        remindersForUser.should.eql([]);
        done();
      });
    });

    describe('check if callback is called once brain is loaded', function() {

      it('should check if callback for user test is called', function(done) {
        var reminders = new Reminders(robot, function (user) {
          user.should.eql('test');
          done();
        });

        var now = new Date(),
            current_hours = now.getHours(),
            current_minutes = now.getMinutes() + 1;
        reminders.save('test', current_hours + ':' + current_minutes);
      });
    });
  });
});
