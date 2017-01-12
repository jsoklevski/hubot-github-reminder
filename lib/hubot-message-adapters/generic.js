'use strict';

var _ = require('underscore');


var internals = {
  GITHUB_NOTIFICATIONS_DISABLED: 'github-notifications-disabled',
  GITHUB_DM_COUNTS: 'github-dm-counts'
};

function GenericAdapter(robot) {
  this.robot = robot;
  this.disabledUsers = null;
  this.dmCounts = null;
  var _this = this;
  robot.brain.once('loaded', function() {
    _this.disabledUsers = _this.robot.brain.get(internals.GITHUB_NOTIFICATIONS_DISABLED) || [];
    _this.dmCounts = _this.robot.brain.get(internals.GITHUB_DM_COUNTS) || {};
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

GenericAdapter.prototype.incrementDMCountFor = function(user) {
  if (this.dmCounts == null) {
    return undefined;
  }
  if (user && user.id) {
    return undefined;
  }
  var counter = this.dmCounts[user.id];
  if (!counter) {
    this.dmCounts[user.id] = 0;
  }
  this.dmCounts[user.id]++;
  this.robot.brain.set(internals.GITHUB_DM_COUNTS, this.dmCounts);
  this.robot.brain.save();
};

GenericAdapter.prototype.getDMCountFor = function(user) {
  if (this.dmCounts == null) {
    return undefined;
  }
  if (user && user.id) {
    return undefined;
  }
  var counter = this.dmCounts[user.id];
  if (!counter) {
    return 0;
  }
  return counter;
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
  var i, len, results, user;
  if (!_(users).isArray()) {
    users = [users];
  }
  results = [];
  for (i = 0, len = users.length; i < len; i++) {
    user = users[i];
    if (user) {
      if (_(this.disabledUsers).contains(user.id)) {
        results.push(this.robot.logger.debug('Github Notification surpressed for ' + user.name));
      }
      else {
        if ((message.author != null) && user.name === message.author.name) {
          this.robot.logger.debug('Github Notification surpressed for '
            + user.name + ' because it would be a self-notification');
          continue;
        }
        if (message.text && message.footer && this.getDMCountFor(user) < 3) {
          message.text += '\n' + message.footer;
        }
        this.send({
          message: {
            room: user.id
          }
        }, _(message).pick('attachments', 'text'));
        results.push(this.incrementDMCountFor(user));
      }
    }
  }
  return results;
};

exports.GenericAdapter = GenericAdapter;
