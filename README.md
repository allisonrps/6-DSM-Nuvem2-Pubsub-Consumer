# PubSub Consumer

Este projeto é um consumidor de mensagens Pub/Sub para gerenciar reservas.

## Estrutura do Projeto

- `index.js`: Ponto de entrada da aplicação.
- `config/db.js`: Configuração de conexão com o banco de dados.
- `routes/reserveRoutes.js`: Rotas relacionadas a reservas.
- `services/pubsubConsumer.js`: Serviço responsável por consumir mensagens do Pub/Sub.
- `services/reservationService.js`: Lógica de negócio para reservas.
- `migrations.sql`: Script de migração do banco de dados.
- `dbdiagram.png`: Diagrama do banco de dados.

## Instalação

1. Clone o repositório:
   ```sh
   git clone <url-do-repositorio>
   ```
2. Instale as dependências:
   ```sh
   npm install
   ```

## Uso

1. Configure o banco de dados em `config/db.js`.
2. Execute as migrações usando o arquivo `migrations.sql`.
3. Inicie a aplicação:
   ```sh
   node index.js
   ```

## Funcionalidades

- Consome mensagens de um tópico Pub/Sub.
- Processa e gerencia reservas no banco de dados.
- API para criação e consulta de reservas.

## Requisitos

- Node.js
- Banco de dados compatível (ex: PostgreSQL, MySQL)

## Desenvolvedores

- Allison Rodrigues de Paula e Silva
- Paula Cristina Abib Teixeira
- Samir Lopes Rosa


