// import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   FlatList,
//   TextInput,
//   TouchableOpacity,
//   RefreshControl,
//   ActivityIndicator,
//   ScrollView,
//   Animated,
//   Modal,
//   Pressable,
// } from 'react-native';
// import { LinearGradient } from 'expo-linear-gradient';
// import { Feather } from '@expo/vector-icons';
// import { authFetch, authFetchJson } from '../api/authFetch';
// import { apiUrl } from '../api/config';
// import { useAuth } from '../context/AuthContext';
// import { colors, radii, shadow } from '../theme/theme';
// import { getPriorityStatus, isPatchCreatedToday } from '../utils/format';
// import RecordCard from '../components/RecordCard';
// import StatusChartModal from '../components/StatusChartModal';
// import ActionSheet from '../components/ActionSheet';

// const PAGE_SIZE = 20;
// const ADD_POINT_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];
// const SPRINT_CHANGE_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];
// const PRODUCT_MGMT_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];

// const STATUS_PALETTE = {
//   Closed: { bg: '#EEF0F4', text: '#566070' },
//   'Client Side Testing': { bg: '#FCE7F3', text: '#DB2777' },
//   'Sanity Pass': { bg: '#D1FAE5', text: '#059669' },
//   'Testing Pending': { bg: '#FCE7F3', text: '#DB2777' },
//   'Point Dropped': { bg: '#FEE2E2', text: '#DC2626' },
//   'In Observation': { bg: '#FEF3C7', text: '#D97706' },
//   'In Testing': { bg: '#CFFAFE', text: '#0891B2' },
//   'Under Development': { bg: '#E0E7FF', text: '#4F46E5' },
// };



// /* ---------- Mobile filter control ---------- */
// function MobileFilter({ label, placeholder, options = [], value, onChange, multi = false, accent = '#4F46E5' }) {
//   const [visible, setVisible] = useState(false);

//   const selectedValues = multi ? (Array.isArray(value) ? value : []) : (value ? [value] : []);
//   const selectedCount = selectedValues.length;

//   const selectedLabel = useMemo(() => {
//     if (!selectedCount) return placeholder;
//     if (!multi) {
//       const selected = options.find((x) => x.value === value);
//       return selected?.label || value;
//     }
//     if (selectedCount === 1) {
//       const selected = options.find((x) => x.value === selectedValues[0]);
//       return selected?.label || selectedValues[0];
//     }
//     return `${selectedCount} selected`;
//   }, [options, placeholder, value, selectedValues, selectedCount, multi]);

//   const toggleValue = (nextValue) => {
//     if (multi) {
//       const exists = selectedValues.includes(nextValue);
//       const next = exists
//         ? selectedValues.filter((x) => x !== nextValue)
//         : [...selectedValues, nextValue];
//       onChange(next);
//       return;
//     }
//     onChange(nextValue);
//     setVisible(false);
//   };

//   const clear = () => {
//     onChange(multi ? [] : '');
//   };

//   return (
//     <>
//       <TouchableOpacity
//         activeOpacity={0.85}
//         onPress={() => setVisible(true)}
//         style={[styles.filterButton, { borderColor: `${accent}35` }]}
//       >
//         <View style={styles.filterButtonContent}>
//           <Text style={[styles.filterLabel, { color: accent }]} numberOfLines={1}>
//             {label}
//           </Text>
//           <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
//             {selectedLabel}
//           </Text>
//         </View>
//         {selectedCount > 0 && (
//           <View style={[styles.filterCount, { backgroundColor: `${accent}15` }]}>
//             <Text style={[styles.filterCountText, { color: accent }]}>
//               {multi ? selectedCount : '✓'}
//             </Text>
//           </View>
//         )}
//         <Feather name="chevron-down" size={15} color="#667085" />
//       </TouchableOpacity>

//       <Modal
//         visible={visible}
//         transparent
//         animationType="fade"
//         onRequestClose={() => setVisible(false)}
//       >
//         <View style={styles.filterModalBackdrop}>
//           <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
//           <View style={styles.filterModalCard}>
//             <View style={styles.filterModalHeader}>
//               <View style={{ flex: 1 }}>
//                 <Text style={styles.filterModalTitle}>{label}</Text>
//                 <Text style={styles.filterModalSubtitle}>
//                   {multi ? 'Select one or more options' : 'Select an option'}
//                 </Text>
//               </View>
//               <TouchableOpacity
//                 onPress={() => setVisible(false)}
//                 style={styles.filterCloseButton}
//               >
//                 <Feather name="x" size={18} color="#344054" />
//               </TouchableOpacity>
//             </View>

//             {selectedCount > 0 && (
//               <TouchableOpacity onPress={clear} style={styles.clearFilterButton}>
//                 <Feather name="x-circle" size={14} color="#DC2626" />
//                 <Text style={styles.clearFilterText}>Clear selection</Text>
//               </TouchableOpacity>
//             )}

//             <FlatList
//               data={options}
//               keyExtractor={(item, index) => `${String(item.value)}-${index}`}
//               style={styles.filterOptionsList}
//               contentContainerStyle={{ paddingBottom: 8 }}
//               showsVerticalScrollIndicator={false}
//               ListEmptyComponent={
//                 <View style={styles.filterEmpty}>
//                   <Feather name="inbox" size={24} color="#98A2B3" />
//                   <Text style={styles.filterEmptyText}>No options available</Text>
//                 </View>
//               }
//               renderItem={({ item }) => {
//                 const checked = selectedValues.includes(item.value);
//                 return (
//                   <TouchableOpacity
//                     activeOpacity={0.8}
//                     onPress={() => toggleValue(item.value)}
//                     style={[
//                       styles.filterOption,
//                       checked && { backgroundColor: `${accent}0D`, borderColor: `${accent}35` },
//                     ]}
//                   >
//                     <View style={[styles.filterOptionIcon, checked && { backgroundColor: accent }]}>
//                       {checked ? (
//                         <Feather name="check" size={13} color="#fff" />
//                       ) : (
//                         <View style={styles.filterOptionDot} />
//                       )}
//                     </View>
//                     <Text style={styles.filterOptionText} numberOfLines={2}>
//                       {item.label}
//                     </Text>
//                     {!!item.count && (
//                       <View style={styles.optionCountBadge}>
//                         <Text style={styles.optionCountText}>{item.count}</Text>
//                       </View>
//                     )}
//                   </TouchableOpacity>
//                 );
//               }}
//             />

//             {multi && (
//               <TouchableOpacity
//                 activeOpacity={0.85}
//                 onPress={() => setVisible(false)}
//                 style={[styles.filterDoneButton, { backgroundColor: accent }]}
//               >
//                 <Text style={styles.filterDoneText}>Apply Filter</Text>
//               </TouchableOpacity>
//             )}
//           </View>
//         </View>
//       </Modal>
//     </>
//   );
// }

// /* ---------- Lead Chart Modal - mobile version of web Lead Chart ---------- */
// function LeadChartModal({
//   visible,
//   filtered = [],
//   devLeadMapping = [],
//   testingLeadMapping = [],
//   selectedSprint,
//   selectedProduct,
//   onClose,
// }) {
//   const [tab, setTab] = useState('dev');

//   const devLeadByModule = useMemo(() => {
//     const map = new Map();
//     devLeadMapping.forEach((m) => {
//       const key = String(m.ModuleId);
//       if (!map.has(key)) map.set(key, m.TeamLeadLoginName);
//     });
//     return map;
//   }, [devLeadMapping]);

//   const testingLeadByModule = useMemo(() => {
//     const map = new Map();
//     testingLeadMapping.forEach((m) => {
//       const key = String(m.ModuleId);
//       if (!map.has(key)) map.set(key, m.TestingLeadName);
//     });
//     return map;
//   }, [testingLeadMapping]);

//   const buildLeadData = useCallback((leadMap) => {
//     const map = {};
//     filtered.forEach((r) => {
//       const lead = leadMap.get(String(r.Module ?? '')) || '(Unassigned)';
//       if (!map[lead]) map[lead] = { lead, story: 0, bug: 0, other: 0, count: 0 };

//       const type = String(r.Type || r.type || '').trim().toLowerCase();
//       if (type === 'bug') map[lead].bug += 1;
//       else if (type === 'story') map[lead].story += 1;
//       else map[lead].other += 1;

//       map[lead].count += 1;
//     });

//     return Object.values(map).sort((a, b) => b.count - a.count);
//   }, [filtered]);

//   const devData = useMemo(() => buildLeadData(devLeadByModule), [buildLeadData, devLeadByModule]);
//   const testingData = useMemo(() => buildLeadData(testingLeadByModule), [buildLeadData, testingLeadByModule]);
//   const activeData = tab === 'dev' ? devData : testingData;

//   const total = filtered.length;
//   const totalStory = activeData.reduce((s, d) => s + d.story, 0);
//   const totalBug = activeData.reduce((s, d) => s + d.bug, 0);
//   const totalOther = activeData.reduce((s, d) => s + d.other, 0);
//   const maxCount = Math.max(...activeData.map((d) => d.count), 1);

//   if (!visible) return null;

//   return (
//     <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
//       <View style={styles.chartOverlay}>
//         <View style={styles.chartModalCard}>
//           <View style={styles.chartHeader}>
//             <View style={{ flex: 1 }}>
//               <Text style={styles.chartTitle}>Team Lead Breakdown</Text>
//               <Text style={styles.chartSubtitle} numberOfLines={1}>
//                 {selectedSprint || 'All Sprints'} · {selectedProduct || 'All Products'} · {total} records
//               </Text>
//             </View>
//             <TouchableOpacity style={styles.chartCloseButton} onPress={onClose}>
//               <Feather name="x" size={19} color="#667085" />
//             </TouchableOpacity>
//           </View>

//           <View style={styles.chartTabs}>
//             <TouchableOpacity
//               onPress={() => setTab('dev')}
//               style={[styles.chartTab, tab === 'dev' && styles.chartTabDevActive]}
//             >
//               <Text style={[styles.chartTabText, tab === 'dev' && styles.chartTabDevText]}>
//                 Dev Team Lead
//               </Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               onPress={() => setTab('testing')}
//               style={[styles.chartTab, tab === 'testing' && styles.chartTabTestingActive]}
//             >
//               <Text style={[styles.chartTabText, tab === 'testing' && styles.chartTabTestingText]}>
//                 Testing Lead
//               </Text>
//             </TouchableOpacity>
//           </View>

//           <View style={styles.chartLegend}>
//             <View style={styles.legendItem}>
//               <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
//               <Text style={styles.legendText}>Story: </Text>
//               <Text style={[styles.legendNumber, { color: '#4F46E5' }]}>{totalStory}</Text>
//             </View>
//             <View style={styles.legendItem}>
//               <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
//               <Text style={styles.legendText}>Bug: </Text>
//               <Text style={[styles.legendNumber, { color: '#DC2626' }]}>{totalBug}</Text>
//             </View>
//             {totalOther > 0 && (
//               <View style={styles.legendItem}>
//                 <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
//                 <Text style={styles.legendText}>Other: </Text>
//                 <Text style={styles.legendNumber}>{totalOther}</Text>
//               </View>
//             )}
//           </View>

//           <ScrollView
//             style={styles.chartScroll}
//             contentContainerStyle={{ paddingBottom: 12 }}
//             showsVerticalScrollIndicator={false}
//           >
//             {activeData.length === 0 ? (
//               <View style={styles.chartEmpty}>
//                 <Feather name="bar-chart-2" size={28} color="#98A2B3" />
//                 <Text style={styles.chartEmptyText}>No mapping data available.</Text>
//               </View>
//             ) : (
//               activeData.map(({ lead, story, bug, other, count }) => {
//                 const pct = total > 0 ? Math.round((count / total) * 100) : 0;
//                 const barWidth = Math.max((count / maxCount) * 100, 6);

//                 return (
//                   <View key={lead} style={styles.chartRow}>
//                     <View style={styles.chartRowTop}>
//                       <Text style={styles.chartName} numberOfLines={1}>{lead}</Text>
//                       <Text style={styles.chartCounts}>
//                         <Text style={{ color: '#4F46E5', fontWeight: '800' }}>{story}</Text>
//                         <Text style={{ color: '#CBD5E1' }}> / </Text>
//                         <Text style={{ color: '#DC2626', fontWeight: '800' }}>{bug}</Text>
//                         {totalOther > 0 && (
//                           <>
//                             <Text style={{ color: '#CBD5E1' }}> / </Text>
//                             <Text style={{ color: '#64748B', fontWeight: '800' }}>{other}</Text>
//                           </>
//                         )}
//                         <Text style={styles.chartPct}> {pct}%</Text>
//                       </Text>
//                     </View>

