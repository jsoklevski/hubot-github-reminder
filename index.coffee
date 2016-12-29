fs = require 'fs'
path = require 'path'

module.exports = (robot, scripts) ->
  scriptsPath = path.resolve(__dirname, 'scripts')
  fs.exists scriptsPath, (exists) ->
    robot.loadFile(scriptsPath, 'index.coffee') if exists

