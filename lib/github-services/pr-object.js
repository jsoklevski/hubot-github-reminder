'use strict';

var moment = require('moment');

function PullRequestObject(json, assignee) {
  var k, v;
  this.assignee = assignee;
  for (k in json) {
    if (json.hasOwnProperty(k)) {
      v = json[k];
      this[k] = v;
    }
  }
}

PullRequestObject.prototype.toAttachment = function() {
  return {
    color: '#ff9933',
    author_name: this.author,
    title: this.title,
    title_link: this.url,
    fields: [
      {
        title: 'Updated',
        value: moment(this.updatedAt).fromNow(),
        short: true
      }, {
        title: 'Status',
        value: this.mergeable ? 'Mergeable' : 'Unresolved Conflicts',
        short: true
      }, {
        title: 'Assignees',
        value: this.assignees ? '<@' + JSON.stringify(this.assignees) + '>' :
               '<@' + this.assignee + '>',
        short: true
      }, {
        title: 'Lines',
        value: '+' + this.additions + ' -' + this.deletions,
        short: true
      }, {
        title: 'Status Checks',
        value: this.statusChecks ? '<@' + this.statusChecks + '>' : undefined,
        short: true
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
