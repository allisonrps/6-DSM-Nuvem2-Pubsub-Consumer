require('dotenv').config();
const express = require('express');
const { PubSub } = require('@google-cloud/pubsub');

const PORT = process.env.PORT || 3000;
const projectId = process.env.PROJECT_ID;
const subscriptionId = process.env.SUBSCRIPTION_ID;

const app = express();
const pubsub = new PubSub({ projectId });

// Home
app.get('/', (_req, res) => {
  res.send('Consumidor Pub/Sub rodando 🚀');
});

// Função para começar a ouvir mensagens
async function startPull() {
  const subscription = pubsub.subscription(subscriptionId);

  const messageHandler = (message) => {
    const raw = message.data.toString();
    let pretty = raw;
    try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch (_) {}

    console.log(`\n--- Mensagem recebida ---`);
    console.log(`ID: ${message.id}`);
    console.log(pretty);
    console.log(`-------------------------\n`);

    // Confirma processamento
    message.ack();
  };

  subscription.on('message', messageHandler);
  subscription.on('error', (err) => console.error('Erro no subscriber:', err));

  console.log(`Escutando assinatura "${subscriptionId}" no projeto "${projectId}"...`);
}

app.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
  startPull();
});