//                     <View style={styles.barTrack}>
//                       <View style={[styles.barTotal, { width: `${barWidth}%` }]}>
//                         {story > 0 && (
//                           <View
//                             style={{
//                               width: `${(story / count) * 100}%`,
//                               backgroundColor: '#6366F1',
//                             }}
//                           />
//                         )}
//                         {bug > 0 && (
//                           <View
//                             style={{
//                               width: `${(bug / count) * 100}%`,
//                               backgroundColor: '#EF4444',
//                             }}
//                           />
//                         )}
//                         {other > 0 && (
//                           <View
//                             style={{
//                               width: `${(other / count) * 100}%`,
//                               backgroundColor: '#94A3B8',
//                             }}
//                           />
//                         )}
//                       </View>
//                     </View>
//                   </View>
//                 );
//               })
//             )}

//             {activeData.length > 0 && (
//               <View style={styles.chartTable}>
//                 <View style={styles.chartTableHeader}>
//                   <Text style={[styles.chartCellLead, styles.chartHeaderText]}>
//                     {tab === 'dev' ? 'Dev Team Lead' : 'Testing Lead'}
//                   </Text>
//                   <Text style={[styles.chartCellSmall, styles.chartHeaderText]}>Story</Text>
//                   <Text style={[styles.chartCellSmall, styles.chartBugHeader]}>Bug</Text>
//                   <Text style={[styles.chartCellSmall, styles.chartHeaderText]}>Total</Text>
//                   <Text style={[styles.chartCellSmall, styles.chartHeaderText]}>Share</Text>
//                 </View>

//                 {activeData.map(({ lead, story, bug, count }) => (
//                   <View key={`table-${lead}`} style={styles.chartTableRow}>
//                     <Text style={styles.chartCellLead} numberOfLines={1}>{lead}</Text>
//                     <Text style={[styles.chartCellSmall, { color: '#4F46E5', fontWeight: '700' }]}>{story}</Text>
//                     <Text style={[styles.chartCellSmall, { color: '#DC2626', fontWeight: '700' }]}>{bug}</Text>
//                     <Text style={[styles.chartCellSmall, { color: '#172033', fontWeight: '700' }]}>{count}</Text>
//                     <Text style={styles.chartCellSmall}>
//                       {total > 0 ? Math.round((count / total) * 100) : 0}%
//                     </Text>
//                   </View>
//                 ))}

//                 <View style={styles.chartTableTotal}>
//                   <Text style={[styles.chartCellLead, { fontWeight: '800' }]}>Total</Text>
//                   <Text style={[styles.chartCellSmall, { color: '#4F46E5', fontWeight: '900' }]}>{totalStory}</Text>
//                   <Text style={[styles.chartCellSmall, { color: '#DC2626', fontWeight: '900' }]}>{totalBug}</Text>
//                   <Text style={[styles.chartCellSmall, { fontWeight: '900', color: '#172033' }]}>{total}</Text>
//                   <Text style={[styles.chartCellSmall, { fontWeight: '800' }]}>100%</Text>
//                 </View>
//               </View>
//             )}
//           </ScrollView>
//         </View>
//       </View>
//     </Modal>
//   );
// }

// /* ---------- Client Chart Modal - mobile version of web Client Chart ---------- */
// function ClientChartModal({
//   visible,
//   filtered = [],
//   selectedSprint,
//   selectedProduct,
//   onClose,
// }) {
//   const clientData = useMemo(() => {
//     const map = {};

//     filtered.forEach((r) => {
//       const client = (r.ClientName && String(r.ClientName).trim()) || '(No Client)';
//       if (!map[client]) map[client] = { client, story: 0, bug: 0, other: 0, count: 0 };

//       const type = String(r.Type || r.type || '').trim().toLowerCase();
//       if (type === 'bug') map[client].bug += 1;
//       else if (type === 'story') map[client].story += 1;
//       else map[client].other += 1;

//       map[client].count += 1;
//     });

//     return Object.values(map).sort((a, b) => b.count - a.count);
//   }, [filtered]);

//   const total = filtered.length;
//   const totalStory = clientData.reduce((s, d) => s + d.story, 0);
//   const totalBug = clientData.reduce((s, d) => s + d.bug, 0);
//   const totalOther = clientData.reduce((s, d) => s + d.other, 0);
//   const maxCount = Math.max(...clientData.map((d) => d.count), 1);

//   if (!visible) return null;

//   return (
//     <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
//       <View style={styles.chartOverlay}>
//         <View style={styles.chartModalCard}>
//           <View style={styles.chartHeader}>
//             <View style={{ flex: 1 }}>
//               <Text style={styles.chartTitle}>Client Breakdown</Text>
//               <Text style={styles.chartSubtitle} numberOfLines={1}>
//                 {selectedSprint || 'All Sprints'} · {selectedProduct || 'All Products'} · {total} records
//                 {' · '}Story {totalStory} · Bug {totalBug}
//               </Text>
//             </View>
//             <TouchableOpacity style={styles.chartCloseButton} onPress={onClose}>
//               <Feather name="x" size={19} color="#667085" />
//             </TouchableOpacity>
//           </View>

//           <View style={styles.chartLegend}>
//             <View style={styles.legendItem}>
//               <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
//               <Text style={styles.legendText}>Story</Text>
//             </View>
//             <View style={styles.legendItem}>
//               <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
//               <Text style={styles.legendText}>Bug</Text>
//             </View>
//             {totalOther > 0 && (
//               <View style={styles.legendItem}>
//                 <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
//                 <Text style={styles.legendText}>Other</Text>
//               </View>
//             )}
//           </View>

//           <ScrollView
//             style={styles.chartScroll}
//             contentContainerStyle={{ paddingBottom: 12 }}
//             showsVerticalScrollIndicator={false}
//           >
//             {clientData.length === 0 ? (
//               <View style={styles.chartEmpty}>
//                 <Feather name="users" size={28} color="#98A2B3" />
//                 <Text style={styles.chartEmptyText}>No client data available.</Text>
//               </View>
//             ) : (
//               <>
//                 <View style={styles.clientTable}>
//                   <View style={[styles.chartTableHeader, { backgroundColor: '#ECFDF5' }]}>
//                     <Text style={[styles.clientCellName, styles.chartHeaderText]}>Client</Text>
//                     <Text style={[styles.chartCellSmall, { color: '#4F46E5' }]}>Story</Text>
//                     <Text style={[styles.chartCellSmall, styles.chartBugHeader]}>Bug</Text>
//                     <Text style={[styles.chartCellSmall, { color: '#047857' }]}>Total</Text>
//                     <Text style={[styles.chartCellSmall, { color: '#047857' }]}>Share</Text>
//                   </View>

//                   {clientData.map(({ client, story, bug, count }) => (
//                     <View key={client} style={styles.chartTableRow}>
//                       <Text style={styles.clientCellName} numberOfLines={2}>{client}</Text>
//                       <Text style={[styles.chartCellSmall, { color: '#4F46E5', fontWeight: '700' }]}>{story}</Text>
//                       <Text style={[styles.chartCellSmall, { color: '#DC2626', fontWeight: '700' }]}>{bug}</Text>
//                       <Text style={[styles.chartCellSmall, { color: '#172033', fontWeight: '700' }]}>{count}</Text>
//                       <Text style={styles.chartCellSmall}>
//                         {total > 0 ? Math.round((count / total) * 100) : 0}%
//                       </Text>
//                     </View>
//                   ))}

//                   <View style={styles.chartTableTotal}>
//                     <Text style={[styles.clientCellName, { fontWeight: '800' }]}>Total</Text>
//                     <Text style={[styles.chartCellSmall, { color: '#4F46E5', fontWeight: '900' }]}>{totalStory}</Text>
//                     <Text style={[styles.chartCellSmall, { color: '#DC2626', fontWeight: '900' }]}>{totalBug}</Text>
//                     <Text style={[styles.chartCellSmall, { fontWeight: '900', color: '#172033' }]}>{total}</Text>
//                     <Text style={[styles.chartCellSmall, { fontWeight: '800' }]}>100%</Text>
//                   </View>
//                 </View>

//                 <View style={styles.clientChartSection}>
//                   {clientData.map(({ client, story, bug, other, count }) => {
//                     const pct = total > 0 ? Math.round((count / total) * 100) : 0;
//                     const barWidth = Math.max((count / maxCount) * 100, 6);

//                     return (
//                       <View key={`bar-${client}`} style={styles.chartRow}>
//                         <View style={styles.chartRowTop}>
//                           <Text style={styles.chartName} numberOfLines={1}>{client}</Text>
//                           <Text style={styles.chartCounts}>
//                             <Text style={{ color: '#4F46E5', fontWeight: '800' }}>{story}</Text>
//                             <Text style={{ color: '#CBD5E1' }}> / </Text>
//                             <Text style={{ color: '#DC2626', fontWeight: '800' }}>{bug}</Text>
//                             {totalOther > 0 && (
//                               <>
//                                 <Text style={{ color: '#CBD5E1' }}> / </Text>
//                                 <Text style={{ color: '#64748B', fontWeight: '800' }}>{other}</Text>
//                               </>
//                             )}
//                             <Text style={styles.chartPct}> {pct}%</Text>
//                           </Text>
//                         </View>

//                         <View style={styles.barTrack}>
//                           <View style={[styles.barTotal, { width: `${barWidth}%` }]}>
//                             {story > 0 && (
//                               <View style={{ width: `${(story / count) * 100}%`, backgroundColor: '#6366F1' }} />
//                             )}
//                             {bug > 0 && (
//                               <View style={{ width: `${(bug / count) * 100}%`, backgroundColor: '#EF4444' }} />
//                             )}
//                             {other > 0 && (
//                               <View style={{ width: `${(other / count) * 100}%`, backgroundColor: '#94A3B8' }} />
//                             )}
//                           </View>
//                         </View>
//                       </View>
//                     );
//                   })}
//                 </View>
//               </>
//             )}
//           </ScrollView>
//         </View>
//       </View>
//     </Modal>
//   );
// }


// export default function SprintDashboardScreen() {
//   const { session, logout } = useAuth();
//   const role = session.role || '';
//   const isTestingLead = role === 'Testing Lead';
//   const isDevTeamLead = role.trim().toLowerCase() === 'dev team lead';
//   const isProductManagement = PRODUCT_MGMT_ROLES.includes(role);

//   const [permissions, setPermissions] = useState({ IsAddPoint: false, IsPointDrop: false, IsSprintChange: false });
//   const canPointDrop = isProductManagement || permissions.IsPointDrop;
//   const canChangeSprint = SPRINT_CHANGE_ROLES.includes(role) || permissions.IsSprintChange;

//   const [allData, setAllData] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError] = useState(null);

//   const [devLeadMapping, setDevLeadMapping] = useState([]);
//   const [testingLeadMapping, setTestingLeadMapping] = useState([]);
//   const [patchCreationMap, setPatchCreationMap] = useState({});
//   const [bugAllSprints, setBugAllSprints] = useState([]);

//   const [selectedProduct, setSelectedProduct] = useState('');
//   const [selectedSprint, setSelectedSprint] = useState('');
//   const [selectedStatus, setSelectedStatus] = useState([]);
//   const [selectedClient, setSelectedClient] = useState([]);
//   const [search, setSearch] = useState('');
//   const [page, setPage] = useState(1);

//   const [showChart, setShowChart] = useState(false);
//   const [showLeadChart, setShowLeadChart] = useState(false);
//   const [showClientChart, setShowClientChart] = useState(false);
//   const [actionSheetRow, setActionSheetRow] = useState(null);
//   const [actionLoading, setActionLoading] = useState(false);
//   const [toast, setToast] = useState(null); // { type, message }

//   const toastAnim = useRef(new Animated.Value(0)).current;

//   const showToast = (type, message) => {
//     setToast({ type, message });
//     Animated.sequence([
//       Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
//       Animated.delay(2200),
//       Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
//     ]).start(() => setToast(null));
//   };

