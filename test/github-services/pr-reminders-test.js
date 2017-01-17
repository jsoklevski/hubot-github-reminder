'use strict';

var Reminders = require('../../lib/github-services/pr-reminders').Reminders,
    test_util = require('../../test-util/common-test-util.js');

describe(__filename, function() {


  describe('execute', function() {
    var robot = test_util.mockRobot();

    describe('save reminder and list reminder for user', function() {

      it('should seve a reminder for user and thn remove it', function(done) {
        var reminders = new Reminders(robot);
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
  });
});
