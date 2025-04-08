const { app } = require('@azure/functions');

app.storageQueue('storageQueueTrigger', {
    queueName: 'js-queue-items',
    connection: 'queuestoragecloud_STORAGE',
    handler: (queueItem, context) => {
        context.log('Storage queue function processed work item:', queueItem);
    }
});