//   /* ---------- data fetching ---------- */

//   const fetchPermissions = useCallback(async () => {
//     try {
//       const data = await authFetchJson(apiUrl('permission', { userId: session.userId }));
//       if (data?.length > 0) setPermissions(data[0]);
//     } catch {
//       /* non-blocking */
//     }
//   }, [session.userId]);

//   const fetchSprintData = useCallback(async () => {
//     try {
//       const json = await authFetchJson(apiUrl('sprintData'));
//       if (!json.success) throw new Error(json.message || 'Failed to load sprint data');
//       setAllData(json.data || []);
//       setError(null);
//     } catch (err) {
//       if (err.status === 401) return logout();
//       setError(err.message);
//     }
//   }, [logout]);

//   const fetchMappings = useCallback(async () => {
//     try {
//       const [dev, test] = await Promise.all([
//         authFetchJson(apiUrl('teamLeadModuleMapping')),
//         authFetchJson(apiUrl('testingLeadModuleMapping')),
//       ]);
//       setDevLeadMapping(Array.isArray(dev) ? dev : []);
//       setTestingLeadMapping(Array.isArray(test) ? test : []);
//     } catch {
//       /* non-blocking */
//     }
//   }, []);

//   const fetchPatchDates = useCallback(async () => {
//     try {
//       const data = await authFetchJson(apiUrl('getPatchList'));
//       const map = {};
//       if (data.success) {
//         data.data.forEach((patch) => {
//           patch.PatchDetails.forEach((detail) => {
//             const id = String(detail.PointId);
//             const existing = map[id];
//             if (!existing || new Date(patch.PatchCreationDateTime) > new Date(existing)) {
//               map[id] = patch.PatchCreationDateTime;
//             }
//           });
//         });
//       }
//       setPatchCreationMap(map);
//     } catch {
//       /* non-blocking */
//     }
//   }, []);

//   const fetchBugMeta = useCallback(async () => {
//     try {
//       const data = await authFetchJson(apiUrl('getProduct'));
//       const sprints = Array.isArray(data.Sprint) ? data.Sprint.filter((x) => x.IsClosed === false) : [];
//       setBugAllSprints(sprints);
//     } catch {
//       /* non-blocking */
//     }
//   }, []);

//   const loadAll = useCallback(async () => {
//     setLoading(true);
//     await Promise.all([fetchSprintData(), fetchPermissions(), fetchMappings(), fetchPatchDates(), fetchBugMeta()]);
//     setLoading(false);
//   }, [fetchSprintData, fetchPermissions, fetchMappings, fetchPatchDates, fetchBugMeta]);

//   useEffect(() => {
//     loadAll();
//   }, []); // eslint-disable-line react-hooks/exhaustive-deps

//   const onRefresh = async () => {
//     setRefreshing(true);
//     await Promise.all([fetchSprintData(), fetchPatchDates()]);
//     setRefreshing(false);
//   };

//   /* ---------- lookup maps ---------- */

//   const devLeadByModule = useMemo(() => {
//     const map = new Map();
//     devLeadMapping.forEach((m) => {
//       const key = String(m.ModuleId);
//       if (!map.has(key)) map.set(key, m.TeamLeadLoginName);
//     });
//     return map;
//   }, [devLeadMapping]);

//   const testingLeadByModule = useMemo(() => {
//     const map = new Map();
//     testingLeadMapping.forEach((m) => {
//       const key = String(m.ModuleId);
//       if (!map.has(key)) map.set(key, m.TestingLeadName);
//     });
//     return map;
//   }, [testingLeadMapping]);

//   const patchIsTodaySet = useMemo(() => {
//     const set = new Set();
//     Object.keys(patchCreationMap).forEach((id) => {
//       if (isPatchCreatedToday(patchCreationMap[id])) set.add(id);
//     });
//     return set;
//   }, [patchCreationMap]);

//   /* ---------- derived filter option lists ---------- */

//   const products = useMemo(() => {
//     const countMap = {};
//     allData.forEach((r) => {
//       if (r.ProductName) countMap[r.ProductName] = (countMap[r.ProductName] || 0) + 1;
//     });
//     return Object.keys(countMap)
//       .sort()
//       .map((name) => ({ label: name, value: name, count: countMap[name] }));
//   }, [allData]);

//   useEffect(() => {
//     if (products.length === 0 || selectedProduct) return;
//     const histree = products.find((p) => p.value.toLowerCase() === 'histree');
//     setSelectedProduct((histree || products[0]).value);
//   }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

//   const sprints = useMemo(() => {
//     const rows = selectedProduct ? allData.filter((r) => r.ProductName === selectedProduct) : allData;
//     const set = new Set(rows.map((r) => r.Sprint).filter(Boolean));
//     return [...set].sort().map((s) => ({ label: s, value: s }));
//   }, [allData, selectedProduct]);

//   useEffect(() => {
//     if (sprints.length === 0) {
//       setSelectedSprint('');
//       return;
//     }
//     if (selectedSprint && sprints.some((s) => s.value === selectedSprint)) return;
//     setSelectedSprint(sprints[0].value);
//   }, [sprints]); // eslint-disable-line react-hooks/exhaustive-deps

//   const statuses = useMemo(() => {
//     let rows = allData;
//     if (selectedSprint) rows = rows.filter((r) => r.Sprint === selectedSprint);
//     if (selectedProduct) rows = rows.filter((r) => r.ProductName === selectedProduct);
//     const countMap = {};
//     rows.forEach((r) => {
//       const s = getPriorityStatus(r);
//       if (s && s !== '-') countMap[s] = (countMap[s] || 0) + 1;
//     });
//     return Object.keys(countMap)
//       .sort()
//       .map((status) => ({ label: status, value: status, count: countMap[status] }));
//   }, [allData, selectedSprint, selectedProduct]);

//   const clientsList = useMemo(() => {
//     let rows = allData;
//     if (selectedSprint) rows = rows.filter((r) => r.Sprint === selectedSprint);
//     if (selectedProduct) rows = rows.filter((r) => r.ProductName === selectedProduct);
//     const countMap = {};
//     rows.forEach((r) => {
//       const client = (r.ClientName && String(r.ClientName).trim()) || '';
//       if (client) countMap[client] = (countMap[client] || 0) + 1;
//     });
//     return Object.keys(countMap)
//       .sort((a, b) => a.localeCompare(b))
//       .map((client) => ({ label: client, value: client, count: countMap[client] }));
//   }, [allData, selectedSprint, selectedProduct]);

//   /* ---------- filtering ---------- */

//   const filtered = useMemo(() => {
//     let rows = allData;
//     if (selectedProduct) rows = rows.filter((r) => r.ProductName === selectedProduct);
//     if (selectedSprint) rows = rows.filter((r) => r.Sprint === selectedSprint);

//     if (search.trim()) {
//       const q = search.toLowerCase();
//       rows = rows.filter(
//         (r) =>
//           String(r.Id ?? '').includes(q) ||
//           String(r.Title ?? '').toLowerCase().includes(q) ||
//           String(r.ClientName ?? '').toLowerCase().includes(q) ||
//           String(r.ModuleName ?? '').toLowerCase().includes(q) ||
//           String(r.AssignedTo ?? '').toLowerCase().includes(q)
//       );
//     }

//     if (selectedStatus.length > 0) rows = rows.filter((r) => selectedStatus.includes(getPriorityStatus(r)));
//     if (selectedClient.length > 0) rows = rows.filter((r) => selectedClient.includes(r.ClientName));

//     rows = [...rows].sort((a, b) => {
//       const aToday = patchIsTodaySet.has(String(a.Id));
//       const bToday = patchIsTodaySet.has(String(b.Id));
//       if (aToday === bToday) return 0;
//       return aToday ? 1 : -1;
//     });

//     return rows.map((r) => ({
//       ...r,
//       DevTeamLead: devLeadByModule.get(String(r.Module)) || '',
//       TestingLead: testingLeadByModule.get(String(r.Module)) || '',
//     }));
//   }, [
//     allData,
//     selectedProduct,
//     selectedSprint,
//     search,
//     selectedStatus,
//     selectedClient,
//     patchIsTodaySet,
//     devLeadByModule,
//     testingLeadByModule,
//   ]);

//   useEffect(() => setPage(1), [selectedProduct, selectedSprint, selectedStatus, selectedClient, search]);

//   const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
//   const pageRows = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

//   const statusCounts = useMemo(() => {
//     const map = {};
//     filtered.forEach((r) => {
//       const s = getPriorityStatus(r);
//       if (s && s !== '-') map[s] = (map[s] || 0) + 1;
//     });
//     return Object.entries(map)
//       .sort((a, b) => b[1] - a[1])
//       .slice(0, 6);
//   }, [filtered]);

//   /* ---------- point actions (mirrors web UpdateSprintClientSideTesting) ---------- */

//   const runPointAction = async (row, { sprintId = 0, actionType }) => {
//     setActionLoading(true);
//     try {
//       const url = apiUrl('updateSprintClientSideTesting', {
//         ids: row.SLAId,
//         operatorId: session.userId,
//         isPointDroporSprintChange: actionType,
//         sprintId,
//       });
//       const res = await authFetch(url, { method: 'POST' });
//       if (!res.ok) throw new Error(`Server returned ${res.status}`);
//       const result = await res.text();
//       showToast('success', result || 'Action completed successfully!');
//       fetchSprintData();
//     } catch (err) {
//       showToast('error', err.message || 'Action failed');
//     } finally {
//       setActionLoading(false);
//     }
//   };

//   const openActions = (row) => setActionSheetRow(row);

//   const buildActions = (row) => {
//     if (!row) return [];
//     const actions = [];
//     const hasClientSideTesting = row.IsClientSideTesting === true;
//     const hasPointDrop = row.PointDrop === true;

//     if (isTestingLead) {
//       actions.push(
//         hasClientSideTesting
//           ? { key: 'removeCST', label: 'Remove Client Side Testing', icon: 'user-x', onPress: () => runPointAction(row, { actionType: 1 }) }
//           : { key: 'markCST', label: 'Mark Client Side Testing', icon: 'user-check', onPress: () => runPointAction(row, { actionType: 1 }) }
//       );
//     }
//     if (canPointDrop) {
//       actions.push(
//         hasPointDrop
//           ? { key: 'revertDrop', label: 'Revert Point Drop', icon: 'rotate-ccw', onPress: () => runPointAction(row, { actionType: 2 }) }
//           : { key: 'drop', label: 'Point Drop', icon: 'x-circle', danger: true, onPress: () => runPointAction(row, { actionType: 2 }) }
//       );
//     }
//     if (canChangeSprint) {
//       const productSprints = bugAllSprints.filter((s) => String(s.ProductId) === String(row.Product));
//       const first = productSprints[0];
//       actions.push({
//         key: 'changeSprint',
//         label: first ? `Move to "${first.SprintName}"` : 'Sprint Change (no sprints found)',
//         icon: 'shuffle',
//         onPress: () => first && runPointAction(row, { actionType: 3, sprintId: first.ID }),
//       });
//     }
//     return actions;
//   };

//   /* ---------- render ---------- */

//   const selectedProductLabel = selectedProduct || 'All Products';
//   const selectedSprintLabel = selectedSprint || 'All Sprints';

//   return (
//     <View style={styles.root}>
//       <LinearGradient colors={['#151A35', '#29315C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
//         <View style={styles.headerTopRow}>
//           <View>
//             <Text style={styles.headerTitle}>Sprint Dashboard</Text>
//             <Text style={styles.headerSubtitle}>
//               {session.realName ? `Hi, ${session.realName}` : ''}
//             </Text>
//           </View>
//           <View style={styles.headerActions}>
//            <TouchableOpacity style={styles.headerIconBtn} onPress={() => loadAll()}>
//               {loading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="refresh-cw" size={16} color="#fff" />}
//             </TouchableOpacity>
//             <TouchableOpacity style={styles.headerIconBtn} onPress={logout}>
//               <Feather name="log-out" size={16} color="#fff" />
//             </TouchableOpacity>
//           </View>
//         </View>

