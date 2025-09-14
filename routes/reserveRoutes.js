
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// rota GET pra listar reservas
router.get('/reserves', async (req, res) => {
  const { uuid, customer_id, room_id, hotel_id } = req.query;
  try {
    const where = ['1=1']; // condição base
    const params = []; // valores pros filtros

    if (uuid) { params.push(uuid); where.push(`r.uuid = $${params.length}`); }
    if (customer_id) { params.push(customer_id); where.push(`c.external_id = $${params.length}`); }
    if (hotel_id) { params.push(hotel_id); where.push(`h.external_id = $${params.length}`); }
    if (room_id) { // subquery se filtrar quarto
      params.push(room_id);
      where.push(`EXISTS (SELECT 1 FROM quarto_reservado q WHERE q.reserva_id = r.id AND q.external_room_id = $${params.length})`);
    }

    // query principal com join em cliente e hotel
    const q = `
      SELECT r.id, r.uuid, r.type, r.created_at, r.status, r.guests, r.breakfast_included,
             r.payment, r.metadata, r.total_value,
             c.external_id as customer_external_id, c.name as customer_name, c.email as customer_email, c.document as customer_document,
             h.external_id as hotel_external_id, h.name as hotel_name, h.city as hotel_city, h.state as hotel_state
      FROM reserva r
      LEFT JOIN cliente c ON r.customer_id = c.id
      LEFT JOIN hotel h ON r.hotel_id = h.id
      WHERE ${where.join(' AND ')}
      ORDER BY r.created_at DESC
      LIMIT 100;`;
    const result = await pool.query(q, params);

    const response = [];

    // monta resposta com reserva + quartos
    for (const row of result.rows) {
      const roomsRes = await pool.query(
        `SELECT external_room_id as id, room_number, daily_rate, number_of_days, checkin_date, checkout_date, category, total_value
         FROM quarto_reservado WHERE reserva_id = $1`,
        [row.id]
      );
      response.push({
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
          state: row.hotel_state
        },
        rooms: roomsRes.rows.map(r => ({
          id: r.id,
          room_number: r.room_number,
          daily_rate: Number(r.daily_rate),
          number_of_days: r.number_of_days,
          checkin_date: r.checkin_date,
          checkout_date: r.checkout_date,
          category: r.category,
          total_value: Number(r.total_value)
        })),
        status: row.status,
        guests: row.guests,
        breakfast_included: row.breakfast_included,
        payment: row.payment,
        metadata: row.metadata,
        computed_total: Number(row.total_value || 0)
      });
    }
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
