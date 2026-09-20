import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

const COLORS = {
  indigo: '#4F46E5',
  purple: '#7C3AED',
  teal: '#0D9488',
  green: '#059669',
  red: '#DC2626',
  orange: '#D97706',
  cyan: '#0891B2',
  text: '#172033',
  muted: '#667085',
  faint: '#98A2B3',
  border: '#EAECF0',
  bg: '#F7F8FC',
  white: '#FFFFFF',
};

const STATUS_PALETTE = {
  closed: { bg: '#EEF0F4', text: '#566070' },
  'client side testing': { bg: '#F3E8FF', text: '#7E22CE' },
  'sanity pass': { bg: '#DCFCE7', text: '#15803D' },
  'testing pending': { bg: '#FCE7F3', text: '#DB2777' },
  'point dropped': { bg: '#FEE2E2', text: '#DC2626' },
  'in observation': { bg: '#FEF3C7', text: '#D97706' },
  'in testing': { bg: '#CFFAFE', text: '#0891B2' },
  'under development': { bg: '#E0E7FF', text: '#4F46E5' },
  'yet to be assigned': { bg: '#F1F5F9', text: '#64748B' },
  'pending sanity merge': { bg: '#E0F2FE', text: '#0284C7' },
  'on support': { bg: '#D1FAE5', text: '#047857' },
  'on product': { bg: '#ECFCCB', text: '#4D7C0F' },
  'sit pass': { bg: '#CCFBF1', text: '#0F766E' },
};

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = safeDate(value);
  if (!d) return '-';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function formatDateTime(value) {
  const d = safeDate(value);
  if (!d) return '-';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function getPriorityStatus(row) {
  if (!row) return '-';
  if (row.PointDrop === true || row.PointDrop === 1 || String(row.PointDrop) === '1') return 'Point Dropped';
  if (row.IsClientSideTesting === true || row.IsClientSideTesting === 1 || String(row.IsClientSideTesting) === '1') {
    return 'Client Side Testing';
  }
  return row.CurrentStatus || '-';
}

function getStatusStyle(status) {
  const key = String(status || '').trim().toLowerCase();
  return STATUS_PALETTE[key] || { bg: '#F2F4F7', text: '#667085' };
}

function getTargetDateStatus(targetDate) {
  if (!targetDate) {
    return { label: 'No Target Date', bg: '#F2F4F7', text: '#667085' };
  }

  const target = safeDate(targetDate);
  if (!target) return { label: 'Invalid Date', bg: '#F2F4F7', text: '#667085' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const overdueDays = Math.floor((today - target) / 86400000);

  if (overdueDays <= 0) {
    return { label: 'Scheduled', bg: '#DCFCE7', text: '#15803D' };
  }
  if (overdueDays <= 3) {
    return { label: 'Delayed', bg: '#FEF3C7', text: '#A16207' };
  }
  return { label: 'Severely Delayed', bg: '#FEE2E2', text: '#DC2626' };
}

function getAgeing(addedDateTime, status) {
  if (!addedDateTime) return '-';
  if (String(status || '').toLowerCase() === 'closed') return 'Closed';

  const added = safeDate(addedDateTime);
  if (!added) return '-';

  const days = Math.floor((new Date() - added) / 86400000);
  return `${days} Day${days !== 1 ? 's' : ''}`;
}

function Field({ label, value, wide = false, valueStyle }) {
  return (
    <View style={[styles.field, wide && styles.fieldWide]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, valueStyle]} numberOfLines={wide ? 4 : 2}>
        {value === null || value === undefined || value === '' ? '-' : String(value)}
      </Text>
    </View>
  );
}

function Chip({ icon, children, color = COLORS.muted, background = '#F2F4F7' }) {
  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      {icon ? <Feather name={icon} size={9} color={color} /> : null}
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>{children}</Text>
    </View>
  );
}

