CREATE TABLE IF NOT EXISTS cliente (
  id SERIAL PRIMARY KEY,
  external_id BIGINT UNIQUE,  -- id vindo no payload.customer.id
  name TEXT,
  email TEXT,
  document TEXT,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel (
  id SERIAL PRIMARY KEY,
  external_id BIGINT UNIQUE,  -- payload.hotel.id
  name TEXT,
  city TEXT,
  state TEXT,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reserva (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL,
  type TEXT,
  customer_id INTEGER REFERENCES cliente(id) ON DELETE SET NULL,
  hotel_id INTEGER REFERENCES hotel(id) ON DELETE SET NULL,
  status TEXT,
  guests INTEGER,
  breakfast_included BOOLEAN,
  payment JSONB,
  metadata JSONB,
  created_at timestamptz,
  ingested_at timestamptz DEFAULT now(),
  total_value NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quarto_reservado (
  id SERIAL PRIMARY KEY,
  reserva_id INTEGER REFERENCES reserva(id) ON DELETE CASCADE,
  external_room_id INTEGER, -- payload.rooms[].id (id do sistema de origem)
  room_number TEXT,
  daily_rate NUMERIC(12,2),
  number_of_days INTEGER,
  checkin_date DATE,
  checkout_date DATE,
  category JSONB,          -- guarda category + sub_category como JSON
  total_value NUMERIC(12,2)
);

-- índices úteis
CREATE INDEX IF NOT EXISTS idx_reserva_uuid ON reserva(uuid);
CREATE INDEX IF NOT EXISTS idx_cliente_external ON cliente(external_id);
CREATE INDEX IF NOT EXISTS idx_hotel_external ON hotel(external_id);
CREATE INDEX IF NOT EXISTS idx_quarto_reserva_id ON quarto_reservado(reserva_id);



SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';
