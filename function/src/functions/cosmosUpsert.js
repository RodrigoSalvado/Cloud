// cosmosUpsert/index.js
// Queue trigger: reads posts from the queue and upserts them into Cosmos DB.

const { CosmosClient } = require('@azure/cosmos');


// Initialize Cosmos client once at module load
const client = new CosmosClient({
  endpoint: process.env.COSMOS_DB_ENDPOINT,
  key: process.env.COSMOS_DB_KEY
});
const databaseId = process.env.COSMOS_DB_DATABASE_ID;
const containerId = process.env.COSMOS_DB_CONTAINER_ID;
const container = client.database(databaseId).container(containerId);

module.exports = async function (context, myQueueItem) {
  context.log('CosmosUpsert Queue trigger - Item received', myQueueItem);

  try {
    const { resource } = await container.items.upsert(myQueueItem);
    context.log(`Upserted post with id ${resource.id}`);
  } catch (dbErr) {
    context.log.error('Error upserting to Cosmos DB:', dbErr);
    // Rethrow to have Azure Functions retry delivery
    throw dbErr;
  }
};