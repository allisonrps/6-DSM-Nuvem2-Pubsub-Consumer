const pool = require('../config/db');

// upserts
async function upsertCliente(tx, external_id, name, email, document) {
  const q = `
    INSERT INTO cliente (external_id, name, email, document)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (external_id) DO UPDATE
      SET name = EXCLUDED.name, email = EXCLUDED.email, document = EXCLUDED.document
    RETURNING id;`;
  const res = await tx.query(q, [external_id, name, email, document]);
  return res.rows[0].id;
}

async function upsertHotel(tx, external_id, name, city, state) {
  const q = `
    INSERT INTO hotel (external_id, name, city, state)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (external_id) DO UPDATE
      SET name = EXCLUDED.name, city = EXCLUDED.city, state = EXCLUDED.state
    RETURNING id;`;
  const res = await tx.query(q, [external_id, name, city, state]);
  return res.rows[0].id;
}

async function persistReservation(payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customer = payload.customer || {};
    const hotel = payload.hotel || {};

    const customerId = customer.id
      ? await upsertCliente(client, customer.id, customer.name, customer.email, customer.document)
      : null;

    const hotelId = hotel.id
      ? await upsertHotel(client, hotel.id, hotel.name, hotel.city, hotel.state)
      : null;

    const insertReservaText = `
      INSERT INTO reserva (uuid, type, customer_id, hotel_id, status, guests, breakfast_included, payment, metadata, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (uuid) DO NOTHING
      RETURNING id;`;
    const createdAt = payload.created_at ? payload.created_at : null;
    const insertRes = await client.query(insertReservaText, [
      payload.uuid, payload.type, customerId, hotelId,
      payload.status, payload.guests, payload.breakfast_included,
      payload.payment || null, payload.metadata || null, createdAt,
    ]);

    let reservaId;
    if (insertRes.rows.length > 0) {
      reservaId = insertRes.rows[0].id;
    } else {
      const sel = await client.query('SELECT id FROM reserva WHERE uuid = $1', [payload.uuid]);
      reservaId = sel.rows[0].id;
    }

    const rooms = payload.rooms || [];
    for (const r of rooms) {
      const daily = Number(r.daily_rate) || 0;
      const days = Number(r.number_of_days) || 0;
      const total = Number((daily * days).toFixed(2));
      await client.query(
        `INSERT INTO quarto_reservado
          (reserva_id, external_room_id, room_number, daily_rate, number_of_days, checkin_date, checkout_date, category, total_value)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [reservaId, r.id || null, r.room_number || null, daily, days,
         r.checkin_date || null, r.checkout_date || null, r.category || null, total]
      );
    }

    const sumRes = await client.query(
      'SELECT COALESCE(SUM(total_value),0)::numeric(12,2) AS total FROM quarto_reservado WHERE reserva_id = $1',
      [reservaId]
    );
    const totalValue = sumRes.rows[0].total || 0;
    await client.query('UPDATE reserva SET total_value = $1 WHERE id = $2', [totalValue, reservaId]);

    await client.query('COMMIT');
    return reservaId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { persistReservation };