//         <View style={styles.searchBox}>
//           <Feather name="search" size={14} color="rgba(255,255,255,0.8)" />
//           <TextInput
//             value={search}
//             onChangeText={setSearch}
//             placeholder="Search ID, title, client, module..."
//             placeholderTextColor="rgba(255,255,255,0.7)"
//             style={styles.searchInput}
//           />
//           {!!search && (
//             <TouchableOpacity onPress={() => setSearch('')}>
//               <Feather name="x" size={14} color="rgba(255,255,255,0.8)" />
//             </TouchableOpacity>
//           )}
//         </View>
//       </LinearGradient>

//       <View style={styles.filterSection}>
//         <ScrollView
//           horizontal
//           showsHorizontalScrollIndicator={false}
//           contentContainerStyle={styles.filterScrollContent}
//         >
//           <MobileFilter
//             label="Product"
//             placeholder="All Products"
//             options={products}
//             value={selectedProduct}
//             onChange={setSelectedProduct}
//             accent="#4F46E5"
//           />
//           <MobileFilter
//             label="Sprint"
//             placeholder="All Sprints"
//             options={sprints}
//             value={selectedSprint}
//             onChange={setSelectedSprint}
//             accent="#7C3AED"
//           />
//           <MobileFilter
//             label="Status"
//             placeholder="All Statuses"
//             options={statuses}
//             value={selectedStatus}
//             onChange={setSelectedStatus}
//             multi
//             accent="#F59E0B"
//           />
//           <MobileFilter
//             label="Client"
//             placeholder="All Clients"
//             options={clientsList}
//             value={selectedClient}
//             onChange={setSelectedClient}
//             multi
//             accent="#10B981"
//           />
//         </ScrollView>
//       </View>

//       {!loading && !error && (
//         <View style={styles.statsStrip}>
//           <Text style={styles.statsText}>
//             <Text style={{ fontWeight: '700', color: colors.text }}>{filtered.length}</Text> record{filtered.length !== 1 ? 's' : ''} ·{' '}
//             {selectedSprintLabel} · {selectedProductLabel}
//           </Text>
//           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChipScroll}>
//             {statusCounts.map(([s, c]) => {
//               const palette = STATUS_PALETTE[s] || { bg: '#EEF0F4', text: '#566070' };
//               return (
//                 <View key={s} style={[styles.statusChip, { backgroundColor: palette.bg }]}>
//                   <Text style={[styles.statusChipText, { color: palette.text }]} numberOfLines={1}>
//                     {s}
//                   </Text>
//                   <Text style={[styles.statusChipCount, { color: palette.text }]}>{c}</Text>
//                 </View>
//               );
//             })}
//           </ScrollView>
//         </View>
//       )}

//       {!loading && !error && (
//         <View style={styles.chartActionRow}>
//           <TouchableOpacity
//             style={[styles.chartActionButton, { backgroundColor: '#6366F1' }]}
//             onPress={() => setShowLeadChart(true)}
//             disabled={filtered.length === 0}
//           >
//             <Feather name="bar-chart-2" size={13} color="#fff" />
//             <Text style={styles.chartActionText}>Lead Chart</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[styles.chartActionButton, { backgroundColor: '#0D9488' }]}
//             onPress={() => setShowClientChart(true)}
//             disabled={filtered.length === 0}
//           >
//             <Feather name="bar-chart-2" size={13} color="#fff" />
//             <Text style={styles.chartActionText}>Client Chart</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[styles.chartActionButton, { backgroundColor: '#7C3AED' }]}
//             onPress={() => setShowChart(true)}
//             disabled={filtered.length === 0}
//           >
//             <Feather name="bar-chart-2" size={13} color="#fff" />
//             <Text style={styles.chartActionText}>Chart</Text>
//           </TouchableOpacity>
//         </View>
//       )}

//       {loading && (
//         <View style={styles.centerFill}>
//           <ActivityIndicator size="large" color={colors.primary} />
//           <Text style={styles.loadingText}>Loading sprint data…</Text>
//         </View>
//       )}

//       {!!error && !loading && (
//         <View style={styles.errorBanner}>
//           <Feather name="alert-circle" size={16} color={colors.red} />
//           <Text style={styles.errorBannerText}>{error}</Text>
//         </View>
//       )}

//       {!loading && !error && (
//         <FlatList
//           data={pageRows}
//           keyExtractor={(item, idx) => `${item.Id}-${idx}`}
//           renderItem={({ item }) => <RecordCard row={item} onLongPress={openActions} />}
//           style={{ flex: 1 }}
//           contentContainerStyle={{ paddingTop: 3, paddingBottom: 18 }}
//           refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
//           onEndReachedThreshold={0.4}
//           onEndReached={() => {
//             if (page < totalPages) setPage((p) => p + 1);
//           }}
//           ListFooterComponent={
//             page < totalPages ? (
//               <View style={styles.loadMoreWrap}>
//                 <ActivityIndicator size="small" color={colors.primary} />
//                 <Text style={styles.loadMoreText}>Loading more…</Text>
//               </View>
//             ) : null
//           }
//           ListEmptyComponent={
//             <View style={styles.centerFill}>
//               <Feather name="inbox" size={28} color={colors.textFaint} />
//               <Text style={styles.emptyText}>No records found for the selected filters.</Text>
//             </View>
//           }
//         />
//       )}

//       <LeadChartModal
//         visible={showLeadChart}
//         filtered={filtered}
//         devLeadMapping={devLeadMapping}
//         testingLeadMapping={testingLeadMapping}
//         selectedSprint={selectedSprintLabel}
//         selectedProduct={selectedProductLabel}
//         onClose={() => setShowLeadChart(false)}
//       />

//       <ClientChartModal
//         visible={showClientChart}
//         filtered={filtered}
//         selectedSprint={selectedSprintLabel}
//         selectedProduct={selectedProductLabel}
//         onClose={() => setShowClientChart(false)}
//       />

//       <StatusChartModal
//         visible={showChart}
//         onClose={() => setShowChart(false)}
//         filtered={filtered}
//         sprintLabel={selectedSprintLabel}
//         productLabel={selectedProductLabel}
//       />

//       <ActionSheet
//         visible={!!actionSheetRow}
//         title={actionSheetRow ? `Point #${actionSheetRow.Id}` : ''}
//         subtitle={actionSheetRow?.Title}
//         actions={buildActions(actionSheetRow)}
//         onClose={() => setActionSheetRow(null)}
//       />

//       {actionLoading && (
//         <View style={styles.actionLoadingOverlay}>
//           <ActivityIndicator size="large" color="#fff" />
//         </View>
//       )}

//       {toast && (
//         <Animated.View
//           style={[
//             styles.toast,
//             toast.type === 'success' ? styles.toastSuccess : styles.toastError,
//             {
//               opacity: toastAnim,
//               transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
//             },
//           ]}
//         >
//           <Feather name={toast.type === 'success' ? 'check-circle' : 'alert-circle'} size={15} color="#fff" />
//           <Text style={styles.toastText} numberOfLines={2}>
//             {toast.message}
//           </Text>
//         </Animated.View>
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   root: { flex: 1, backgroundColor: '#F7F8FC' },
//   header: { paddingTop: 54, paddingBottom: 16, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
//   headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
//   headerTitle: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: 0.1 },
//   headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginTop: 2 },
//   headerActions: { flexDirection: 'row', gap: 8 },
//   headerIconBtn: {
//     width: 34,
//     height: 34,
//     borderRadius: 17,
//     backgroundColor: 'rgba(255,255,255,0.18)',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   searchBox: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     backgroundColor: 'rgba(255,255,255,0.16)',
//     borderRadius: radii.md,
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//   },
//   searchInput: { flex: 1, color: '#fff', fontSize: 13, padding: 0 },

//   filterSection: {
//     backgroundColor: '#F7F8FC',
//     paddingTop: 10,
//     paddingBottom: 5,
//   },
//   filterScrollContent: {
//     paddingHorizontal: 12,
//     gap: 8,
//   },
//   filterButton: {
//     width: 150,
//     minHeight: 48,
//     borderRadius: 13,
//     backgroundColor: '#FFFFFF',
//     borderWidth: 1,
//     paddingHorizontal: 11,
//     flexDirection: 'row',
//     alignItems: 'center',
//     shadowColor: '#101828',
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.06,
//     shadowRadius: 3,
//     elevation: 2,
//   },
//   filterButtonContent: { flex: 1, marginRight: 5 },
//   filterLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
//   filterValue: { fontSize: 12, fontWeight: '700', color: '#20263A' },
//   filterCount: { minWidth: 21, height: 21, paddingHorizontal: 5, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
//   filterCountText: { fontSize: 9, fontWeight: '800' },
//   filterModalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.48)', justifyContent: 'flex-end' },
//   filterModalCard: { maxHeight: '78%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
//   filterModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
//   filterModalTitle: { fontSize: 17, fontWeight: '800', color: '#172033' },
//   filterModalSubtitle: { fontSize: 11, color: '#667085', marginTop: 3 },
//   filterCloseButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
//   clearFilterButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, marginBottom: 5 },
//   clearFilterText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },
//   filterOptionsList: { marginTop: 3 },
//   filterOption: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 7 },
//   filterOptionIcon: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
//   filterOptionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D0D5DD' },
//   filterOptionText: { flex: 1, color: '#344054', fontSize: 12, fontWeight: '600' },
//   optionCountBadge: { minWidth: 26, paddingHorizontal: 7, height: 23, borderRadius: 12, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
//   optionCountText: { fontSize: 10, color: '#667085', fontWeight: '800' },
//   filterDoneButton: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
//   filterDoneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
//   filterEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 35 },
//   filterEmptyText: { marginTop: 8, color: '#98A2B3', fontSize: 12 },

//   statsStrip: { paddingHorizontal: 12, paddingVertical: 5, gap: 4, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EAECF0' },
//   statsText: { fontSize: 10.5, lineHeight: 14, color: '#667085' },
//   statusChipScroll: { paddingTop: 2, paddingBottom: 1 },
//   statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 16, marginRight: 5 },
//   statusChipText: { fontSize: 8.5, fontWeight: '700' },
//   statusChipCount: { fontSize: 9, fontWeight: '900', marginLeft: 3 },

//   chartActionRow: {
//     height: 43,
//     paddingHorizontal: 12,
//     paddingVertical: 4,
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 7,
//     backgroundColor: '#FFFFFF',
//     borderBottomWidth: 1,
//     borderBottomColor: '#EAECF0',
//   },
//   chartActionButton: {
//     height: 34,
//     flex: 1,
//     minWidth: 0,
//     borderRadius: 9,
//     paddingHorizontal: 7,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 5,
//     elevation: 1,
//   },
//   chartActionText: {
//     color: '#fff',
//     fontSize: 10,
//     fontWeight: '800',
//   },

