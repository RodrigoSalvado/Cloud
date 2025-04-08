const { app } = require('@azure/functions');
const axios = require('axios');
const qs = require('qs');
const { CosmosClient } = require("@azure/cosmos");

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const SECRET = process.env.REDDIT_SECRET;
const USERNAME = process.env.REDDIT_USERNAME;
const COSMOS_DB_ENDPOINT = process.env.COSMOS_DB_ENDPOINT;
const COSMOS_DB_KEY = process.env.COSMOS_DB_KEY;
const COSMOS_DB_DATABASE = process.env.COSMOS_DB_DATABASE;
const COSMOS_DB_CONTAINER = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({
    endpoint: COSMOS_DB_ENDPOINT,
    key: COSMOS_DB_KEY
});

app.http('httpTrigger', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('A função HTTP foi chamada.');

        const subreddit = request.query.get('subreddit');
        const sortType = request.query.get('sort') || 'new';
        const num = parseInt(request.query.get('num')) || 100;

        if (!subreddit) {
            return {
                status: 400,
                body: "Parâmetro 'subreddit' é obrigatório."
            };
        }

        try {
            const password = process.env.REDDIT_PASSWORD;

            if (!password) {
                throw new Error("A variável de ambiente REDDIT_PASSWORD não está definida.");
            }

            // Autenticação no Reddit
            const tokenResponse = await axios.post('https://www.reddit.com/api/v1/access_token',
                qs.stringify({
                    grant_type: 'password',
                    username: USERNAME,
                    password: password
                }),
                {
                    auth: {
                        username: CLIENT_ID,
                        password: SECRET
                    },
                    headers: {
                        'User-Agent': 'MyAPI/0.0.1',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const token = tokenResponse.data.access_token;

            // Obter os posts
            const redditRes = await axios.get(`https://oauth.reddit.com/r/${subreddit}/${sortType}`, {
                headers: {
                    'Authorization': `bearer ${token}`,
                    'User-Agent': 'MyAPI/0.0.1'
                },
                params: { limit: num }
            });

            const posts = redditRes.data.data.children;

            // Guardar na Cosmos DB
            const container = cosmosClient.database(COSMOS_DB_DATABASE).container(COSMOS_DB_CONTAINER);

            for (const post of posts) {
                const postData = {
                    id: post.data.id,  // Importante: o 'id' é obrigatório na Cosmos DB
                    subreddit: post.data.subreddit,
                    title: post.data.title,
                    selftext: post.data.selftext,
                    upvote_ratio: post.data.upvote_ratio,
                    ups: post.data.ups,
                    score: post.data.score,
                    created_utc: post.data.created_utc
                };

                await container.items.upsert(postData);
            }

            // Preparar resposta
            const result = posts.map(p => {
                return `Subreddit: ${p.data.subreddit}\nTítulo: ${p.data.title}\nTexto: ${p.data.selftext}\nUpvote Ratio: ${p.data.upvote_ratio}\nUps: ${p.data.ups}\nScore: ${p.data.score}\n\n`;
            });

            if (result.length === 0) {
                return {
                    status: 404,
                    body: "Nenhum post encontrado."
                };
            }

            const responseBody = result.join('\n');

            return {
                status: 200,
                headers: { "Content-Type": "text/plain" },
                body: responseBody
            };

        } catch (error) {
            context.log.error('Erro:', error);
            return {
                status: 500,
                body: `Erro interno: ${error.message}`
            };
        }
    }
});
