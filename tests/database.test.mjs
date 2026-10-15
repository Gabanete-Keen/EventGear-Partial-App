import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as api from '../src/database.js';

// Execute the actual production SQL in SQLite. This adapter only translates
// expo-sqlite's async interface to Node's bundled SQLite test connection.
function connection() {
  const sql = new DatabaseSync(':memory:');
  return {
    sql,
    async execAsync(query) { sql.exec(query); },
    async runAsync(query, ...args) { const r = sql.prepare(query).run(...args); return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes }; },
    async getFirstAsync(query, ...args) { return sql.prepare(query).get(...args); },
    async getAllAsync(query, ...args) { return sql.prepare(query).all(...args); },
    async withTransactionAsync(work) {
      sql.exec('BEGIN');
      try { await work(); sql.exec('COMMIT'); } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
}
const form = { name: 'Test Speaker', category: 'Audio', description: 'Portable speaker', dailyRate: '100.50', totalQuantity: '5', imageRef: '🎤' };
const booking = item => ({ startDate: '2099-01-01', endDate: '2099-01-02', contact: '09123456789', note: 'Test event', paymentMethod: 'Cash on pickup', items: [{ ...item, quantity: 2 }] });

test('schema is idempotent and seeds all three roles', async () => {
  const db = connection(); await api.initializeDatabase(db); await api.initializeDatabase(db);
  assert.equal((await api.getEquipment(db)).length, 6); assert.equal((await api.getUsers(db)).length, 3);
  assert.deepEqual(db.sql.prepare('PRAGMA foreign_key_check').all(), []);
});
test('strict calendar validation and inclusive UTC days', () => {
  assert.equal(api.validDate('2026-02-30'), false); assert.equal(api.validDate('2026-13-01'), false);
  assert.equal(api.validDate('2028-02-29'), true); assert.equal(api.rentalDays('2026-03-07','2026-03-09'), 3);
  assert.ok(Number.isNaN(api.rentalDays('invalid','2026-03-09')));
});
test('equipment create/read/update/delete and invalid numeric input', async () => {
  const db = connection(); await api.initializeDatabase(db);
  await api.saveEquipment(db, form); let row = (await api.getEquipment(db, 'Test Speaker'))[0]; assert.equal(row.daily_rate, 100.5);
  await api.saveEquipment(db, { ...form, name: 'Updated' }, row.equipment_id);
  assert.equal((await api.getEquipmentById(db,row.equipment_id)).name, 'Updated');
  await assert.rejects(api.saveEquipment(db,{...form,dailyRate:'NaN'}), /rate/);
  await assert.rejects(api.saveEquipment(db,{...form,totalQuantity:'1.5'}), /quantity/);
  await api.deleteEquipment(db,row.equipment_id); assert.equal(await api.getEquipmentById(db,row.equipment_id), undefined);
});
test('reservation saves authoritative prices, items, totals, cart and audit atomically', async () => {
  const db = connection(); await api.initializeDatabase(db); const item = (await api.getEquipment(db))[0];
  await api.persistCart(db,[{...item,quantity:2}]); assert.equal((await api.getCart(db)).length,1);
  const result = await api.createReservation(db,booking(item));
  const details = await api.getRentalDetails(db,result.reservationId);
  assert.equal(details.items.length,1); assert.equal(result.total,item.daily_rate * 4);
  assert.equal(details.reservation.demo_payment_status,'not_recorded'); assert.equal((await api.getCart(db)).length,0);
  assert.equal((await api.getCustomerRentals(db)).length,1); assert.equal((await api.getSupplierReservations(db)).length,1);
  assert.ok((await api.getAdminOverview(db)).activity.length);
  await assert.rejects(api.deleteEquipment(db,item.equipment_id), /active/);
  await assert.rejects(api.saveEquipment(db,{...form,totalQuantity:'1'},item.equipment_id),/committed/);
});
test('invalid, empty, duplicate, past and stale-price bookings are rejected without partial writes', async () => {
  const db = connection(); await api.initializeDatabase(db); const item = (await api.getEquipment(db))[0]; const b = booking(item);
  for (const bad of [{...b,items:[]},{...b,contact:''},{...b,startDate:'2026-02-30'},{...b,startDate:'2000-01-01'},
    {...b,items:[{...item,quantity:-1}]},{...b,items:[...b.items,...b.items]},{...b,items:[{...item,quantity:1,daily_rate:0}]}]) {
    await assert.rejects(api.createReservation(db,bad));
  }
  assert.equal((await api.getCustomerRentals(db)).length,0);
});
test('concurrent submissions cannot overbook stock', async () => {
  const db = connection(); await api.initializeDatabase(db); const item = (await api.getEquipment(db))[0];
  const b = {...booking(item),items:[{...item,quantity:item.total_quantity}]};
  const results = await Promise.allSettled([api.createReservation(db,b),api.createReservation(db,b)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await api.getCustomerRentals(db)).length,1);
});
test('availability counts peak daily use and inclusive boundary overlap', async () => {
  const db = connection(); await api.initializeDatabase(db); const item = (await api.getEquipment(db))[0];
  await api.createReservation(db,{...booking(item),endDate:'2099-01-01'});
  await api.createReservation(db,{...booking(item),startDate:'2099-01-03',endDate:'2099-01-03'});
  assert.equal(await api.getAvailableQuantity(db,item.equipment_id,'2099-01-01','2099-01-03'),item.total_quantity-2);
  assert.equal(await api.getAvailableQuantity(db,item.equipment_id,'2099-01-02','2099-01-02'),item.total_quantity);
});
test('status transitions, customer details and cancelled stock release', async () => {
  const db = connection(); await api.initializeDatabase(db); const item = (await api.getEquipment(db))[0];
  const r = await api.createReservation(db,booking(item));
  await api.updateReservationContact(db,r.reservationId,'new contact','new note');
  assert.equal((await api.getRentalDetails(db,r.reservationId)).reservation.booking_contact,'new contact');
  await api.updateReservationStatus(db,r.reservationId,'confirmed');
  await assert.rejects(api.updateReservationContact(db,r.reservationId,'x','x'),/pending/);
  await assert.rejects(api.updateReservationStatus(db,r.reservationId,'completed'),/end date/);
  await api.updateReservationStatus(db,r.reservationId,'cancelled');
  await assert.rejects(api.updateReservationStatus(db,r.reservationId,'pending'),/allowed/);
  assert.equal(await api.getAvailableQuantity(db,item.equipment_id,'2099-01-01','2099-01-02'),item.total_quantity);
  await api.deleteEquipment(db,item.equipment_id);
  assert.equal((await api.getEquipmentById(db,item.equipment_id)).is_active,0);
  assert.equal((await api.getRentalDetails(db,r.reservationId)).items.length,1);
  assert.deepEqual(db.sql.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('administrator user CRUD protects demo accounts', async () => {
  const db = connection(); await api.initializeDatabase(db);
  const user = { name: 'Panel Guest', contact: 'guest@example.com', role: 'customer' };
  await api.saveUser(db,user); const saved = (await api.getUsers(db)).find(r=>r.name===user.name);
  await api.saveUser(db,{...user,name:'Edited Guest'},saved.user_id);
  assert.equal((await api.getUsers(db)).find(r=>r.user_id===saved.user_id).name,'Edited Guest');
  await api.deleteUser(db,saved.user_id); assert.equal((await api.getUsers(db)).length,3);
  await assert.rejects(api.deleteUser(db,3),/required/); await assert.rejects(api.saveUser(db,{...user,role:'supplier'},1),/fixed/);
});
test('completed rental contributes to admin totals and remains historical', async () => {
  const db = connection(); await api.initializeDatabase(db); const item = (await api.getEquipment(db))[0];
  const result = await api.createReservation(db,booking(item));
  await api.updateReservationStatus(db,result.reservationId,'confirmed');
  // Simulate a scheduled rental that has reached its end date.
  await db.runAsync("UPDATE reservations SET start_date = '2000-01-01', end_date = '2000-01-02' WHERE reservation_id = ?",result.reservationId);
  await api.updateReservationStatus(db,result.reservationId,'completed');
  assert.equal((await api.getAdminOverview(db)).stats.value,result.total);
  await assert.rejects(api.updateReservationStatus(db,result.reservationId,'confirmed'),/allowed/);
});


test('empty catalog remains empty after reopening', async () => {
  const db = connection(); await api.initializeDatabase(db);
  for (const item of await api.getEquipment(db)) await api.deleteEquipment(db,item.equipment_id);
  await api.initializeDatabase(db);
  assert.equal((await api.getEquipment(db)).length,0);
});
