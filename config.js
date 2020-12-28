const keys = require("./keys.json")

module.exports = {
  oauth2Credentials:{
    token_uri:keys.web.token_uri,
    scopes:[
      "https://www.googleapis.com/auth/youtube.readonly"
    ]
  }
}
