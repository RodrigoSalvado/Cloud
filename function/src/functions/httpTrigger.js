const axios = require('axios');
const qs = require('qs');
const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
    // Log incoming request for debugging
    context.log('HTTP trigger function processed a request', {
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

        // Get Reddit OAuth token
        const tokenRes = await axios.post(
            'https://www.reddit.com/api/v1/access_token',
            qs.stringify({
                grant_type: 'password',
                username: process.env.REDDIT_USERNAME,
                password: process.env.REDDIT_PASSWORD
            }),
            {
                auth: {
                    username: process.env.REDDIT_CLIENT_ID,
                    password: process.env.REDDIT_SECRET
                },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        const accessToken = tokenRes.data.access_token;

        // Fetch posts
        const redditRes = await axios.get(
            `https://oauth.reddit.com/r/${subreddit}/${sort}`,
            {
                params: { limit: num },
                headers: { Authorization: `Bearer ${accessToken}` }
            }
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

        // Initialize Cosmos DB client with logging of env variables
        const cosmosEndpoint = process.env.COSMOS_DB_ENDPOINT;
        const cosmosKey = process.env.COSMOS_DB_KEY;
        const databaseId = process.env.COSMOS_DB_DATABASE;
        const containerId = process.env.COSMOS_DB_CONTAINER;

        context.log('Cosmos DB configuration', {
            endpoint: cosmosEndpoint,
            keyPresent: !!cosmosKey,
            databaseId,
            containerId
        });

        // Check for missing Cosmos DB environment variables
        const missingEnv = [];
        if (!cosmosEndpoint) missingEnv.push('COSMOS_DB_ENDPOINT');
        if (!cosmosKey) missingEnv.push('COSMOS_DB_KEY');
        if (!databaseId) missingEnv.push('COSMOS_DB_DATABASE');
        if (!containerId) missingEnv.push('COSMOS_DB_CONTAINER');
        if (missingEnv.length) {
            context.log.error('Missing Cosmos DB configuration:', missingEnv.join(', '));
            context.res = {
                status: 500,
                body: `Missing Cosmos DB config: ${missingEnv.join(', ')}`
            };
            return;
        }

        const client = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
        const container = client.database(databaseId).container(containerId);

        // Upsert each post into Cosmos DB
        const inserted = [];
        for (const post of posts) {
            try {
                const { resource } = await container.items.upsert(post);
                inserted.push(resource.id);
            } catch (dbErr) {
                context.log.error(`Error writing to Cosmos DB for post ${post.id}:`, dbErr);
            }
        }

        context.res = {
            status: 200,
            body: {
                message: `Successfully upserted ${inserted.length} posts`,
                posts: posts
            }
        };
    } catch (error) {
        context.log.error('Error in httpTrigger function:', error);
        context.res = {
            status: 500,
            body: 'An error occurred while processing your request.'
        };
    }
};
