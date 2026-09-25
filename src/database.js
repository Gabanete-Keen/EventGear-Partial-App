const seedEquipment = [
  ['Premium Sound System', 'Audio', 'Two powered speakers, mixer, microphones, and stands.', 2500, 5, '🎤'],
  ['LED Party Lights', 'Lighting', 'Color-changing LED lights for indoor and outdoor events.', 850, 12, '💡'],
  ['Folding Tables', 'Furniture', 'Six-foot rectangular tables suitable for dining or registration.', 300, 30, '🪑'],
  ['Monobloc Chairs', 'Furniture', 'Clean white chairs for parties, programs, and community events.', 35, 150, '🪑'],
  ['Pop-up Canopy Tent', 'Tents', 'Three-by-three meter weather-resistant event canopy.', 1200, 8, '⛺'],
  ['Portable Projector', 'Visual', 'Full HD projector with HDMI cable and portable screen.', 1800, 4, '🎥'],
];

export async function initializeDatabase(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      contact TEXT,
      role TEXT NOT NULL CHECK(role IN ('customer', 'supplier', 'admin'))
    );

    CREATE TABLE IF NOT EXISTS equipment (
      equipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      daily_rate REAL NOT NULL CHECK(daily_rate >= 0),
      total_quantity INTEGER NOT NULL CHECK(total_quantity >= 0),
      image_ref TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (supplier_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS reservations (
      reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_code TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      booking_contact TEXT NOT NULL,
      event_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
      demo_payment_method TEXT,
      demo_payment_status TEXT NOT NULL DEFAULT 'not_recorded',
      total_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS reservation_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      daily_rate_at_booking REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
    );

    CREATE INDEX IF NOT EXISTS idx_reservation_dates
      ON reservations(start_date, end_date, status);
    CREATE INDEX IF NOT EXISTS idx_reservation_items_equipment
      ON reservation_items(equipment_id);
  `);

  await db.runAsync(
    `INSERT OR IGNORE INTO users (user_id, name, contact, role) VALUES (?, ?, ?, ?)`,
    1,
    'Demo Customer',
    '0917 000 0001',
    'customer'
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO users (user_id, name, contact, role) VALUES (?, ?, ?, ?)`,
    2,
    'EventGear Supplier',
    '0917 000 0002',
    'supplier'
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO users (user_id, name, contact, role) VALUES (?, ?, ?, ?)`,
    3,
    'Demo Administrator',
    'admin@eventgear.local',
    'admin'
  );

  const existing = await db.getFirstAsync('SELECT COUNT(*) AS count FROM equipment');
  if (existing.count === 0) {
    for (const item of seedEquipment) {
      await db.runAsync(
        `INSERT INTO equipment
          (supplier_id, name, category, description, daily_rate, total_quantity, image_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        2,
        ...item
      );
    }
  }
}

export async function getEquipment(db, search = '', category = 'All') {
  const term = `%${search.trim()}%`;
  return db.getAllAsync(
    `SELECT * FROM equipment
     WHERE is_active = 1
       AND (? = 'All' OR category = ?)
       AND (name LIKE ? OR category LIKE ? OR description LIKE ?)
     ORDER BY name ASC`,
    category,
    category,
    term,
    term,
    term
  );
}

export async function getEquipmentById(db, equipmentId) {
  return db.getFirstAsync(
    'SELECT * FROM equipment WHERE equipment_id = ?',
    equipmentId
  );
}

export async function getAvailableQuantity(db, equipmentId, startDate, endDate) {
  const row = await db.getFirstAsync(
    `SELECT e.total_quantity - COALESCE(SUM(
        CASE WHEN r.reservation_id IS NOT NULL THEN ri.quantity ELSE 0 END
      ), 0) AS available
     FROM equipment e
     LEFT JOIN reservation_items ri ON ri.equipment_id = e.equipment_id
     LEFT JOIN reservations r ON r.reservation_id = ri.reservation_id
       AND r.status IN ('pending', 'confirmed')
       AND r.start_date <= ?
       AND r.end_date >= ?
     WHERE e.equipment_id = ?
     GROUP BY e.equipment_id`,
    endDate,
    startDate,
    equipmentId
  );
  return Number(row?.available ?? 0);
}

export function rentalDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.floor((end - start) / 86400000) + 1;
}

