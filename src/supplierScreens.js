import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from './AppContext';
import {
  deleteEquipment,
  getEquipmentById,
  getSupplierReservations,
  saveEquipment,
  updateReservationStatus,
} from './database';
import { EmptyState, EquipmentCard, Field, Money, PrimaryButton, StatusPill } from './components';
import { colors, radius, shadow } from './theme';

export function SupplierDashboardScreen({ navigation }) {
  const { equipment, db } = useApp();
  const [reservations, setReservations] = useState([]);

  useFocusEffect(useCallback(() => {
    getSupplierReservations(db).then(setReservations);
  }, [db]));

  const pending = reservations.filter((r) => r.status === 'pending').length;
  const confirmed = reservations.filter((r) => r.status === 'confirmed').length;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.supplierHero}>
        <Text style={styles.heroEyebrow}>SUPPLIER DASHBOARD</Text>
        <Text style={styles.heroTitle}>Manage rentals{`\n`}with confidence.</Text>
        <Text style={styles.heroText}>Equipment and bookings are stored locally in SQLite.</Text>
      </View>

      <View style={styles.statsGrid}>
        <Stat value={equipment.length} label="Equipment" />
        <Stat value={pending} label="Pending" />
        <Stat value={confirmed} label="Confirmed" />
      </View>

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <Pressable onPress={() => navigation.navigate('Manage Equipment')} style={styles.actionCard}>
        <View style={styles.actionIcon}><Text style={styles.actionEmoji}>📦</Text></View>
        <View style={styles.actionCopy}><Text style={styles.actionTitle}>Manage equipment</Text><Text style={styles.actionText}>Create, read, update, and delete listings.</Text></View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Reservations')} style={styles.actionCard}>
        <View style={styles.actionIcon}><Text style={styles.actionEmoji}>📋</Text></View>
        <View style={styles.actionCopy}><Text style={styles.actionTitle}>Review reservations</Text><Text style={styles.actionText}>Confirm, complete, or cancel customer bookings.</Text></View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>

      <Pressable onPress={() => navigation.getParent()?.navigate('RoleSelect')} style={styles.switchRole}>
        <Text style={styles.switchRoleText}>⇄ Switch demo role</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ value, label }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export function ManageEquipmentScreen({ navigation }) {
  const { equipment, db, refreshEquipment } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { refreshEquipment(); }, [refreshEquipment]));

  function askDelete(item) {
    Alert.alert('Remove equipment?', `${item.name} will be deleted if it has no active or future bookings.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await deleteEquipment(db, item.equipment_id);
            await refreshEquipment();
          } catch (error) {
            Alert.alert('Cannot remove equipment', error.message);
          }
        },
      },
    ]);
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.listContent}
      data={equipment}
      keyExtractor={(item) => String(item.equipment_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refreshEquipment(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <View style={{ flex: 1 }}><Text style={styles.pageTitle}>Equipment CRUD</Text><Text style={styles.pageLead}>Listings saved on this device.</Text></View>
          <Pressable onPress={() => navigation.getParent()?.navigate('EquipmentForm')} style={styles.addButton}><Text style={styles.addButtonText}>+ Add</Text></Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.manageCard}>
          <EquipmentCard item={item} compact onPress={() => navigation.getParent()?.navigate('EquipmentForm', { equipmentId: item.equipment_id })} />
          <View style={styles.manageActions}>
            <Pressable onPress={() => navigation.getParent()?.navigate('EquipmentForm', { equipmentId: item.equipment_id })} style={styles.editAction}><Text style={styles.editActionText}>Edit listing</Text></Pressable>
            <Pressable onPress={() => askDelete(item)} style={styles.deleteAction}><Text style={styles.deleteActionText}>Delete</Text></Pressable>
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState title="No equipment" message="Add the supplier's first equipment listing." action="Add equipment" onAction={() => navigation.getParent()?.navigate('EquipmentForm')} />}
    />
  );
}

export function EquipmentFormScreen({ navigation, route }) {
  const { db, refreshEquipment } = useApp();
  const equipmentId = route.params?.equipmentId;
  const [form, setForm] = useState({ name: '', category: '', description: '', dailyRate: '', totalQuantity: '', imageRef: '🎪' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: equipmentId ? 'Edit Equipment' : 'Add Equipment' });
    if (equipmentId) {
      getEquipmentById(db, equipmentId).then((item) => {
        if (item) setForm({ name: item.name, category: item.category, description: item.description, dailyRate: String(item.daily_rate), totalQuantity: String(item.total_quantity), imageRef: item.image_ref || '🎪' });
      });
    }
  }, [db, equipmentId, navigation]);

  function setField(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit() {
    const next = {};
    if (!form.name.trim()) next.name = 'Equipment name is required.';
    if (!form.category.trim()) next.category = 'Category is required.';
    if (!form.description.trim()) next.description = 'Description is required.';
    if (!form.dailyRate || Number(form.dailyRate) < 0) next.dailyRate = 'Enter a valid daily rate.';
    if (!form.totalQuantity || Number(form.totalQuantity) < 0 || !Number.isInteger(Number(form.totalQuantity))) next.totalQuantity = 'Enter a whole-number quantity.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await saveEquipment(db, form, equipmentId);
      await refreshEquipment();
      Alert.alert('Saved', equipmentId ? 'Equipment listing updated.' : 'Equipment listing created.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Could not save', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.pageTitle}>{equipmentId ? 'Update listing' : 'Create a listing'}</Text>
      <Text style={styles.pageLead}>This form demonstrates supplier create and update operations.</Text>
      <Field label="Equipment name" value={form.name} onChangeText={(value) => setField('name', value)} error={errors.name} />
      <Field label="Category" value={form.category} onChangeText={(value) => setField('category', value)} error={errors.category} placeholder="Example: Audio" />
      <Field label="Description" value={form.description} onChangeText={(value) => setField('description', value)} error={errors.description} multiline />
      <Field label="Daily rate (PHP)" value={form.dailyRate} onChangeText={(value) => setField('dailyRate', value)} error={errors.dailyRate} keyboardType="decimal-pad" />
      <Field label="Total quantity" value={form.totalQuantity} onChangeText={(value) => setField('totalQuantity', value)} error={errors.totalQuantity} keyboardType="number-pad" />
      <Field label="Display emoji" value={form.imageRef} onChangeText={(value) => setField('imageRef', value)} />
      <PrimaryButton title={equipmentId ? 'Save changes' : 'Create equipment'} onPress={submit} loading={saving} />
    </ScrollView>
  );
}

export function SupplierReservationsScreen() {
  const { db } = useApp();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setItems(await getSupplierReservations(db)), [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setStatus(reservationId, status) {
    await updateReservationStatus(db, reservationId, status);
    await load();
  }

  function chooseStatus(item) {
    Alert.alert(`Update ${item.booking_code}`, 'Choose the reservation status.', [
      { text: 'Pending', onPress: () => setStatus(item.reservation_id, 'pending') },
      { text: 'Confirmed', onPress: () => setStatus(item.reservation_id, 'confirmed') },
      { text: 'Completed', onPress: () => setStatus(item.reservation_id, 'completed') },
      { text: 'Cancelled', style: 'destructive', onPress: () => setStatus(item.reservation_id, 'cancelled') },
      { text: 'Close', style: 'cancel' },
    ]);
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={(item) => String(item.reservation_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={<><Text style={styles.pageTitle}>Customer reservations</Text><Text style={styles.pageLead}>Update statuses to demonstrate the booking workflow.</Text></>}
      renderItem={({ item }) => (
        <View style={styles.reservationCard}>
          <View style={styles.reservationTop}><Text style={styles.code}>{item.booking_code}</Text><StatusPill status={item.status} /></View>
          <Text style={styles.customer}>{item.customer_name}</Text>
          <Text style={styles.itemNames}>{item.item_names}</Text>
          <Text style={styles.dates}>{item.start_date} → {item.end_date}</Text>
          <View style={styles.reservationBottom}><Money value={item.total_amount} /><Pressable onPress={() => chooseStatus(item)} style={styles.statusButton}><Text style={styles.statusButtonText}>Update status</Text></Pressable></View>
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="📋" title="No reservations yet" message="Create a customer booking first, then return here as the supplier." />}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 40 },
  listContent: { padding: 18, paddingBottom: 40 },
  formContent: { padding: 20, paddingBottom: 40 },
  supplierHero: { backgroundColor: colors.navy, borderRadius: radius.large, padding: 23 },
  heroEyebrow: { color: '#87DDD5', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 8 },
  heroText: { color: '#C9D5E3', fontSize: 13, lineHeight: 19, marginTop: 10 },
  statsGrid: { flexDirection: 'row', gap: 9, marginVertical: 17 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.medium, padding: 14, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.navy, fontWeight: '900', fontSize: 22 },
  statLabel: { color: colors.muted, fontSize: 10, marginTop: 3 },
  sectionTitle: { color: colors.text, fontWeight: '900', fontSize: 20, marginVertical: 8 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.border, padding: 15, marginBottom: 11, ...shadow },
  actionIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  actionEmoji: { fontSize: 27 },
  actionCopy: { flex: 1, paddingHorizontal: 13 },
  actionTitle: { color: colors.text, fontWeight: '900' },
  actionText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  arrow: { color: colors.tealDark, fontSize: 29 },
  switchRole: { alignItems: 'center', padding: 18, marginTop: 10 },
  switchRoleText: { color: colors.tealDark, fontWeight: '800' },
  listHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  pageTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  pageLead: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 },
  addButton: { backgroundColor: colors.teal, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  addButtonText: { color: '#FFFFFF', fontWeight: '900' },
  manageCard: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: 0, marginBottom: 13 },
  manageActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 9, paddingBottom: 10 },
  editAction: { flex: 1, backgroundColor: colors.mint, borderRadius: 10, padding: 10, alignItems: 'center' },
  editActionText: { color: colors.tealDark, fontWeight: '800', fontSize: 12 },
  deleteAction: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FCE8E8' },
  deleteActionText: { color: colors.danger, fontWeight: '800', fontSize: 12 },
  reservationCard: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: 17, borderWidth: 1, borderColor: colors.border, marginBottom: 12, ...shadow },
  reservationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { color: colors.navy, fontWeight: '900' },
  customer: { color: colors.text, fontWeight: '900', fontSize: 17, marginTop: 14 },
  itemNames: { color: colors.muted, lineHeight: 20, marginTop: 5 },
  dates: { color: colors.muted, fontSize: 12, marginTop: 7 },
  reservationBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 13 },
  statusButton: { backgroundColor: colors.navy, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9 },
  statusButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
});