export default function RecordCard({ row, onLongPress }) {
  const [expanded, setExpanded] = useState(false);

  const status = useMemo(() => getPriorityStatus(row), [row]);
  const statusStyle = getStatusStyle(status);
  const targetStyle = getTargetDateStatus(row?.TargetDate);

  const isCritical =
    row?.IsCriticalPoint === true ||
    row?.IsCriticalPoint === 1 ||
    String(row?.IsCriticalPoint) === '1';

  const type = String(row?.Type || row?.type || 'Story');
  const isBug = type.toLowerCase() === 'bug';

  const targetDate = row?.TargetDate ? formatDate(row.TargetDate) : 'No Target Date';

  return (
    <TouchableOpacity
      activeOpacity={0.97}
      onPress={() => setExpanded((v) => !v)}
      onLongPress={() => onLongPress?.(row)}
      delayLongPress={450}
      style={[
        styles.card,
        isCritical && styles.criticalCard,
        !isCritical && isBug && styles.bugCard,
        !isCritical && !isBug && styles.storyCard,
      ]}
    >
      {/* Front / primary information */}
      <View style={styles.topRow}>
        <View style={styles.idTypeRow}>
          <Text style={styles.idText}>#{row?.Id ?? '-'}</Text>
          <View style={[styles.typeBadge, isBug ? styles.bugBadge : styles.storyBadge]}>
            <Text style={[styles.typeText, isBug ? styles.bugText : styles.storyText]}>
              {type}
            </Text>
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]} numberOfLines={1}>
            {status}
          </Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={expanded ? 4 : 2}>
        {row?.Title || '-'}
      </Text>

      {/* Target date intentionally kept on the front of the card */}
      <View style={styles.targetRow}>
        <View style={styles.targetLeft}>
          <Feather name="calendar" size={13} color={targetStyle.text} />
          <View>
            <Text style={styles.targetLabel}>TARGET DATE</Text>
            <Text style={[styles.targetDate, { color: targetStyle.text }]}>
              {targetDate}
            </Text>
          </View>
        </View>

        <View style={[styles.targetStatusPill, { backgroundColor: targetStyle.bg }]}>
          <Text style={[styles.targetStatusText, { color: targetStyle.text }]}>
            {targetStyle.label}
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <Chip icon="box" color={COLORS.indigo} background="#EEF2FF">
          {row?.ProductName || '-'}
        </Chip>
        <Chip icon="layers" color={COLORS.purple} background="#F5F3FF">
          {row?.Sprint || '-'}
        </Chip>
      </View>

      <View style={styles.chipRow}>
        <Chip icon="user" color="#475467" background="#F2F4F7">
          {row?.ClientName || '-'}
        </Chip>
        <Chip icon="grid" color={COLORS.teal} background="#ECFDF5">
          {row?.ModuleName || '-'}
        </Chip>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Iteration: </Text>
        <View
          style={[
            styles.iterationPill,
            Number(row?.IterationCount ?? 0) <= 2
              ? { backgroundColor: '#DCFCE7', color: '#15803D' }
              : Number(row?.IterationCount ?? 0) <= 4
                ? { backgroundColor: '#FEF3C7', color: '#A16207' }
                : { backgroundColor: '#FEE2E2', color: '#DC2626' },
          ]}
        >
          <Text
            style={{
              fontSize: 8.5,
              fontWeight: '800',
              color:
                Number(row?.IterationCount ?? 0) <= 2
                  ? '#15803D'
                  : Number(row?.IterationCount ?? 0) <= 4
                    ? '#A16207'
                    : '#DC2626',
            }}
          >
            {row?.IterationCount ?? '-'}
          </Text>
        </View>

        <Text style={styles.metaSeparator}>•</Text>

        <Text style={styles.metaText}>Dev Hours: </Text>
        <Text style={styles.metaValue}>{row?.DevEfforts ?? '-'}</Text>
      </View>

      <View style={styles.expandRow}>
        <Text style={styles.expandHint}>
          {expanded ? 'Tap to collapse details' : 'Tap for all columns · Hold for actions'}
        </Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#98A2B3" />
      </View>

      {/* All web columns are available on the mobile card */}
      {expanded && (
        <View style={styles.detailsBox}>
          <Text style={styles.detailsTitle}>All Details</Text>

          <View style={styles.fieldGrid}>
            <Field label="ID" value={row?.Id} />
            <Field label="Product" value={row?.ProductName} />
            <Field label="Client" value={row?.ClientName} />
            <Field label="Module" value={row?.ModuleName} />
            <Field label="Sprint" value={row?.Sprint} />
            <Field label="Type" value={type} />
            <Field label="Status" value={status} valueStyle={{ color: statusStyle.text, fontWeight: '800' }} />
            <Field label="Iteration" value={row?.IterationCount} />
            <Field label="Dev Hours" value={row?.DevEfforts} />
            <Field label="Target Date" value={targetDate} valueStyle={{ color: targetStyle.text, fontWeight: '800' }} />
            <Field label="Current Assigned" value={row?.AssignedTo} />
            <Field label="Current Assigned Date" value={formatDateTime(row?.AssignedDate || row?.CurrentAssignedDateTime)} />
            <Field label="Opened By" value={row?.OpenedBy} />
            <Field label="Opened Date" value={formatDateTime(row?.OpenedDate)} />
            <Field label="First Dev" value={row?.FirstDevAssignedName} />
            <Field label="First Dev Date" value={formatDateTime(row?.FirstDevAssignedDateTime)} />
            <Field label="First QA" value={row?.FirstQAAssignedName} />
            <Field label="First QA Date" value={formatDateTime(row?.FirstQAAssignedDateTime)} />
            <Field label="Dev Team Lead" value={row?.DevTeamLead} />
            <Field label="Testing Lead" value={row?.TestingLead} />
            <Field label="Sprint Added" value={formatDateTime(row?.AddedDateTime)} />
            <Field label="Ageing" value={getAgeing(row?.AddedDateTime, status)} />
            <Field label="Target Date Saved By" value={row?.TargetDateSavedBy} />
            <Field label="SLA ID" value={row?.SLAId} />
            <Field label="Point Drop" value={row?.PointDrop ? 'Yes' : 'No'} />
            <Field label="Client Side Testing" value={row?.IsClientSideTesting ? 'Yes' : 'No'} />
            <Field label="Critical Point" value={isCritical ? 'Yes' : 'No'} />
          </View>

          <View style={styles.detailsTitleRow}>
            <Text style={styles.detailsTitle}>Full Title</Text>
          </View>
          <Text style={styles.fullTitle}>{row?.Title || '-'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginVertical: 3,
    padding: 9,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  storyCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  bugCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  criticalCard: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  idTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 7,
  },
  idText: {
    color: COLORS.indigo,
    fontSize: 10.5,
    fontWeight: '900',
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
  },
  storyBadge: {
    backgroundColor: '#D1FAE5',
  },
  bugBadge: {
    backgroundColor: '#FEE2E2',
  },
  typeText: {
    fontSize: 8,
    fontWeight: '900',
  },
  storyText: {
    color: '#059669',
  },
  bugText: {
    color: '#DC2626',
  },
  statusBadge: {
    maxWidth: '47%',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 7,
    fontWeight: '800',
  },
  title: {
    marginTop: 5,
    color: '#172033',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  targetRow: {
    marginTop: 6,
    minHeight: 38,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  targetLabel: {
    color: '#98A2B3',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  targetDate: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '900',
  },
  targetStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 9,
    marginLeft: 6,
  },
  targetStatusText: {
    fontSize: 7.5,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    minHeight: 23,
    borderRadius: 7,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipText: {
    flex: 1,
    fontSize: 8,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 8,
    color: '#98A2B3',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 8.5,
    color: '#475467',
    fontWeight: '800',
  },
  metaSeparator: {
    marginHorizontal: 4,
    color: '#D0D5DD',
    fontSize: 9,
  },
  iterationPill: {
    minWidth: 22,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandRow: {
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandHint: {
    color: '#98A2B3',
    fontSize: 8,
    fontStyle: 'italic',
  },
  detailsBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  detailsTitleRow: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
  },
  detailsTitle: {
    color: '#344054',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  field: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 9,
  },
  fieldWide: {
    width: '100%',
  },
  fieldLabel: {
    color: '#98A2B3',
    fontSize: 7,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 2,
  },
  fieldValue: {
    color: '#475467',
    fontSize: 10.5,
    fontWeight: '600',
    lineHeight: 15,
  },
  fullTitle: {
    color: '#344054',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
  },
});
