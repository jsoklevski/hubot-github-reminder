'use strict';

var _ = require('underscore');


var internals = {
  GITHUB_NOTIFICATIONS_DISABLED: 'github-notifications-disabled',
  GITHUB_DM_COUNTS: 'github-dm-counts'
};

function GenericAdapter(robot) {
  this.robot = robot;
  this.disabledUsers = null;
  var _this = this;
  robot.brain.once('loaded', function() {
    _this.disabledUsers = _this.robot.brain.get(internals.GITHUB_NOTIFICATIONS_DISABLED) || [];
  });
}

GenericAdapter.prototype.disableNotificationsFor = function(user) {
  this.robot.logger.info('Disabling Github notifications for ' + user.name);
  this.disabledUsers.push(user.id);
  this.robot.brain.set(internals.GITHUB_NOTIFICATIONS_DISABLED, _(this.disabledUsers).unique());
  return this.robot.brain.save();
};

GenericAdapter.prototype.enableNotificationsFor = function(user) {
  this.robot.logger.info('Enabling Github notifications for ' + user.name);
  this.disabledUsers = _(this.disabledUsers).without(user.id);
  this.robot.brain.set(internals.GITHUB_NOTIFICATIONS_DISABLED, this.disabledUsers);
  return this.robot.brain.save();
};

GenericAdapter.prototype.send = function(context, message) {
  var payload;
  payload = {};
  if (_(message).isString()) {
    payload.text = message;
  }
  else {
    payload = _(payload).extend(message);
  }
  return this.robot.adapter.send({
    room: context.message.room
  }, payload);
};


GenericAdapter.prototype.dm = function(users, message) {
  var i, len, user;
  if (!_(users).isArray()) {
    users = [users];
  }
  for (i = 0, len = users.length; i < len; i++) {
    user = users[i];
    if (user) {
      if (_(this.disabledUsers).contains(user.id)) {
        this.robot.logger.info('Github Notification surpressed for ' + user.name);
      }
      else {
        this.send({
          message: {
            room: user.id
          }
        }, _(message).pick('attachments', 'text'));
      }
    }
  }
};

exports.GenericAdapter = GenericAdapter;
