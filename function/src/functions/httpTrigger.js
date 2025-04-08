const { app } = require('@azure/functions');
const axios = require('axios');
const qs = require('qs');
const { CosmosClient } = require('@azure/cosmos');

const CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'bzG6zHjC23GSenSIXe0M-Q';
const SECRET = process.env.REDDIT_SECRET || 'DoywW0Lcc26rvDforDKkLOSQsUUwYA';
const USERNAME = process.env.REDDIT_USERNAME || 'Major-Noise-6411';

const COSMOS_DB_URI = process.env.COSMOS_DB_URI;  // URI do Cosmos DB
const COSMOS_DB_KEY = process.env.COSMOS_DB_KEY;  // Chave de acesso ao Cosmos DB
const COSMOS_DB_DATABASE = process.env.COSMOS_DB_DATABASE || 'RedditData';  // Nome da base de dados
const COSMOS_DB_CONTAINER = process.env.COSMOS_DB_CONTAINER || 'Posts';  // Nome do container

const cosmosClient = new CosmosClient({ endpoint: COSMOS_DB_URI, key: COSMOS_DB_KEY });
const container = cosmosClient.database(COSMOS_DB_DATABASE).container(COSMOS_DB_CONTAINER);

app.http('httpTrigger', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('A função HTTP foi chamada.');

        const subreddit = request.query.get('subreddit');
        const sortType = request.query.get('sort') || 'new';  // Pode ser 'new', 'hot', 'top', etc.
        const num = parseInt(request.query.get('num')) || 50;  // Número de posts, com valor padrão de 50

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

            // Alterar tipo de pesquisa (pode ser 'new', 'hot', 'top', etc.)
            const redditRes = await axios.get(`https://oauth.reddit.com/r/${subreddit}/${sortType}`, {
                headers: {
                    'Authorization': `bearer ${token}`,
                    'User-Agent': 'MyAPI/0.0.1'
                },
                params: { limit: num }  // Definir o limite com o valor de num
            });

            const posts = redditRes.data.data.children;

            // Formatar os posts como objetos para inserção no Cosmos DB
            const result = posts.map(p => {
                return {
                    id: p.data.id,  // Usar o 'id' único do post
                    subreddit: p.data.subreddit,
                    title: p.data.title,
                    text: p.data.selftext,
                    upvote_ratio: p.data.upvote_ratio,
                    ups: p.data.ups,
                    score: p.data.score,
                    created_at: new Date(p.data.created_utc * 1000).toISOString()  // Converter para formato de data ISO
                };
            });

            if (result.length === 0) {
                return {
                    status: 404,
                    body: "Nenhum post encontrado."
                };
            }

            // Inserir os dados na Cosmos DB
            const batchWrite = result.map(post => container.items.upsert(post));  // Usando upsert para adicionar ou atualizar documentos
            await Promise.all(batchWrite);  // Aguardar a conclusão da inserção

            // Juntar os posts numa única string para resposta
            const responseBody = result.map(p => {
                return `Subreddit: ${p.subreddit}\nTítulo: ${p.title}\nTexto: ${p.text}\nUpvote Ratio: ${p.upvote_ratio}\nUps: ${p.ups}\nScore: ${p.score}\n\n`;
            }).join('\n');

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