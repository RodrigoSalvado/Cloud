const { CosmosClient } = require('@azure/cosmos');

const COSMOS_DB_ENDPOINT = process.env.COSMOS_DB_ENDPOINT;
const COSMOS_DB_KEY = process.env.COSMOS_DB_KEY;
const COSMOS_DB_DATABASE = process.env.COSMOS_DB_DATABASE;
const COSMOS_DB_CONTAINER = process.env.COSMOS_DB_CONTAINER;

module.exports = async function (context, myQueueItem) {
    context.log('Função Trigger da Queue foi chamada.');

    const post = JSON.parse(myQueueItem); // Mensagem da fila

    try {
        const cosmosClient = new CosmosClient({ endpoint: COSMOS_DB_ENDPOINT, key: COSMOS_DB_KEY });
        const database = cosmosClient.database(COSMOS_DB_DATABASE);
        const container = database.container(COSMOS_DB_CONTAINER);

        // Inserir ou atualizar o post
        await container.items.upsert(post);

        context.log(`Post ${post.id} guardado com sucesso!`);
    } catch (error) {
        context.log.error('Erro ao guardar no Cosmos DB:', error);
    }
};
