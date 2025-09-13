// index.js
require('dotenv').config();
const express = require('express');
const { startConsumer } = require('./services/pubsubConsumer');
const reserveRoutes = require('./routes/reserveRoutes');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use('/', reserveRoutes);

app.get('/', (_req, res) => res.send('Consumidor Pub/Sub rodando 🚀'));

app.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
  startConsumer();
});
