moment = require "moment"
Octokat = require "octokat"

Config = require "../config"
Utils = require "../utils"

octo = new Octokat token: Config.github.token

class PullRequest
  @fromUrl: (url) ->
    octo.fromUrl(url).fetch()
    .then (pr) ->
      new PullRequest pr

  constructor: (json, @assignee) ->
    @[k] = v for k,v of json when k isnt "assignees"

  toAttachment: ->
    color: "#ff9933"
    author_name: @user.login
    title: @title
    title_link: url
    fields: [
      title: "Updated"
      value: moment(@updatedAt).fromNow()
      short: yes
    ,
      title: "Status"
      value: if @mergeable then "Mergeable" else "Unresolved Conflicts"
      short: yes
    ,
      title: "Assignees"
      value: if @assignee then "<@#{@assignee}>" else "Unassigned"
      short: yes
    ,
      title: "Lines"
      value: "+#{@additions} -#{@deletions}"
      short: yes
    ]
    fallback: """
      *#{@title}* +#{@additions} -#{@deletions}
      Updated: *#{moment(@updatedAt).fromNow()}*
      Status: #{if @mergeable then "Mergeable" else "Unresolved Conflicts"}
      Author: #{@user.login}
      Assignee: #{if @assignee then "#{@assignee.name}" else "Unassigned"}
    """

module.exports = PullRequest
