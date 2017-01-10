_ = require "underscore"
Fuse = require "fuse.js"

class Utils
  @robot: null
  brain_users_key = 'githubUserIdsByHubotUsername'

  @saveGithubUser: (hubot_user, github_user) ->
    user_ids_by_username = Utils.robot.brain.get(brain_users_key)
    if !user_ids_by_username
      user_ids_by_username = {}
    user_ids_by_username[hubot_user] = github_user
    Utils.robot.brain.set brain_users_key, user_ids_by_username
    return


  @getUsers: ->
    Utils.robot.adapter?.client?.rtm?.dataStore?.users or Utils.robot.brain.users()

  @findUser: (username) ->
    users = Utils.getUsers()
    users = _(users).keys().map (id) ->
      u = users[id]
      id: u.id
      name: u.name
      real_name: u.real_name

    f = new Fuse users,
      keys: ['name']
      shouldSort: yes
      verbose: no
      threshold: 0.55

    results = f.search username
    if results? and results.length >=1 then return results[0] else return undefined


  @lookupUserWithHubot: (hubot_username) ->
    user_ids_by_username = Utils.robot.brain.get(brain_users_key)
    if !user_ids_by_username
      return undefined

    user_ids_by_username[hubot_username]

  @lookupUserWithGithub: (github_username) ->
    user_ids_by_username = Utils.robot.brain.get(brain_users_key)
    if !user_ids_by_username
      return undefined
    hubotUser = _.findKey user_ids_by_username, (github) ->
      github == github_username
    if hubotUser
      return Utils.findUser(hubotUser)
    else
      return Utils.findUser(github_username)

module.exports = Utils
