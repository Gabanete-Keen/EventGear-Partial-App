import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, shadow } from './theme';

export function Money({ value, style }) {
  return (
    <Text style={[styles.money, style]}>
      ₱{Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
    </Text>
  );
}

export function PrimaryButton({ title, onPress, disabled, loading, variant = 'primary', style }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.teal : '#FFFFFF'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, multiline, style, containerStyle, ...props }) {
  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#93A0B2"
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError, style]}
        {...props}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!action && (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EquipmentCard({ item, onPress, compact = false }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.emojiBox, compact && styles.emojiBoxCompact]}>
        <Text style={compact ? styles.emojiCompact : styles.emoji}>{item.image_ref || '🎪'}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.category}>{item.category}</Text>
        <Text numberOfLines={2} style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Money value={item.daily_rate} />
          <Text style={styles.perDay}> / day</Text>
        </View>
        <Text style={styles.stock}>{item.total_quantity} in stock</Text>
      </View>
    </Pressable>
  );
}

export function StatusPill({ status }) {
  const normalized = status || 'pending';
  return (
    <View style={[styles.pill, styles[`pill_${normalized}`]]}>
      <Text style={[styles.pillText, styles[`pillText_${normalized}`]]}>
        {normalized.toUpperCase()}
      </Text>
    </View>
  );
}

export function EmptyState({ icon = '📦', title, message, action, onAction }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {!!action && <PrimaryButton title={action} onPress={onAction} style={{ marginTop: 18 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.medium,
    backgroundColor: colors.teal,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: { backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.teal },
  dangerButton: { backgroundColor: colors.danger },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondaryButtonText: { color: colors.tealDark },
  fieldWrap: { marginBottom: 16 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    minHeight: 50,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  multiline: { minHeight: 94, paddingTop: 13, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, marginTop: 5, fontSize: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 21, color: colors.text, fontWeight: '900' },
  sectionAction: { color: colors.tealDark, fontWeight: '800' },
  card: {
    flexDirection: 'row',
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
    ...shadow,
  },
  emojiBox: { width: 104, height: 112, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  emojiBoxCompact: { width: 76, height: 82 },
  emoji: { fontSize: 47 },
  emojiCompact: { fontSize: 36 },
  cardBody: { flex: 1, paddingLeft: 14, justifyContent: 'center' },
  category: { color: colors.tealDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 7 },
  money: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  perDay: { color: colors.muted, fontSize: 12 },
  stock: { color: colors.muted, fontSize: 12, marginTop: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  pill_pending: { backgroundColor: '#FFF3D6' },
  pill_confirmed: { backgroundColor: '#DDF6F2' },
  pill_completed: { backgroundColor: '#E5EEF9' },
  pill_cancelled: { backgroundColor: '#FCE4E4' },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  pillText_pending: { color: '#936300' },
  pillText_confirmed: { color: colors.success },
  pillText_completed: { color: colors.navySoft },
  pillText_cancelled: { color: colors.danger },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 35, paddingVertical: 70 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
});
