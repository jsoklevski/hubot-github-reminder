'use strict';

var _ = require('underscore'),
    CronJob = require('cron').CronJob;



var internals = {
  GITHUB_REMINDERS: 'github-reminders'
};

function Reminders(robot, callback) {
  this.robot = robot;
  this.cb = callback;
  var _this = this;
  robot.brain.once('loaded', function() {
    return new CronJob('0 * * * * 1-5',  _this.check.bind(_this), null, true);
  });
}

Reminders.prototype.getReminders = function() {
  return this.robot.brain.get(internals.GITHUB_REMINDERS) || [];
};

Reminders.prototype.saveReminders = function(reminders) {
  this.robot.brain.set(internals.GITHUB_REMINDERS, reminders);
};

Reminders.prototype.check = function() {
  var reminders;
  reminders = this.getReminders();
  _.chain(reminders).filter(this.shouldFire).pluck('user').each(this.cb);
};

Reminders.prototype.shouldFire = function(reminder) {
  var now = new Date(),
      current_hours = now.getHours(),
      current_minutes = now.getMinutes(),
      reminder_hours = reminder.time.split(':')[0],
      reminder_minutes = reminder.time.split(':')[1];
  try {
    reminder_hours = parseInt(reminder_hours, 10);
    reminder_minutes = parseInt(reminder_minutes, 10);
  }
  catch (error) {
    return false;
  }
  return reminder_hours === current_hours && reminder_minutes === current_minutes;
};

Reminders.prototype.getForUser = function(user) {
  return _.where(this.getReminders(), {
    user: user
  });
};

Reminders.prototype.save = function(user, time) {
  var newReminder, reminders;
  reminders = this.getReminders();
  newReminder = {
    time: time,
    user: user
  };
  reminders.push(newReminder);
  return this.saveReminders(reminders);
};

Reminders.prototype.clearAllForUser = function(user) {
  var reminders = this.getReminders();
  var reminders_to_keep = _.reject(reminders, {
    user: user
  });
  this.saveReminders(reminders_to_keep);
  return reminders.length - reminders_to_keep.length;
};

Reminders.prototype.clearForUserAtTime = function(user, time) {
  var reminders = this.getReminders();
  var reminders_to_keep = _.reject(reminders, {
    user: user,
    time: time
  });
  this.saveReminders(reminders_to_keep);
  return reminders.length - reminders_to_keep.length;
};

exports.Reminders = Reminders;
