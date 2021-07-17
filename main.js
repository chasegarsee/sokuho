require('dotenv').config()
const Twit = require('twit')
const Discord = require('discord.js');
const client = new Discord.Client();

var twitterAccountIds = [3017838067, 3241126108, 381696140, 2704294333]

var T = new Twit({
  consumer_key:         process.env.TWITTER_CONSUMER_KEY,
  consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
  access_token:         process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET,
  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
  strictSSL:            true,     // optional - requires SSL certificates to be valid.
})

client.login(process.env.DISCORD_TOKEN);
client.once('ready', () => {
  var stream = T.stream('statuses/filter', { follow: twitterAccountIds })

  stream.on('tweet', function (tweet) {
    //only show owner tweets
    if(twitterAccountIds.includes(tweet.user.id)) {
    var url = "https://twitter.com/" + tweet.user.screen_name + "/status/" + tweet.id_str;
    try {
        let channel = client.channels.fetch(process.env.DISCORD_CHANNEL_ID).then(channel => {
          channel.send(url)
        }).catch(err => {
          console.log(err)
        })
    } catch (error) {
            console.error(error);
      }
    }
  })
})