export async function createReservation(db, booking) {
  const days = rentalDays(booking.startDate, booking.endDate);
  if (!Number.isFinite(days) || days < 1) {
    throw new Error('Please enter a valid rental date range.');
  }

  for (const item of booking.items) {
    const available = await getAvailableQuantity(
      db,
      item.equipment_id,
      booking.startDate,
      booking.endDate
    );
    if (item.quantity > available) {
      throw new Error(`${item.name} only has ${available} available for those dates.`);
    }
  }

  const total = booking.items.reduce(
    (sum, item) => sum + item.daily_rate * item.quantity * days,
    0
  );
  const bookingCode = `EG-${Date.now().toString().slice(-8)}`;
  let reservationId;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO reservations
        (booking_code, customer_id, start_date, end_date, booking_contact,
         event_note, status, demo_payment_method, demo_payment_status, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'recorded', ?)`,
      bookingCode,
      1,
      booking.startDate,
      booking.endDate,
      booking.contact,
      booking.note,
      booking.paymentMethod,
      total
    );
    reservationId = result.lastInsertRowId;

    for (const item of booking.items) {
      const lineTotal = item.daily_rate * item.quantity * days;
      await db.runAsync(
        `INSERT INTO reservation_items
          (reservation_id, equipment_id, quantity, daily_rate_at_booking, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        reservationId,
        item.equipment_id,
        item.quantity,
        item.daily_rate,
        lineTotal
      );
    }
  });

  return { reservationId, bookingCode, total };
}

export async function getCustomerRentals(db) {
  return db.getAllAsync(
    `SELECT r.*,
      COUNT(ri.item_id) AS item_count,
      GROUP_CONCAT(e.name, ', ') AS item_names
     FROM reservations r
     JOIN reservation_items ri ON ri.reservation_id = r.reservation_id
     JOIN equipment e ON e.equipment_id = ri.equipment_id
     WHERE r.customer_id = 1
     GROUP BY r.reservation_id
     ORDER BY r.created_at DESC, r.reservation_id DESC`
  );
}

export async function getRentalDetails(db, reservationId) {
  const reservation = await db.getFirstAsync(
    'SELECT * FROM reservations WHERE reservation_id = ?',
    reservationId
  );
  const items = await db.getAllAsync(
    `SELECT ri.*, e.name, e.image_ref
     FROM reservation_items ri
     JOIN equipment e ON e.equipment_id = ri.equipment_id
     WHERE ri.reservation_id = ?`,
    reservationId
  );
  return { reservation, items };
}

export async function getSupplierReservations(db) {
  return db.getAllAsync(
    `SELECT r.*, u.name AS customer_name,
      GROUP_CONCAT(e.name || ' x' || ri.quantity, ', ') AS item_names
     FROM reservations r
     JOIN users u ON u.user_id = r.customer_id
     JOIN reservation_items ri ON ri.reservation_id = r.reservation_id
     JOIN equipment e ON e.equipment_id = ri.equipment_id
     WHERE e.supplier_id = 2
     GROUP BY r.reservation_id
     ORDER BY r.created_at DESC, r.reservation_id DESC`
  );
}

export async function updateReservationStatus(db, reservationId, status) {
  return db.runAsync(
    'UPDATE reservations SET status = ? WHERE reservation_id = ?',
    status,
    reservationId
  );
}

export async function saveEquipment(db, form, equipmentId) {
  const values = [
    form.name.trim(),
    form.category.trim(),
    form.description.trim(),
    Number(form.dailyRate),
    Number(form.totalQuantity),
    form.imageRef || '🎪',
  ];

  if (equipmentId) {
    return db.runAsync(
      `UPDATE equipment SET
        name = ?, category = ?, description = ?, daily_rate = ?,
        total_quantity = ?, image_ref = ?
       WHERE equipment_id = ?`,
      ...values,
      equipmentId
    );
  }

  return db.runAsync(
    `INSERT INTO equipment
      (supplier_id, name, category, description, daily_rate, total_quantity, image_ref)
     VALUES (2, ?, ?, ?, ?, ?, ?)`,
    ...values
  );
}

export async function deleteEquipment(db, equipmentId) {
  const futureBooking = await db.getFirstAsync(
    `SELECT COUNT(*) AS count
     FROM reservation_items ri
     JOIN reservations r ON r.reservation_id = ri.reservation_id
     WHERE ri.equipment_id = ?
       AND r.status IN ('pending', 'confirmed')
       AND r.end_date >= date('now')`,
    equipmentId
  );
  if (futureBooking.count > 0) {
    throw new Error('This equipment has an active or future booking and cannot be removed.');
  }
  return db.runAsync('DELETE FROM equipment WHERE equipment_id = ?', equipmentId);
}
