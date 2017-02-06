'use strict';

var moment = require('moment');


var internals = {
};


function PullRequestObject(json, assignee, reviewer) {
  var k, v;
  this.assignee = assignee;
  this.reviewer = reviewer;
  for (k in json) {
    if (json.hasOwnProperty(k)) {
      v = json[k];
      this[k] = v;
    }
  }
}
internals.formatStatusChecks = function (checksMap) {
  var result_string = '';
  for (var key in checksMap) {
    if (checksMap.hasOwnProperty(key)) {
      result_string = result_string + key + ' -> ' + checksMap[key] + '\n ';
    }
  }
  return result_string;
};

internals.getNotificaitonColor = function (statusChecks) {
  if (statusChecks.allChecksPassed) {
    if (statusChecks.pendingChecks) {
      return '#ff9933';
    }
    else {
      return '#33ff36';
    }
  }
  else {
    return '#ff3333';
  }
};

PullRequestObject.prototype.toAttachment = function() {
  return {
    color: internals.getNotificaitonColor(this.statusChecks),
    author_name: this.author,
    author_icon: this.authorAvatarUrl,
    author_link: this.authorHtmlUrl,
    title: this.title,
    title_link: this.url,
    fields: [
      {
        title: 'Repo Name',
        value: this.repo ? this.repo : '',
        short: true
      },
      {
        title: 'Updated',
        value: moment(this.updatedAt).fromNow(),
        short: true
      },
      {
        title: 'Action',
        value: this.action ? this.action : 'reminder',
        short: true
      },
      {
        title: 'Status',
        value: this.mergeable ? 'Mergeable' : 'Unresolved Conflicts',
        short: true
      },
      {
        title: 'Assignees',
        value: this.assignees ? this.assignees.toString() : this.assignee,
        short: true
      },
      {
        title: 'Reviewers',
        value: this.action === 'review requested' ?
          this.requestedReviewers.toString() : this.reviewer,
        short: true
      },
      {
        title: 'Lines',
        value: '+' + this.additions + ' -' + this.deletions,
        short: true
      },
      {
        title: 'Status Checks',
        value: this.statusChecks ?
          internals.formatStatusChecks(this.statusChecks.checksMap) : 'Not Found',
        short: false
      }
    ],
    fallback: '*' + this.title + '* +' + this.additions + ' - ' + this.deletions
      + '\nUpdated: *' + (moment(this.updatedAt).fromNow())
      + '*\nStatus: ' + (this.mergeable ? 'Mergeable' : 'Unresolved Conflicts')
      + '\nAuthor: ' + this.author
      + '\nAssignee: ' + (this.assignees ? '' + JSON.stringify(this.assignees) :
        '<@' + this.assignee + '>')
  };
};

exports.PullRequestObject = PullRequestObject;
