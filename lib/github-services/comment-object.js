'use strict';

var internals = {
};


function CommentObject(json) {
  var k, v;
  for (k in json) {
    if (json.hasOwnProperty(k)) {
      v = json[k];
      this[k] = v;
    }
  }
}

internals.getNotificationColor = function (state) {
  if (state) {
    if (state === 'approved') {
      return '#33ff36';
    }
    else {
      return '#ff3333';
    }
  }
  else {
    return '#ff9933';
  }
};

CommentObject.prototype.toAttachment = function() {
  return {
    color: internals.getNotificationColor(this.state),
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
        title: 'Action',
        value: this.action ? this.action : '',
        short: true
      },
      {
        title: 'Comment',
        value: this.body ,
        short: false
      },
      {
        title: 'State',
        value: this.state ? this.state : '',
        short: false
      },
      {
        title: 'Assignees',
        value: this.assignees ? this.assignees.toString() : this.assignee,
        short: true
      },
      {
        title: 'Reviewers',
        value: this.requestedReviewers ? this.requestedReviewers.toString() : '',
        short: true
      }
    ],
    fallback: '*' + this.title + '* '
      + '*\nStatus: ' + (this.status ? this.status : '')
      + '\nAuthor: ' + this.author
      + '\nAssignee: ' + (this.assignees ? '' + JSON.stringify(this.assignees) :
        '<@' + this.assignee + '>')
  };
};

exports.CommentObject = CommentObject;
