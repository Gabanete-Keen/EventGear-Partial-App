import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from './AppContext';
import { deleteUser, getAdminOverview, getUsers, saveUser } from './database';
import { Alert } from './feedback';
import { EmptyState, Field, Money, PrimaryButton, SectionTitle, StatusPill } from './components';
import { colors, radius } from './theme';

// Focus refresh keeps administrator totals synchronized with other demo roles.
function useOverview() {
  const { db } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getAdminOverview(db)); }
    catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }, [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { data, loading, error, load };
}
function OverviewFallback({ loading, error, load }) {
  return <EmptyState title={loading ? 'Loading overview…' : 'Could not load overview'} message={error || 'Reading saved records.'} action={error ? 'Retry' : undefined} onAction={load} />;
}
export function AdminDashboardScreen({ navigation }) {
  const state = useOverview();
  if (!state.data) return <OverviewFallback {...state} />;
  const { stats } = state.data;
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={state.loading} onRefresh={state.load} />}>
    <View style={styles.hero}><Text style={styles.eyebrow}>EVENTGEAR ADMINISTRATOR</Text>
      <Text style={styles.heroTitle}>Your rental operations,{`\n`}at a glance.</Text>
      <Text style={styles.heroText}>Manage records and keep every reservation on track.</Text></View>
    <View style={styles.grid}>{[['Users', stats.users], ['Equipment', stats.equipment], ['Pending', stats.pending], ['Bookings', stats.reservations]].map(([label, value]) =>
      <View key={label} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>)}</View>
    <View style={styles.card}><Text style={styles.heading}>Confirmed rental value</Text><Money value={stats.value} style={{ fontSize: 28, marginTop: 8 }} />
      <Text style={styles.muted}>Confirmed and completed bookings. This is rental value, not collected payments.</Text></View>
    <SectionTitle title="Management" />
    {[['users', '👥 User directory', 'Create, edit, and remove local user records.'], ['equipment', '📦 Equipment', 'Maintain equipment listings and stock.'], ['reservations', '📋 Reservations', 'Review customer bookings and update progress.'], ['reports', '📊 Reports & activity', 'Review status totals and recent database actions.']].map(([route, title, text]) =>
      <Pressable key={route} style={styles.card} onPress={() => navigation.navigate(route)}><Text style={styles.heading}>{title} ›</Text><Text style={styles.muted}>{text}</Text></Pressable>)}
    <PrimaryButton title="Switch demo role" variant="secondary" onPress={() => navigation.navigate('RoleSelect')} />
  </ScrollView>;
}
const blankUser = { name: '', contact: '', role: 'customer' };
export function AdminUsersScreen() {
  const list = useRef(null);
  const { db } = useApp();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blankUser);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try { setUsers(await getUsers(db)); } catch (error) { Alert.alert('Could not load users', error.message); }
    finally { setRefreshing(false); }
  }, [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  function reset() { setForm(blankUser); setEditing(null); }
  async function submit() {
    if (saving) return;
    setSaving(true);
    try { await saveUser(db, form, editing); await load(); reset(); Alert.alert('User saved', editing ? 'The user record was updated.' : 'A local user record was created.'); }
    catch (error) { Alert.alert('Could not save user', error.message); }
    finally { setSaving(false); }
  }
  function remove(user) {
    Alert.alert('Delete user?', `Remove ${user.name}? This action cannot be undone.`, [{ text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteUser(db, user.user_id); await load(); if (editing === user.user_id) reset(); Alert.alert('User deleted', 'The user record was removed.');
      } }]);
  }
  // A single FlatList avoids nesting vertical lists; the form is its header.
  return <FlatList ref={list} style={styles.page} contentContainerStyle={styles.content} data={users}
    keyExtractor={item => String(item.user_id)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    ListHeaderComponent={<>
      <Text style={styles.title}>User directory</Text><Text style={styles.muted}>Local contact records. The three role-selection accounts are protected; new records do not create sign-in accounts.</Text>
      <View style={styles.card}><Text style={styles.heading}>{editing ? `Edit user #${editing}` : 'Add a user'}</Text>
        <Field label="Name" value={form.name} onChangeText={name => setForm(f => ({ ...f, name }))} />
        <Field label="Contact / email" value={form.contact} onChangeText={contact => setForm(f => ({ ...f, contact }))} />
        <Text style={styles.heading}>Role</Text><View style={styles.roles}>{['customer', 'supplier', 'admin'].map(role =>
          <Pressable key={role} disabled={editing && editing <= 3} onPress={() => setForm(f => ({ ...f, role }))}
            style={[styles.chip, form.role === role && styles.active]}><Text style={{ color: form.role === role ? '#FFFFFF' : colors.navy }}>{role}</Text></Pressable>)}</View>
        <PrimaryButton title={editing ? 'Save changes' : 'Create user'} onPress={submit} loading={saving} />
        {editing && <PrimaryButton title="Cancel edit" onPress={reset} variant="secondary" style={{ marginTop: 8 }} />}
      </View><SectionTitle title={`Saved users (${users.length})`} /></>}
    renderItem={({ item }) => <View style={styles.card}><Text style={styles.heading}>{item.name}</Text><Text style={styles.muted}>{item.contact} • {item.role}</Text>
      <View style={styles.roles}><PrimaryButton title="Edit" variant="secondary" onPress={() => { list.current?.scrollToOffset({ offset: 0, animated: true }); setEditing(item.user_id); setForm({ name: item.name, contact: item.contact || '', role: item.role }); }} />
        <PrimaryButton title={item.user_id <= 3 ? 'Protected' : 'Delete'} disabled={item.user_id <= 3} variant="danger" onPress={() => remove(item)} /></View></View>} />;
}
export function AdminReportsScreen() {
  const state = useOverview();
  if (!state.data) return <OverviewFallback {...state} />;
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={state.loading} onRefresh={state.load} />}>
    <Text style={styles.title}>Reports & activity</Text><Text style={styles.muted}>Live totals from the local SQLite database.</Text>
    <SectionTitle title="Reservation summary" />
    {state.data.statuses.length === 0 && <EmptyState title="No bookings yet" message="Complete a customer reservation to populate reports." />}
    {state.data.statuses.map(row => <View key={row.status} style={styles.card}><StatusPill status={row.status} /><Text style={styles.heading}>{row.count} booking(s)</Text><Money value={row.total} /></View>)}
    <SectionTitle title="Recent activity" />
    <Text style={styles.muted}>Latest 50 actions. Existing records from the partial app have no historical audit entries.</Text>
    {state.data.activity.map(row => <View key={row.audit_id} style={styles.card}><Text style={styles.heading}>{row.action}</Text><Text style={styles.muted}>{row.details}</Text><Text style={styles.small}>{row.created_at} UTC</Text></View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 40 },
  hero: { backgroundColor: colors.navy, borderRadius: radius.large, padding: 22 }, eyebrow: { color: '#8DDFD7', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: 10, lineHeight: 33 }, heroText: { color: '#CCD9E7', marginTop: 10, lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 }, stat: { flexGrow: 1, minWidth: '45%', backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 28, fontWeight: '900', color: colors.navy }, card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  title: { color: colors.navy, fontSize: 25, fontWeight: '900', marginBottom: 8 }, heading: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 }, small: { color: colors.muted, fontSize: 11, marginTop: 6 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, chip: { padding: 12, backgroundColor: colors.mint, borderRadius: 12 }, active: { backgroundColor: colors.teal },
});
