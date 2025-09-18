const express = require('express');
const pool = require('../config/db');

const router = express.Router();

/**
 * Função auxiliar para montar o objeto de resposta
 */
async function buildReservaResponse(rows) {
  const reservasMap = new Map();

  for (const row of rows) {
    if (!reservasMap.has(row.reserva_id)) {
      reservasMap.set(row.reserva_id, {
        uuid: row.uuid,
        created_at: row.created_at,
        type: row.type,
        customer: {
          id: row.customer_external_id,
          name: row.customer_name,
          email: row.customer_email,
          document: row.customer_document,
        },
        hotel: {
          id: row.hotel_external_id,
          name: row.hotel_name,
          city: row.hotel_city,
          state: row.hotel_state,
        },
        rooms: [],
        status: row.status,
        guests: row.guests,
        breakfast_included: row.breakfast_included,
        payment: row.payment,
        metadata: row.metadata,
        computed_total: Number(row.total_value || 0),
      });
    }

    if (row.room_id) {
      reservasMap.get(row.reserva_id).rooms.push({
        id: row.room_id,
        room_number: row.room_number,
        daily_rate: Number(row.daily_rate),
        number_of_days: row.number_of_days,
        checkin_date: row.checkin_date,
        checkout_date: row.checkout_date,
        category: row.category,
        total_value: Number(row.room_total_value),
      });
    }
  }

  return [...reservasMap.values()];
}

/**
 * Consulta base de reservas (com joins e rooms)
 */
async function queryReservas(where, params) {
  const q = `
    SELECT 
      r.id as reserva_id, r.uuid, r.type, r.created_at, r.status, r.guests,
      r.breakfast_included, r.payment, r.metadata, r.total_value,
      c.external_id as customer_external_id, c.name as customer_name,
      c.email as customer_email, c.document as customer_document,
      h.external_id as hotel_external_id, h.name as hotel_name,
      h.city as hotel_city, h.state as hotel_state,
      qr.external_room_id as room_id, qr.room_number, qr.daily_rate,
      qr.number_of_days, qr.checkin_date, qr.checkout_date,
      qr.category, qr.total_value as room_total_value
    FROM reserva r
    LEFT JOIN cliente c ON r.customer_id = c.id
    LEFT JOIN hotel h ON r.hotel_id = h.id
    LEFT JOIN quarto_reservado qr ON qr.reserva_id = r.id
    WHERE ${where.join(' AND ')}
    ORDER BY r.created_at DESC
    LIMIT 100;
  `;
  const result = await pool.query(q, params);
  return buildReservaResponse(result.rows);
}

/* ---------------------- ROTAS ---------------------- */

/**
 * 🔹 POST /reserves
 * Cria uma nova reserva com cliente, hotel e quartos
 */
router.post('/reserves', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      uuid,
      type,
      status,
      guests,
      breakfast_included,
      payment,
      metadata,
      created_at,
      total_value,
      customer,
      hotel,
      rooms
    } = req.body;

    // Inserir ou atualizar cliente
    const customerRes = await client.query(
      `INSERT INTO cliente (external_id, name, email, document)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (external_id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         document = EXCLUDED.document
       RETURNING id`,
      [customer.external_id, customer.name, customer.email, customer.document]
    );
    const customer_id = customerRes.rows[0].id;

    // Inserir ou atualizar hotel
    const hotelRes = await client.query(
      `INSERT INTO hotel (external_id, name, city, state)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (external_id) DO UPDATE SET
         name = EXCLUDED.name,
         city = EXCLUDED.city,
         state = EXCLUDED.state
       RETURNING id`,
      [hotel.external_id, hotel.name, hotel.city, hotel.state]
    );
    const hotel_id = hotelRes.rows[0].id;

    // Inserir reserva
    const reservaRes = await client.query(
      `INSERT INTO reserva (uuid, type, customer_id, hotel_id, status, guests, breakfast_included, payment, metadata, created_at, total_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [uuid, type, customer_id, hotel_id, status, guests, breakfast_included, payment, metadata, created_at, total_value]
    );
    const reserva_id = reservaRes.rows[0].id;

    // Inserir quartos reservados
    for (const room of rooms) {
      await client.query(
        `INSERT INTO quarto_reservado
          (reserva_id, external_room_id, room_number, daily_rate, number_of_days, checkin_date, checkout_date, category, total_value)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [reserva_id, room.external_room_id, room.room_number, room.daily_rate,
          room.number_of_days, room.checkin_date, room.checkout_date, room.category, room.total_value]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Reserva criada com sucesso', uuid });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar reserva' });
  } finally {
    client.release();
  }
});

/* ---------------------- GETs ---------------------- */

// 🔹 1. Todas as reservas
router.get('/reserves', async (req, res) => {
  try {
    const reservas = await queryReservas(['1=1'], []);
    res.json(reservas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 🔹 2. Reserva por UUID
router.get('/reserves/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const reservas = await queryReservas(['r.uuid = $1'], [uuid]);
    if (reservas.length === 0) return res.status(404).json({ error: 'Reserva não encontrada' });
    res.json(reservas[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 🔹 3. Reservas por cliente
router.get('/customers/:id/reserves', async (req, res) => {
  try {
    const { id } = req.params;
    const reservas = await queryReservas(['c.external_id = $1'], [id]);
    res.json(reservas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 🔹 4. Reservas por hotel
router.get('/hotels/:id/reserves', async (req, res) => {
  try {
    const { id } = req.params;
    const reservas = await queryReservas(['h.external_id = $1'], [id]);
    res.json(reservas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 🔹 5. Reservas por quarto
router.get('/rooms/:id/reserves', async (req, res) => {
  try {
    const { id } = req.params;
    const reservas = await queryReservas(['qr.external_room_id = $1'], [id]);
    res.json(reservas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
