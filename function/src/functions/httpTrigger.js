const { app } = require('@azure/functions');
const axios = require('axios');
const qs = require('qs');

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const SECRET = process.env.REDDIT_SECRET;
const USERNAME = process.env.REDDIT_USERNAME;

app.http('httpTrigger', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('A função HTTP foi chamada.');

        const subreddit = request.query.get('subreddit');
        const sortType = request.query.get('sort') || 'new';  // Pode ser 'new', 'hot', 'top', etc.
        const num = parseInt(request.query.get('num')) || 100;  // Número de posts, com valor padrão de 100

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

            // Formatar os posts como uma string para resposta
            const result = posts
                .map(p => {
                    return `Subreddit: ${p.data.subreddit}\nTitle: ${p.data.title}\nText: ${p.data.selftext}\nUpvote Ratio: ${p.data.upvote_ratio}\nUps: ${p.data.ups}\nScore: ${p.data.score}\n\n`;
                });

            if (result.length === 0) {
                return {
                    status: 404,
                    body: "Nenhum post encontrado."
                };
            }

            // Juntar os posts numa única string
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