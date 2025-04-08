const { app } = require('@azure/functions');
const axios = require('axios');
const qs = require('qs');
const { CosmosClient } = require('@azure/cosmos');

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const SECRET = process.env.REDDIT_SECRET;
const USERNAME = process.env.REDDIT_USERNAME;

const COSMOS_DB_ENDPOINT = process.env.COSMOS_DB_ENDPOINT;
const COSMOS_DB_KEY = process.env.COSMOS_DB_KEY;
const COSMOS_DB_DATABASE = process.env.COSMOS_DB_DATABASE;
const COSMOS_DB_CONTAINER = process.env.COSMOS_DB_CONTAINER;

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

            context.log("A obter token de acesso...");

            const tokenResponse = await axios.post(
                'https://www.reddit.com/api/v1/access_token',
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
            context.log("Token obtido com sucesso.");

            context.log(`A buscar posts de r/${subreddit} (${sortType})...`);

            const redditRes = await axios.get(
                `https://oauth.reddit.com/r/${subreddit}/${sortType}`,
                {
                    headers: {
                        'Authorization': `bearer ${token}`,
                        'User-Agent': 'MyAPI/0.0.1'
                    },
                    params: { limit: num }
                }
            );

            const posts = redditRes.data.data.children;

            if (!posts || posts.length === 0) {
                return {
                    status: 404,
                    body: "Nenhum post encontrado."
                };
            }

            context.log(`Recebidos ${posts.length} posts. A guardar na base de dados...`);

            const cosmosClient = new CosmosClient({ endpoint: COSMOS_DB_ENDPOINT, key: COSMOS_DB_KEY });
            const database = cosmosClient.database(COSMOS_DB_DATABASE);
            const container = database.container(COSMOS_DB_CONTAINER);

            const upsertPromises = posts.map(post => {
                const doc = {
                    id: post.data.id,
                    title: post.data.title,
                    text: post.data.selftext,
                    subreddit: post.data.subreddit,
                    upvote_ratio: post.data.upvote_ratio,
                    ups: post.data.ups,
                    score: post.data.score,
                    created_utc: post.data.created_utc
                };
                return container.items.upsert(doc).catch(err => {
                    context.log.error(`Erro ao guardar o post ${doc.id}: ${err.message}`);
                });
            });

            await Promise.all(upsertPromises);

            context.log("Todos os posts foram guardados com sucesso.");

            const resposta = posts.map(p => {
                return `Subreddit: ${p.data.subreddit}\nTítulo: ${p.data.title}\nTexto: ${p.data.selftext}\nUpvote Ratio: ${p.data.upvote_ratio}\nUps: ${p.data.ups}\nScore: ${p.data.score}\n`;
            });

            return {
                status: 200,
                headers: { "Content-Type": "text/plain" },
                body: resposta.join('\n')
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
