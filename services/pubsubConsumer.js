const { PubSub } = require('@google-cloud/pubsub');
const { persistReservation } = require('./reservationService');

const projectId = process.env.PROJECT_ID;
const subscriptionId = process.env.SUBSCRIPTION_ID;
const pubsub = new PubSub({ projectId });

async function startConsumer() {
  const subscription = pubsub.subscription(subscriptionId);
  const messageHandler = async (message) => {
    const raw = message.data.toString();
    try {
      const payload = JSON.parse(raw);
      await persistReservation(payload);
      console.log('Persistido com sucesso', payload.uuid);
      message.ack();
    } catch (err) {
      console.error('Erro ao processar mensagem', err);
      try { message.nack(); } catch (_) {}
    }
  };
  subscription.on('message', messageHandler);
  subscription.on('error', (err) => console.error('Erro no subscriber:', err));
  console.log(`Consumidor Pub/Sub escutando assinatura "${subscriptionId}"...`);
}

module.exports = { startConsumer };