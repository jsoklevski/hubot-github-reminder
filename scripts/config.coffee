class Config
  @debug: process.env.HUBOT_GITHUB_DEBUG

  @github:
    url: process.env.HUBOT_GITHUB_URL or "https://api.github.com"
    token: process.env.HUBOT_GITHUB_TOKEN
    organization: process.env.HUBOT_GITHUB_ORG
    webhook: secret: process.env.HUBOT_GITHUB_WEBHOOK_SECRET

module.exports = Config

