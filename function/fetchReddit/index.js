// fetchReddit/index.js
// HTTP trigger: fetches posts from Reddit and enqueues them for Cosmos DB processing.
// function.json must define an HTTP trigger plus a queue output binding named "outputQueueItem".

const axios = require('axios');
const qs = require('qs');

module.exports = async function (context, req) {
  context.log('FetchReddit HTTP trigger - Request received', {
    method: req.method,
    query: req.query,
    body: req.body
  });

  try {
    const subreddit = req.query.subreddit || (req.body && req.body.subreddit);
    const sort = req.query.sort || (req.body && req.body.sort) || 'hot';
    const num = parseInt(req.query.num || (req.body && req.body.num) || '5', 10);

    if (!subreddit) {
      context.log.error('Validation error: subreddit not provided');
      context.res = {
        status: 400,
        body: 'Please pass a subreddit name in the query string or in the request body'
      };
      return;
    }

    // Obtain Reddit OAuth token
    const tokenRes = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      qs.stringify({ grant_type: 'password', username: process.env.REDDIT_USERNAME, password: process.env.REDDIT_PASSWORD }),
      {
        auth: { username: process.env.REDDIT_CLIENT_ID, password: process.env.REDDIT_SECRET },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    const accessToken = tokenRes.data.access_token;

    // Fetch posts
    const redditRes = await axios.get(
      `https://oauth.reddit.com/r/${subreddit}/${sort}`,
      { params: { limit: num }, headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const posts = redditRes.data.data.children.map(c => ({
      id: c.data.id,
      subreddit: c.data.subreddit,
      title: c.data.title,
      author: c.data.author,
      created_utc: c.data.created_utc,
      url: c.data.url,
      selftext: c.data.selftext
    }));

    // Enqueue each post
    let count = 0;
    for (const post of posts) {
      context.bindings.outputQueueItem = post;
      context.log(`Enqueued post: ${post.id}`);
      count++;
    }

    context.res = {
      status: 200,
      body: `Enqueued ${count} posts for Cosmos DB upsert.`
    };
  } catch (err) {
    context.log.error('Error in FetchReddit function:', err);
    context.res = {
      status: 500,
      body: 'Failed to fetch or enqueue posts.'
    };
  }
};