//   chartOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(15, 23, 42, 0.58)',
//     justifyContent: 'center',
//     paddingHorizontal: 12,
//   },
//   chartModalCard: {
//     width: '100%',
//     maxHeight: '91%',
//     backgroundColor: '#fff',
//     borderRadius: 20,
//     overflow: 'hidden',
//     elevation: 12,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 8 },
//     shadowOpacity: 0.18,
//     shadowRadius: 18,
//   },
//   chartHeader: {
//     minHeight: 62,
//     paddingHorizontal: 16,
//     paddingVertical: 11,
//     borderBottomWidth: 1,
//     borderBottomColor: '#EAECF0',
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   chartTitle: {
//     fontSize: 17,
//     fontWeight: '800',
//     color: '#172033',
//   },
//   chartSubtitle: {
//     marginTop: 3,
//     fontSize: 10,
//     color: '#98A2B3',
//   },
//   chartCloseButton: {
//     width: 34,
//     height: 34,
//     borderRadius: 17,
//     backgroundColor: '#F2F4F7',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginLeft: 8,
//   },
//   chartTabs: {
//     flexDirection: 'row',
//     paddingHorizontal: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: '#EAECF0',
//   },
//   chartTab: {
//     paddingTop: 12,
//     paddingBottom: 10,
//     marginRight: 20,
//     borderBottomWidth: 2,
//     borderBottomColor: 'transparent',
//   },
//   chartTabDevActive: { borderBottomColor: '#6366F1' },
//   chartTabTestingActive: { borderBottomColor: '#7C3AED' },
//   chartTabText: {
//     fontSize: 11.5,
//     fontWeight: '700',
//     color: '#98A2B3',
//   },
//   chartTabDevText: { color: '#4F46E5' },
//   chartTabTestingText: { color: '#7C3AED' },

//   chartLegend: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flexWrap: 'wrap',
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     gap: 14,
//   },
//   legendItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   legendDot: {
//     width: 9,
//     height: 9,
//     borderRadius: 2,
//     marginRight: 5,
//   },
//   legendText: {
//     fontSize: 10.5,
//     color: '#667085',
//   },
//   legendNumber: {
//     fontSize: 11,
//     fontWeight: '800',
//   },
//   chartScroll: {
//     paddingHorizontal: 14,
//   },
//   chartRow: {
//     marginBottom: 9,
//   },
//   chartRowTop: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 4,
//   },
//   chartName: {
//     flex: 1,
//     minWidth: 0,
//     fontSize: 10.5,
//     fontWeight: '600',
//     color: '#475467',
//   },
//   chartCounts: {
//     width: 88,
//     textAlign: 'right',
//     fontSize: 10,
//   },
//   chartPct: {
//     color: '#98A2B3',
//     fontWeight: '600',
//   },
//   barTrack: {
//     height: 16,
//     backgroundColor: '#F2F4F7',
//     borderRadius: 9,
//     overflow: 'hidden',
//   },
//   barTotal: {
//     height: 16,
//     minWidth: 26,
//     flexDirection: 'row',
//     borderRadius: 9,
//     overflow: 'hidden',
//   },
//   chartEmpty: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 45,
//   },
//   chartEmptyText: {
//     marginTop: 8,
//     color: '#98A2B3',
//     fontSize: 12,
//   },
//   chartTable: {
//     marginTop: 8,
//     marginBottom: 6,
//     borderWidth: 1,
//     borderColor: '#EAECF0',
//     borderRadius: 10,
//     overflow: 'hidden',
//   },
//   clientTable: {
//     borderWidth: 1,
//     borderColor: '#EAECF0',
//     borderRadius: 10,
//     overflow: 'hidden',
//   },
//   clientChartSection: {
//     marginTop: 14,
//     paddingBottom: 10,
//   },
//   chartTableHeader: {
//     minHeight: 36,
//     backgroundColor: '#EEF2FF',
//     borderBottomWidth: 1,
//     borderBottomColor: '#D9DDF8',
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 7,
//   },
//   chartTableRow: {
//     minHeight: 34,
//     borderBottomWidth: 1,
//     borderBottomColor: '#F2F4F7',
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 7,
//   },
//   chartTableTotal: {
//     minHeight: 36,
//     backgroundColor: '#F8FAFC',
//     borderTopWidth: 2,
//     borderTopColor: '#D0D5DD',
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 7,
//   },
//   chartCellLead: {
//     flex: 1,
//     minWidth: 0,
//     fontSize: 10,
//     color: '#475467',
//   },
//   clientCellName: {
//     flex: 1,
//     minWidth: 0,
//     fontSize: 10,
//     color: '#475467',
//     paddingRight: 4,
//   },
//   chartCellSmall: {
//     width: 42,
//     textAlign: 'right',
//     fontSize: 9.5,
//     color: '#667085',
//   },
//   chartHeaderText: {
//     color: '#4F46E5',
//     fontWeight: '800',
//   },
//   chartBugHeader: {
//     color: '#DC2626',
//     fontWeight: '800',
//   },

//   centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
//   loadingText: { color: colors.textMuted, fontSize: 13 },
//   emptyText: { color: colors.textFaint, fontSize: 13 },

//   errorBanner: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     backgroundColor: colors.redSoft,
//     borderRadius: radii.md,
//     marginHorizontal: 14,
//     marginTop: 10,
//     padding: 12,
//   },
//   errorBannerText: { color: colors.red, fontSize: 12.5, flex: 1 },

//   loadMoreWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
//   loadMoreText: { fontSize: 12, color: colors.textMuted },

//   actionLoadingOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     backgroundColor: 'rgba(15,17,30,0.35)',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   toast: {
//     position: 'absolute',
//     bottom: 24,
//     left: 16,
//     right: 16,
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     borderRadius: radii.md,
//     padding: 14,
//     ...shadow.modal,
//   },
//   toastSuccess: { backgroundColor: colors.emerald },
//   toastError: { backgroundColor: colors.red },
//   toastText: { color: '#fff', fontSize: 12.5, flex: 1, fontWeight: '600' },
// });

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { authFetch, authFetchJson } from '../api/authFetch';
import { apiUrl } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { colors, radii, shadow } from '../theme/theme';
import { getPriorityStatus, isPatchCreatedToday } from '../utils/format';
import RecordCard from '../components/RecordCard';
import StatusChartModal from '../components/StatusChartModal';
import ActionSheet from '../components/ActionSheet';

const PAGE_SIZE = 20;
const ADD_POINT_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];
const SPRINT_CHANGE_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];
const PRODUCT_MGMT_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];

const STATUS_PALETTE = {
  Closed: { bg: '#EEF0F4', text: '#566070' },
  'Client Side Testing': { bg: '#FCE7F3', text: '#DB2777' },
  'Sanity Pass': { bg: '#D1FAE5', text: '#059669' },
  'Testing Pending': { bg: '#FCE7F3', text: '#DB2777' },
  'Point Dropped': { bg: '#FEE2E2', text: '#DC2626' },
  'In Observation': { bg: '#FEF3C7', text: '#D97706' },
  'In Testing': { bg: '#CFFAFE', text: '#0891B2' },
  'Under Development': { bg: '#E0E7FF', text: '#4F46E5' },
};



