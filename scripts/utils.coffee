_ = require "underscore"

class Utils
  @robot: null
  brain_users_key = 'githubUserIdsByHubotUsername'

  @findRoom: (msg) ->
    room = msg.envelope.room
    if _.isUndefined(room)
      room = msg.envelope.user.reply_to
    room

  @saveGithubUser: (hubot_user, github_user) ->
    user_ids_by_username = Utils.robot.brain.get(brain_users_key)
    if !user_ids_by_username
      user_ids_by_username = {}
    user_ids_by_username[hubot_user] = github_user
    Utils.robot.brain.set brain_users_key, user_ids_by_username
    return


  @lookupUserWithHubot: (hubot_username) ->
    user_ids_by_username = Utils.robot.brain.get(brain_users_key)
    if !user_ids_by_username
      return undefined
    user_ids_by_username[hubot_username]


  @lookupUserWithGithub: (github_username) ->
    user_ids_by_username = Utils.robot.brain.get(brain_users_key)
    if !user_ids_by_username
      return undefined
    _.findKey user_ids_by_username, (github) ->
      github == github_username

module.exports = Utils