/* ---------- Mobile filter control ---------- */
function MobileFilter({ label, placeholder, options = [], value, onChange, multi = false, accent = '#4F46E5' }) {
  const [visible, setVisible] = useState(false);

  const selectedValues = multi ? (Array.isArray(value) ? value : []) : (value ? [value] : []);
  const selectedCount = selectedValues.length;

  const selectedLabel = useMemo(() => {
    if (!selectedCount) return placeholder;
    if (!multi) {
      const selected = options.find((x) => x.value === value);
      return selected?.label || value;
    }
    if (selectedCount === 1) {
      const selected = options.find((x) => x.value === selectedValues[0]);
      return selected?.label || selectedValues[0];
    }
    return `${selectedCount} selected`;
  }, [options, placeholder, value, selectedValues, selectedCount, multi]);

  const toggleValue = (nextValue) => {
    if (multi) {
      const exists = selectedValues.includes(nextValue);
      const next = exists
        ? selectedValues.filter((x) => x !== nextValue)
        : [...selectedValues, nextValue];
      onChange(next);
      return;
    }
    onChange(nextValue);
    setVisible(false);
  };

  const clear = () => {
    onChange(multi ? [] : '');
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setVisible(true)}
        style={[styles.filterButton, { borderColor: `${accent}35` }]}
      >
        <View style={styles.filterButtonContent}>
          <Text style={[styles.filterLabel, { color: accent }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
            {selectedLabel}
          </Text>
        </View>
        {selectedCount > 0 && (
          <View style={[styles.filterCount, { backgroundColor: `${accent}15` }]}>
            <Text style={[styles.filterCountText, { color: accent }]}>
              {multi ? selectedCount : '✓'}
            </Text>
          </View>
        )}
        <Feather name="chevron-down" size={15} color="#667085" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.filterModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
          <View style={styles.filterModalCard}>
            <View style={styles.filterModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.filterModalTitle}>{label}</Text>
                <Text style={styles.filterModalSubtitle}>
                  {multi ? 'Select one or more options' : 'Select an option'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={styles.filterCloseButton}
              >
                <Feather name="x" size={18} color="#344054" />
              </TouchableOpacity>
            </View>

            {selectedCount > 0 && (
              <TouchableOpacity onPress={clear} style={styles.clearFilterButton}>
                <Feather name="x-circle" size={14} color="#DC2626" />
                <Text style={styles.clearFilterText}>Clear selection</Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={options}
              keyExtractor={(item, index) => `${String(item.value)}-${index}`}
              style={styles.filterOptionsList}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.filterEmpty}>
                  <Feather name="inbox" size={24} color="#98A2B3" />
                  <Text style={styles.filterEmptyText}>No options available</Text>
                </View>
              }
              renderItem={({ item }) => {
                const checked = selectedValues.includes(item.value);
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => toggleValue(item.value)}
                    style={[
                      styles.filterOption,
                      checked && { backgroundColor: `${accent}0D`, borderColor: `${accent}35` },
                    ]}
                  >
                    <View style={[styles.filterOptionIcon, checked && { backgroundColor: accent }]}>
                      {checked ? (
                        <Feather name="check" size={13} color="#fff" />
                      ) : (
                        <View style={styles.filterOptionDot} />
                      )}
                    </View>
                    <Text style={styles.filterOptionText} numberOfLines={2}>
                      {item.label}
                    </Text>
                    {!!item.count && (
                      <View style={styles.optionCountBadge}>
                        <Text style={styles.optionCountText}>{item.count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />

            {multi && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setVisible(false)}
                style={[styles.filterDoneButton, { backgroundColor: accent }]}
              >
                <Text style={styles.filterDoneText}>Apply Filter</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ---------- Lead Chart Modal - mobile version of web Lead Chart ---------- */
function LeadChartModal({
  visible,
  filtered = [],
  devLeadMapping = [],
  testingLeadMapping = [],
  selectedSprint,
  selectedProduct,
  onClose,
}) {
  const [tab, setTab] = useState('dev');

  const devLeadByModule = useMemo(() => {
    const map = new Map();
    devLeadMapping.forEach((m) => {
      const key = String(m.ModuleId);
      if (!map.has(key)) map.set(key, m.TeamLeadLoginName);
    });
    return map;
  }, [devLeadMapping]);

  const testingLeadByModule = useMemo(() => {
    const map = new Map();
    testingLeadMapping.forEach((m) => {
      const key = String(m.ModuleId);
      if (!map.has(key)) map.set(key, m.TestingLeadName);
    });
    return map;
  }, [testingLeadMapping]);

  const buildLeadData = useCallback((leadMap) => {
    const map = {};
    filtered.forEach((r) => {
      const lead = leadMap.get(String(r.Module ?? '')) || '(Unassigned)';
      if (!map[lead]) map[lead] = { lead, story: 0, bug: 0, other: 0, count: 0 };

      const type = String(r.Type || r.type || '').trim().toLowerCase();
      if (type === 'bug') map[lead].bug += 1;
      else if (type === 'story') map[lead].story += 1;
      else map[lead].other += 1;

      map[lead].count += 1;
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const devData = useMemo(() => buildLeadData(devLeadByModule), [buildLeadData, devLeadByModule]);
  const testingData = useMemo(() => buildLeadData(testingLeadByModule), [buildLeadData, testingLeadByModule]);
  const activeData = tab === 'dev' ? devData : testingData;

  const total = filtered.length;
  const totalStory = activeData.reduce((s, d) => s + d.story, 0);
  const totalBug = activeData.reduce((s, d) => s + d.bug, 0);
  const totalOther = activeData.reduce((s, d) => s + d.other, 0);
  const maxCount = Math.max(...activeData.map((d) => d.count), 1);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.chartOverlay}>
        <View style={styles.chartModalCard}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.chartTitle}>Team Lead Breakdown</Text>
              <Text style={styles.chartSubtitle} numberOfLines={1}>
                {selectedSprint || 'All Sprints'} · {selectedProduct || 'All Products'} · {total} records
              </Text>
            </View>
            <TouchableOpacity style={styles.chartCloseButton} onPress={onClose}>
              <Feather name="x" size={19} color="#667085" />
            </TouchableOpacity>
          </View>

          <View style={styles.chartTabs}>
            <TouchableOpacity
              onPress={() => setTab('dev')}
              style={[styles.chartTab, tab === 'dev' && styles.chartTabDevActive]}
            >
              <Text style={[styles.chartTabText, tab === 'dev' && styles.chartTabDevText]}>
                Dev Team Lead
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTab('testing')}
              style={[styles.chartTab, tab === 'testing' && styles.chartTabTestingActive]}
            >
              <Text style={[styles.chartTabText, tab === 'testing' && styles.chartTabTestingText]}>
                Testing Lead
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
              <Text style={styles.legendText}>Story: </Text>
              <Text style={[styles.legendNumber, { color: '#4F46E5' }]}>{totalStory}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Bug: </Text>
              <Text style={[styles.legendNumber, { color: '#DC2626' }]}>{totalBug}</Text>
            </View>
            {totalOther > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.legendText}>Other: </Text>
                <Text style={styles.legendNumber}>{totalOther}</Text>
              </View>
            )}
          </View>

          <ScrollView
            style={styles.chartScroll}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {activeData.length === 0 ? (
              <View style={styles.chartEmpty}>
                <Feather name="bar-chart-2" size={28} color="#98A2B3" />
                <Text style={styles.chartEmptyText}>No mapping data available.</Text>
              </View>
            ) : (
              activeData.map(({ lead, story, bug, other, count }) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const barWidth = Math.max((count / maxCount) * 100, 6);

                return (
                  <View key={lead} style={styles.chartRow}>
                    <View style={styles.chartRowTop}>
                      <Text style={styles.chartName} numberOfLines={1}>{lead}</Text>
                      <Text style={styles.chartCounts}>
                        <Text style={{ color: '#4F46E5', fontWeight: '800' }}>{story}</Text>
                        <Text style={{ color: '#CBD5E1' }}> / </Text>
                        <Text style={{ color: '#DC2626', fontWeight: '800' }}>{bug}</Text>
                        {totalOther > 0 && (
                          <>
                            <Text style={{ color: '#CBD5E1' }}> / </Text>
                            <Text style={{ color: '#64748B', fontWeight: '800' }}>{other}</Text>
                          </>
                        )}
                        <Text style={styles.chartPct}> {pct}%</Text>
                      </Text>
                    </View>

                    <View style={styles.barTrack}>
                      <View style={[styles.barTotal, { width: `${barWidth}%` }]}>
                        {story > 0 && (
                          <View
                            style={{
                              width: `${(story / count) * 100}%`,
                              backgroundColor: '#6366F1',
                            }}
                          />
                        )}
                        {bug > 0 && (
                          <View
                            style={{
                              width: `${(bug / count) * 100}%`,
                              backgroundColor: '#EF4444',
                            }}
                          />
                        )}
                        {other > 0 && (
                          <View
                            style={{
                              width: `${(other / count) * 100}%`,
                              backgroundColor: '#94A3B8',
                            }}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            {activeData.length > 0 && (
              <View style={styles.chartTable}>
                <View style={styles.chartTableHeader}>
                  <Text style={[styles.chartCellLead, styles.chartHeaderText]}>
                    {tab === 'dev' ? 'Dev Team Lead' : 'Testing Lead'}
                  </Text>
                  <Text style={[styles.chartCellSmall, styles.chartHeaderText]}>Story</Text>
                  <Text style={[styles.chartCellSmall, styles.chartBugHeader]}>Bug</Text>
                  <Text style={[styles.chartCellSmall, styles.chartHeaderText]}>Total</Text>
                  <Text style={[styles.chartCellSmall, styles.chartHeaderText]}>Share</Text>
                </View>

                {activeData.map(({ lead, story, bug, count }) => (
                  <View key={`table-${lead}`} style={styles.chartTableRow}>
                    <Text style={styles.chartCellLead} numberOfLines={1}>{lead}</Text>
                    <Text style={[styles.chartCellSmall, { color: '#4F46E5', fontWeight: '700' }]}>{story}</Text>
                    <Text style={[styles.chartCellSmall, { color: '#DC2626', fontWeight: '700' }]}>{bug}</Text>
                    <Text style={[styles.chartCellSmall, { color: '#172033', fontWeight: '700' }]}>{count}</Text>
                    <Text style={styles.chartCellSmall}>
                      {total > 0 ? Math.round((count / total) * 100) : 0}%
                    </Text>
                  </View>
                ))}

                <View style={styles.chartTableTotal}>
                  <Text style={[styles.chartCellLead, { fontWeight: '800' }]}>Total</Text>
                  <Text style={[styles.chartCellSmall, { color: '#4F46E5', fontWeight: '900' }]}>{totalStory}</Text>
                  <Text style={[styles.chartCellSmall, { color: '#DC2626', fontWeight: '900' }]}>{totalBug}</Text>
                  <Text style={[styles.chartCellSmall, { fontWeight: '900', color: '#172033' }]}>{total}</Text>
                  <Text style={[styles.chartCellSmall, { fontWeight: '800' }]}>100%</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Client Chart Modal - mobile version of web Client Chart ---------- */
function ClientChartModal({
  visible,
  filtered = [],
  selectedSprint,
  selectedProduct,
  onClose,
}) {
  const clientData = useMemo(() => {
    const map = {};

    filtered.forEach((r) => {
      const client = (r.ClientName && String(r.ClientName).trim()) || '(No Client)';
      if (!map[client]) map[client] = { client, story: 0, bug: 0, other: 0, count: 0 };

      const type = String(r.Type || r.type || '').trim().toLowerCase();
      if (type === 'bug') map[client].bug += 1;
      else if (type === 'story') map[client].story += 1;
      else map[client].other += 1;

      map[client].count += 1;
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const total = filtered.length;
  const totalStory = clientData.reduce((s, d) => s + d.story, 0);
  const totalBug = clientData.reduce((s, d) => s + d.bug, 0);
  const totalOther = clientData.reduce((s, d) => s + d.other, 0);
  const maxCount = Math.max(...clientData.map((d) => d.count), 1);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.chartOverlay}>
        <View style={styles.chartModalCard}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.chartTitle}>Client Breakdown</Text>
              <Text style={styles.chartSubtitle} numberOfLines={1}>
                {selectedSprint || 'All Sprints'} · {selectedProduct || 'All Products'} · {total} records
                {' · '}Story {totalStory} · Bug {totalBug}
              </Text>
            </View>
            <TouchableOpacity style={styles.chartCloseButton} onPress={onClose}>
              <Feather name="x" size={19} color="#667085" />
            </TouchableOpacity>
          </View>

          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
              <Text style={styles.legendText}>Story</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Bug</Text>
            </View>
            {totalOther > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.legendText}>Other</Text>
              </View>
            )}
          </View>

          <ScrollView
            style={styles.chartScroll}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {clientData.length === 0 ? (
              <View style={styles.chartEmpty}>
                <Feather name="users" size={28} color="#98A2B3" />
                <Text style={styles.chartEmptyText}>No client data available.</Text>
              </View>
            ) : (
              <>
                <View style={styles.clientTable}>
                  <View style={[styles.chartTableHeader, { backgroundColor: '#ECFDF5' }]}>
                    <Text style={[styles.clientCellName, styles.chartHeaderText]}>Client</Text>
                    <Text style={[styles.chartCellSmall, { color: '#4F46E5' }]}>Story</Text>
                    <Text style={[styles.chartCellSmall, styles.chartBugHeader]}>Bug</Text>
                    <Text style={[styles.chartCellSmall, { color: '#047857' }]}>Total</Text>
                    <Text style={[styles.chartCellSmall, { color: '#047857' }]}>Share</Text>
                  </View>

                  {clientData.map(({ client, story, bug, count }) => (
                    <View key={client} style={styles.chartTableRow}>
                      <Text style={styles.clientCellName} numberOfLines={2}>{client}</Text>
                      <Text style={[styles.chartCellSmall, { color: '#4F46E5', fontWeight: '700' }]}>{story}</Text>
                      <Text style={[styles.chartCellSmall, { color: '#DC2626', fontWeight: '700' }]}>{bug}</Text>
                      <Text style={[styles.chartCellSmall, { color: '#172033', fontWeight: '700' }]}>{count}</Text>
                      <Text style={styles.chartCellSmall}>
                        {total > 0 ? Math.round((count / total) * 100) : 0}%
                      </Text>
                    </View>
                  ))}

                  <View style={styles.chartTableTotal}>
                    <Text style={[styles.clientCellName, { fontWeight: '800' }]}>Total</Text>
                    <Text style={[styles.chartCellSmall, { color: '#4F46E5', fontWeight: '900' }]}>{totalStory}</Text>
                    <Text style={[styles.chartCellSmall, { color: '#DC2626', fontWeight: '900' }]}>{totalBug}</Text>
                    <Text style={[styles.chartCellSmall, { fontWeight: '900', color: '#172033' }]}>{total}</Text>
                    <Text style={[styles.chartCellSmall, { fontWeight: '800' }]}>100%</Text>
                  </View>
                </View>

                <View style={styles.clientChartSection}>
                  {clientData.map(({ client, story, bug, other, count }) => {
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const barWidth = Math.max((count / maxCount) * 100, 6);

                    return (
                      <View key={`bar-${client}`} style={styles.chartRow}>
                        <View style={styles.chartRowTop}>
                          <Text style={styles.chartName} numberOfLines={1}>{client}</Text>
                          <Text style={styles.chartCounts}>
                            <Text style={{ color: '#4F46E5', fontWeight: '800' }}>{story}</Text>
                            <Text style={{ color: '#CBD5E1' }}> / </Text>
                            <Text style={{ color: '#DC2626', fontWeight: '800' }}>{bug}</Text>
                            {totalOther > 0 && (
                              <>
                                <Text style={{ color: '#CBD5E1' }}> / </Text>
                                <Text style={{ color: '#64748B', fontWeight: '800' }}>{other}</Text>
                              </>
                            )}
                            <Text style={styles.chartPct}> {pct}%</Text>
                          </Text>
                        </View>

                        <View style={styles.barTrack}>
                          <View style={[styles.barTotal, { width: `${barWidth}%` }]}>
                            {story > 0 && (
                              <View style={{ width: `${(story / count) * 100}%`, backgroundColor: '#6366F1' }} />
                            )}
                            {bug > 0 && (
                              <View style={{ width: `${(bug / count) * 100}%`, backgroundColor: '#EF4444' }} />
                            )}
                            {other > 0 && (
                              <View style={{ width: `${(other / count) * 100}%`, backgroundColor: '#94A3B8' }} />
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


export default function SprintDashboardScreen() {
  const { session, logout } = useAuth();
  const role = session.role || '';
  const isTestingLead = role === 'Testing Lead';
  const isDevTeamLead = role.trim().toLowerCase() === 'dev team lead';
  const isProductManagement = PRODUCT_MGMT_ROLES.includes(role);

  const [permissions, setPermissions] = useState({ IsAddPoint: false, IsPointDrop: false, IsSprintChange: false });
  const canPointDrop = isProductManagement || permissions.IsPointDrop;
  const canChangeSprint = SPRINT_CHANGE_ROLES.includes(role) || permissions.IsSprintChange;

  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [devLeadMapping, setDevLeadMapping] = useState([]);
  const [testingLeadMapping, setTestingLeadMapping] = useState([]);
  const [patchCreationMap, setPatchCreationMap] = useState({});
  const [bugAllSprints, setBugAllSprints] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedClient, setSelectedClient] = useState([]);

  // Web Sprint Dashboard filters
  const [selectedAssignedTo, setSelectedAssignedTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedDevLead, setSelectedDevLead] = useState('');
  const [selectedTestingLead, setSelectedTestingLead] = useState('');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showChart, setShowChart] = useState(false);
  const [showLeadChart, setShowLeadChart] = useState(false);
  const [showClientChart, setShowClientChart] = useState(false);
  const [actionSheetRow, setActionSheetRow] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null); // { type, message }

  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = (type, message) => {
    setToast({ type, message });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  /* ---------- data fetching ---------- */

  const fetchPermissions = useCallback(async () => {
    try {
      const data = await authFetchJson(apiUrl('permission', { userId: session.userId }));
      if (data?.length > 0) setPermissions(data[0]);
    } catch {
      /* non-blocking */
    }
  }, [session.userId]);

  const fetchSprintData = useCallback(async () => {
    try {
      const json = await authFetchJson(apiUrl('sprintData'));
      if (!json.success) throw new Error(json.message || 'Failed to load sprint data');
      setAllData(json.data || []);
      setError(null);
    } catch (err) {
      if (err.status === 401) return logout();
      setError(err.message);
    }
  }, [logout]);

  const fetchMappings = useCallback(async () => {
    try {
      const [dev, test] = await Promise.all([
        authFetchJson(apiUrl('teamLeadModuleMapping')),
        authFetchJson(apiUrl('testingLeadModuleMapping')),
      ]);
      setDevLeadMapping(Array.isArray(dev) ? dev : []);
      setTestingLeadMapping(Array.isArray(test) ? test : []);
    } catch {
      /* non-blocking */
    }
  }, []);

  const fetchPatchDates = useCallback(async () => {
    try {
      const data = await authFetchJson(apiUrl('getPatchList'));
      const map = {};
      if (data.success) {
        data.data.forEach((patch) => {
          patch.PatchDetails.forEach((detail) => {
            const id = String(detail.PointId);
            const existing = map[id];
            if (!existing || new Date(patch.PatchCreationDateTime) > new Date(existing)) {
              map[id] = patch.PatchCreationDateTime;
            }
          });
        });
      }
      setPatchCreationMap(map);
    } catch {
      /* non-blocking */
    }
  }, []);

  const fetchBugMeta = useCallback(async () => {
    try {
      const data = await authFetchJson(apiUrl('getProduct'));
      const sprints = Array.isArray(data.Sprint) ? data.Sprint.filter((x) => x.IsClosed === false) : [];
      setBugAllSprints(sprints);
    } catch {
      /* non-blocking */
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSprintData(), fetchPermissions(), fetchMappings(), fetchPatchDates(), fetchBugMeta()]);
    setLoading(false);
  }, [fetchSprintData, fetchPermissions, fetchMappings, fetchPatchDates, fetchBugMeta]);

  useEffect(() => {
    loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchSprintData(), fetchPatchDates()]);
    setRefreshing(false);
  };

  /* ---------- lookup maps ---------- */

  const devLeadByModule = useMemo(() => {
    const map = new Map();
    devLeadMapping.forEach((m) => {
      const key = String(m.ModuleId);
      if (!map.has(key)) map.set(key, m.TeamLeadLoginName);
    });
    return map;
  }, [devLeadMapping]);

  const testingLeadByModule = useMemo(() => {
    const map = new Map();
    testingLeadMapping.forEach((m) => {
      const key = String(m.ModuleId);
      if (!map.has(key)) map.set(key, m.TestingLeadName);
    });
    return map;
  }, [testingLeadMapping]);

  const patchIsTodaySet = useMemo(() => {
    const set = new Set();
    Object.keys(patchCreationMap).forEach((id) => {
      if (isPatchCreatedToday(patchCreationMap[id])) set.add(id);
    });
    return set;
  }, [patchCreationMap]);

  /* ---------- derived filter option lists ---------- */

  const products = useMemo(() => {
    const countMap = {};
    allData.forEach((r) => {
      if (r.ProductName) countMap[r.ProductName] = (countMap[r.ProductName] || 0) + 1;
    });
    return Object.keys(countMap)
      .sort()
      .map((name) => ({ label: name, value: name, count: countMap[name] }));
  }, [allData]);

  useEffect(() => {
    if (products.length === 0 || selectedProduct) return;
    const histree = products.find((p) => p.value.toLowerCase() === 'histree');
    setSelectedProduct((histree || products[0]).value);
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  const sprints = useMemo(() => {
    const rows = selectedProduct ? allData.filter((r) => r.ProductName === selectedProduct) : allData;
    const set = new Set(rows.map((r) => r.Sprint).filter(Boolean));
    return [...set].sort().map((s) => ({ label: s, value: s }));
  }, [allData, selectedProduct]);

  useEffect(() => {
    if (sprints.length === 0) {
      setSelectedSprint('');
      return;
    }
    if (selectedSprint && sprints.some((s) => s.value === selectedSprint)) return;
    setSelectedSprint(sprints[0].value);
  }, [sprints]); // eslint-disable-line react-hooks/exhaustive-deps

  const statuses = useMemo(() => {
    let rows = allData;
    if (selectedSprint) rows = rows.filter((r) => r.Sprint === selectedSprint);
    if (selectedProduct) rows = rows.filter((r) => r.ProductName === selectedProduct);
    const countMap = {};
    rows.forEach((r) => {
      const s = getPriorityStatus(r);
      if (s && s !== '-') countMap[s] = (countMap[s] || 0) + 1;
    });
    return Object.keys(countMap)
      .sort()
      .map((status) => ({ label: status, value: status, count: countMap[status] }));
  }, [allData, selectedSprint, selectedProduct]);

  const clientsList = useMemo(() => {
    let rows = allData;
    if (selectedSprint) rows = rows.filter((r) => r.Sprint === selectedSprint);
    if (selectedProduct) rows = rows.filter((r) => r.ProductName === selectedProduct);
    const countMap = {};
    rows.forEach((r) => {
      const client = (r.ClientName && String(r.ClientName).trim()) || '';
      if (client) countMap[client] = (countMap[client] || 0) + 1;
    });
    return Object.keys(countMap)
      .sort((a, b) => a.localeCompare(b))
      .map((client) => ({ label: client, value: client, count: countMap[client] }));
  }, [allData, selectedSprint, selectedProduct]);

  /* ---------- Web-compatible additional filter option lists ---------- */

  // Current Assigned - same scope as the web application:
  // sprint + product, then unique AssignedTo values.
  const assignedPersons = useMemo(() => {
    let rows = allData;

    if (selectedSprint) {
      rows = rows.filter((r) => r.Sprint === selectedSprint);
    }

    if (selectedProduct) {
      rows = rows.filter((r) => r.ProductName === selectedProduct);
    }

    return [...new Set(
      rows
        .map((r) => String(r.AssignedTo ?? '').trim())
        .filter(Boolean)
    )]
      .sort((a, b) => a.localeCompare(b))
      .map((person) => ({ label: person, value: person }));
  }, [allData, selectedSprint, selectedProduct]);

  const typeOptions = useMemo(
    () => [
      { label: 'Bug', value: 'Bug' },
      { label: 'Story', value: 'Story' },
    ],
    []
  );

  // Dev Leads are derived from the modules available in the current
  // product + sprint scope, exactly like the web dashboard.
  const devLeads = useMemo(() => {
    let rows = allData;

    if (selectedSprint) {
      rows = rows.filter((r) => r.Sprint === selectedSprint);
    }

    if (selectedProduct) {
      rows = rows.filter((r) => r.ProductName === selectedProduct);
    }

    const moduleIds = new Set(
      rows
        .map((r) => String(r.Module ?? ''))
        .filter(Boolean)
    );

    return [...new Set(
      devLeadMapping
        .filter((m) => moduleIds.has(String(m.ModuleId)))
        .map((m) => String(m.TeamLeadLoginName ?? '').trim())
        .filter(Boolean)
    )]
      .sort((a, b) => a.localeCompare(b))
      .map((lead) => ({ label: lead, value: lead }));
  }, [allData, selectedSprint, selectedProduct, devLeadMapping]);

  // Testing Leads are also module based and scoped by product + sprint.
  const testingLeads = useMemo(() => {
    let rows = allData;

    if (selectedSprint) {
      rows = rows.filter((r) => r.Sprint === selectedSprint);
    }

    if (selectedProduct) {
      rows = rows.filter((r) => r.ProductName === selectedProduct);
    }

    const moduleIds = new Set(
      rows
        .map((r) => String(r.Module ?? ''))
        .filter(Boolean)
    );

    return [...new Set(
      testingLeadMapping
        .filter((m) => moduleIds.has(String(m.ModuleId)))
        .map((m) => String(m.TestingLeadName ?? '').trim())
        .filter(Boolean)
    )]
      .sort((a, b) => a.localeCompare(b))
      .map((lead) => ({ label: lead, value: lead }));
  }, [allData, selectedSprint, selectedProduct, testingLeadMapping]);

  /* Keep single-select filters valid when Product/Sprint changes. */
  useEffect(() => {
    if (
      selectedAssignedTo &&
      !assignedPersons.some((x) => x.value === selectedAssignedTo)
    ) {
      setSelectedAssignedTo('');
    }
  }, [assignedPersons, selectedAssignedTo]);

  useEffect(() => {
    if (
      selectedDevLead &&
      !devLeads.some((x) => x.value === selectedDevLead)
    ) {
      setSelectedDevLead('');
    }
  }, [devLeads, selectedDevLead]);

  useEffect(() => {
    if (
      selectedTestingLead &&
      !testingLeads.some((x) => x.value === selectedTestingLead)
    ) {
      setSelectedTestingLead('');
    }
  }, [testingLeads, selectedTestingLead]);

  /* ---------- filtering ---------- */

  const filtered = useMemo(() => {
    let rows = allData;
    if (selectedProduct) rows = rows.filter((r) => r.ProductName === selectedProduct);
    if (selectedSprint) rows = rows.filter((r) => r.Sprint === selectedSprint);

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.Id ?? '').includes(q) ||
          String(r.Title ?? '').toLowerCase().includes(q) ||
          String(r.ClientName ?? '').toLowerCase().includes(q) ||
          String(r.ModuleName ?? '').toLowerCase().includes(q) ||
          String(r.AssignedTo ?? '').toLowerCase().includes(q)
      );
    }

    if (selectedStatus.length > 0) {
      rows = rows.filter((r) => selectedStatus.includes(getPriorityStatus(r)));
    }

    if (selectedClient.length > 0) {
      rows = rows.filter((r) => selectedClient.includes(r.ClientName));
    }

    // Current Assigned filter
    if (selectedAssignedTo) {
      rows = rows.filter(
        (r) => String(r.AssignedTo ?? '') === String(selectedAssignedTo)
      );
    }

    // Type filter: Bug / Story
    if (typeFilter) {
      rows = rows.filter(
        (r) => String(r.Type ?? '').toLowerCase() === typeFilter.toLowerCase()
      );
    }

    // Dev Team Lead filter: map Lead -> Module IDs, then filter records by Module.
    if (selectedDevLead) {
      const moduleIds = new Set(
        devLeadMapping
          .filter((m) => String(m.TeamLeadLoginName ?? '') === String(selectedDevLead))
          .map((m) => String(m.ModuleId))
      );

      rows = rows.filter((r) => moduleIds.has(String(r.Module ?? '')));
    }

    // Testing Lead filter: map Lead -> Module IDs, then filter records by Module.
    if (selectedTestingLead) {
      const moduleIds = new Set(
        testingLeadMapping
          .filter((m) => String(m.TestingLeadName ?? '') === String(selectedTestingLead))
          .map((m) => String(m.ModuleId))
      );

      rows = rows.filter((r) => moduleIds.has(String(r.Module ?? '')));
    }

    rows = [...rows].sort((a, b) => {
      const aToday = patchIsTodaySet.has(String(a.Id));
      const bToday = patchIsTodaySet.has(String(b.Id));
      if (aToday === bToday) return 0;
      return aToday ? 1 : -1;
    });

    return rows.map((r) => ({
      ...r,
      DevTeamLead: devLeadByModule.get(String(r.Module)) || '',
      TestingLead: testingLeadByModule.get(String(r.Module)) || '',
    }));
  }, [
    allData,
    selectedProduct,
    selectedSprint,
    search,
    selectedStatus,
    selectedClient,
    selectedAssignedTo,
    typeFilter,
    selectedDevLead,
    selectedTestingLead,
    patchIsTodaySet,
    devLeadMapping,
    testingLeadMapping,
    devLeadByModule,
    testingLeadByModule,
  ]);

  useEffect(
    () => setPage(1),
    [
      selectedProduct,
      selectedSprint,
      selectedStatus,
      selectedClient,
      selectedAssignedTo,
      typeFilter,
      selectedDevLead,
      selectedTestingLead,
      search,
    ]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  const statusCounts = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const s = getPriorityStatus(r);
      if (s && s !== '-') map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [filtered]);

  /* ---------- point actions (mirrors web UpdateSprintClientSideTesting) ---------- */

  const runPointAction = async (row, { sprintId = 0, actionType }) => {
    setActionLoading(true);
    try {
      const url = apiUrl('updateSprintClientSideTesting', {
        ids: row.SLAId,
        operatorId: session.userId,
        isPointDroporSprintChange: actionType,
        sprintId,
      });
      const res = await authFetch(url, { method: 'POST' });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const result = await res.text();
      showToast('success', result || 'Action completed successfully!');
      fetchSprintData();
    } catch (err) {
      showToast('error', err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openActions = (row) => setActionSheetRow(row);

  const buildActions = (row) => {
    if (!row) return [];
    const actions = [];
    const hasClientSideTesting = row.IsClientSideTesting === true;
    const hasPointDrop = row.PointDrop === true;

    if (isTestingLead) {
      actions.push(
        hasClientSideTesting
          ? { key: 'removeCST', label: 'Remove Client Side Testing', icon: 'user-x', onPress: () => runPointAction(row, { actionType: 1 }) }
          : { key: 'markCST', label: 'Mark Client Side Testing', icon: 'user-check', onPress: () => runPointAction(row, { actionType: 1 }) }
      );
    }
    if (canPointDrop) {
      actions.push(
        hasPointDrop
          ? { key: 'revertDrop', label: 'Revert Point Drop', icon: 'rotate-ccw', onPress: () => runPointAction(row, { actionType: 2 }) }
          : { key: 'drop', label: 'Point Drop', icon: 'x-circle', danger: true, onPress: () => runPointAction(row, { actionType: 2 }) }
      );
    }
    if (canChangeSprint) {
      const productSprints = bugAllSprints.filter((s) => String(s.ProductId) === String(row.Product));
      const first = productSprints[0];
      actions.push({
        key: 'changeSprint',
        label: first ? `Move to "${first.SprintName}"` : 'Sprint Change (no sprints found)',
        icon: 'shuffle',
        onPress: () => first && runPointAction(row, { actionType: 3, sprintId: first.ID }),
      });
    }
    return actions;
  };

  /* ---------- render ---------- */

  const selectedProductLabel = selectedProduct || 'All Products';
  const selectedSprintLabel = selectedSprint || 'All Sprints';

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#151A35', '#29315C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Sprint Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              {session.realName ? `Hi, ${session.realName}` : ''}
            </Text>
          </View>
          <View style={styles.headerActions}>
            
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => loadAll()}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="refresh-cw" size={16} color="#fff" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={logout}>
              <Feather name="log-out" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={14} color="rgba(255,255,255,0.8)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search ID, title, client, module..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            style={styles.searchInput}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={14} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <MobileFilter
            label="Product"
            placeholder="All Products"
            options={products}
            value={selectedProduct}
            onChange={setSelectedProduct}
            accent="#4F46E5"
          />
          <MobileFilter
            label="Sprint"
            placeholder="All Sprints"
            options={sprints}
            value={selectedSprint}
            onChange={setSelectedSprint}
            accent="#7C3AED"
          />
          <MobileFilter
            label="Status"
            placeholder="All Statuses"
            options={statuses}
            value={selectedStatus}
            onChange={setSelectedStatus}
            multi
            accent="#F59E0B"
          />
          <MobileFilter
            label="Client"
            placeholder="All Clients"
            options={clientsList}
            value={selectedClient}
            onChange={setSelectedClient}
            multi
            accent="#10B981"
          />

          <MobileFilter
            label="Assigned"
            placeholder="All Assigned"
            options={assignedPersons}
            value={selectedAssignedTo}
            onChange={setSelectedAssignedTo}
            accent="#0EA5E9"
          />

          <MobileFilter
            label="Type"
            placeholder="All Types"
            options={typeOptions}
            value={typeFilter}
            onChange={setTypeFilter}
            accent="#F97316"
          />

          <MobileFilter
            label="Dev Lead"
            placeholder="All Dev Leads"
            options={devLeads}
            value={selectedDevLead}
            onChange={setSelectedDevLead}
            accent="#6366F1"
          />

          <MobileFilter
            label="Testing Lead"
            placeholder="All Testing Leads"
            options={testingLeads}
            value={selectedTestingLead}
            onChange={setSelectedTestingLead}
            accent="#7C3AED"
          />
        </ScrollView>
      </View>

      {!loading && !error && (
        <View style={styles.statsStrip}>
          <Text style={styles.statsText}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{filtered.length}</Text> record{filtered.length !== 1 ? 's' : ''} ·{' '}
            {selectedSprintLabel} · {selectedProductLabel}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChipScroll}>
            {statusCounts.map(([s, c]) => {
              const palette = STATUS_PALETTE[s] || { bg: '#EEF0F4', text: '#566070' };
              return (
                <View key={s} style={[styles.statusChip, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.statusChipText, { color: palette.text }]} numberOfLines={1}>
                    {s}
                  </Text>
                  <Text style={[styles.statusChipCount, { color: palette.text }]}>{c}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!loading && !error && (
        <View style={styles.chartActionRow}>
          <TouchableOpacity
            style={[styles.chartActionButton, { backgroundColor: '#6366F1' }]}
            onPress={() => setShowLeadChart(true)}
            disabled={filtered.length === 0}
          >
            <Feather name="bar-chart-2" size={13} color="#fff" />
            <Text style={styles.chartActionText}>Lead Chart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chartActionButton, { backgroundColor: '#0D9488' }]}
            onPress={() => setShowClientChart(true)}
            disabled={filtered.length === 0}
          >
            <Feather name="bar-chart-2" size={13} color="#fff" />
            <Text style={styles.chartActionText}>Client Chart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chartActionButton, { backgroundColor: '#7C3AED' }]}
            onPress={() => setShowChart(true)}
            disabled={filtered.length === 0}
          >
            <Feather name="bar-chart-2" size={13} color="#fff" />
            <Text style={styles.chartActionText}>Chart</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading sprint data…</Text>
        </View>
      )}

      {!!error && !loading && (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={16} color={colors.red} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={pageRows}
          keyExtractor={(item, idx) => `${item.Id}-${idx}`}
          renderItem={({ item }) => <RecordCard row={item} onLongPress={openActions} />}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 3, paddingBottom: 18 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (page < totalPages) setPage((p) => p + 1);
          }}
          ListFooterComponent={
            page < totalPages ? (
              <View style={styles.loadMoreWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadMoreText}>Loading more…</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Feather name="inbox" size={28} color={colors.textFaint} />
              <Text style={styles.emptyText}>No records found for the selected filters.</Text>
            </View>
          }
        />
      )}

      <LeadChartModal
        visible={showLeadChart}
        filtered={filtered}
        devLeadMapping={devLeadMapping}
        testingLeadMapping={testingLeadMapping}
        selectedSprint={selectedSprintLabel}
        selectedProduct={selectedProductLabel}
        onClose={() => setShowLeadChart(false)}
      />

      <ClientChartModal
        visible={showClientChart}
        filtered={filtered}
        selectedSprint={selectedSprintLabel}
        selectedProduct={selectedProductLabel}
        onClose={() => setShowClientChart(false)}
      />

      <StatusChartModal
        visible={showChart}
        onClose={() => setShowChart(false)}
        filtered={filtered}
        sprintLabel={selectedSprintLabel}
        productLabel={selectedProductLabel}
      />

      <ActionSheet
        visible={!!actionSheetRow}
        title={actionSheetRow ? `Point #${actionSheetRow.Id}` : ''}
        subtitle={actionSheetRow?.Title}
        actions={buildActions(actionSheetRow)}
        onClose={() => setActionSheetRow(null)}
      />

      {actionLoading && (
        <View style={styles.actionLoadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {toast && (
        <Animated.View
          style={[
            styles.toast,
            toast.type === 'success' ? styles.toastSuccess : styles.toastError,
            {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <Feather name={toast.type === 'success' ? 'check-circle' : 'alert-circle'} size={15} color="#fff" />
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { paddingTop: 54, paddingBottom: 16, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: 0.1 },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 13, padding: 0 },

  filterSection: {
    backgroundColor: '#F7F8FC',
    paddingTop: 10,
    paddingBottom: 5,
  },
  filterScrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    gap: 7,
  },
  filterButton: {
    width: 150,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  filterButtonContent: { flex: 1, marginRight: 5 },
  filterLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  filterValue: { fontSize: 12, fontWeight: '700', color: '#20263A' },
  filterCount: { minWidth: 21, height: 21, paddingHorizontal: 5, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  filterCountText: { fontSize: 9, fontWeight: '800' },
  filterModalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.48)', justifyContent: 'flex-end' },
  filterModalCard: { maxHeight: '78%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  filterModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  filterModalTitle: { fontSize: 17, fontWeight: '800', color: '#172033' },
  filterModalSubtitle: { fontSize: 11, color: '#667085', marginTop: 3 },
  filterCloseButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  clearFilterButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, marginBottom: 5 },
  clearFilterText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },
  filterOptionsList: { marginTop: 3 },
  filterOption: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 7 },
  filterOptionIcon: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  filterOptionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D0D5DD' },
  filterOptionText: { flex: 1, color: '#344054', fontSize: 12, fontWeight: '600' },
  optionCountBadge: { minWidth: 26, paddingHorizontal: 7, height: 23, borderRadius: 12, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  optionCountText: { fontSize: 10, color: '#667085', fontWeight: '800' },
  filterDoneButton: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  filterDoneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  filterEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 35 },
  filterEmptyText: { marginTop: 8, color: '#98A2B3', fontSize: 12 },

  statsStrip: { paddingHorizontal: 12, paddingVertical: 5, gap: 4, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EAECF0' },
  statsText: { fontSize: 10.5, lineHeight: 14, color: '#667085' },
  statusChipScroll: { paddingTop: 2, paddingBottom: 1 },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 16, marginRight: 5 },
  statusChipText: { fontSize: 8.5, fontWeight: '700' },
  statusChipCount: { fontSize: 9, fontWeight: '900', marginLeft: 3 },

  chartActionRow: {
    height: 43,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  chartActionButton: {
    height: 34,
    flex: 1,
    minWidth: 0,
    borderRadius: 9,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    elevation: 1,
  },
  chartActionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  chartOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chartModalCard: {
    width: '100%',
    maxHeight: '91%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  chartHeader: {
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172033',
  },
  chartSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: '#98A2B3',
  },
  chartCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chartTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  chartTab: {
    paddingTop: 12,
    paddingBottom: 10,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  chartTabDevActive: { borderBottomColor: '#6366F1' },
  chartTabTestingActive: { borderBottomColor: '#7C3AED' },
  chartTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#98A2B3',
  },
  chartTabDevText: { color: '#4F46E5' },
  chartTabTestingText: { color: '#7C3AED' },

  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 2,
    marginRight: 5,
  },
  legendText: {
    fontSize: 10.5,
    color: '#667085',
  },
  legendNumber: {
    fontSize: 11,
    fontWeight: '800',
  },
  chartScroll: {
    paddingHorizontal: 14,
  },
  chartRow: {
    marginBottom: 9,
  },
  chartRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  chartName: {
    flex: 1,
    minWidth: 0,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475467',
  },
  chartCounts: {
    width: 88,
    textAlign: 'right',
    fontSize: 10,
  },
  chartPct: {
    color: '#98A2B3',
    fontWeight: '600',
  },
  barTrack: {
    height: 16,
    backgroundColor: '#F2F4F7',
    borderRadius: 9,
    overflow: 'hidden',
  },
  barTotal: {
    height: 16,
    minWidth: 26,
    flexDirection: 'row',
    borderRadius: 9,
    overflow: 'hidden',
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 45,
  },
  chartEmptyText: {
    marginTop: 8,
    color: '#98A2B3',
    fontSize: 12,
  },
  chartTable: {
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  clientTable: {
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  clientChartSection: {
    marginTop: 14,
    paddingBottom: 10,
  },
  chartTableHeader: {
    minHeight: 36,
    backgroundColor: '#EEF2FF',
    borderBottomWidth: 1,
    borderBottomColor: '#D9DDF8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  chartTableRow: {
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  chartTableTotal: {
    minHeight: 36,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 2,
    borderTopColor: '#D0D5DD',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  chartCellLead: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    color: '#475467',
  },
  clientCellName: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    color: '#475467',
    paddingRight: 4,
  },
  chartCellSmall: {
    width: 42,
    textAlign: 'right',
    fontSize: 9.5,
    color: '#667085',
  },
  chartHeaderText: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  chartBugHeader: {
    color: '#DC2626',
    fontWeight: '800',
  },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  emptyText: { color: colors.textFaint, fontSize: 13 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.redSoft,
    borderRadius: radii.md,
    marginHorizontal: 14,
    marginTop: 10,
    padding: 12,
  },
  errorBannerText: { color: colors.red, fontSize: 12.5, flex: 1 },

  loadMoreWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  loadMoreText: { fontSize: 12, color: colors.textMuted },

  actionLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,17,30,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.md,
    padding: 14,
    ...shadow.modal,
  },
  toastSuccess: { backgroundColor: colors.emerald },
  toastError: { backgroundColor: colors.red },
  toastText: { color: '#fff', fontSize: 12.5, flex: 1, fontWeight: '600' },
});
