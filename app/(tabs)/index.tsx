import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Papa from 'papaparse';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get("window").width;

// --- HELPERS ---

const getCategoryEmoji = (category) => {
  const cat = (category || "").toLowerCase();
  if (cat.includes('food') || cat.includes('dining') || cat.includes('restaurant')) return '🍽️';
  if (cat.includes('shopping') || cat.includes('retail') || cat.includes('clothes')) return '🛍️';
  if (cat.includes('entertainment') || cat.includes('movie') || cat.includes('fun')) return '🎬';
  if (cat.includes('transport') || cat.includes('transit') || cat.includes('uber')) return '🚇';
  if (cat.includes('grocery') || cat.includes('groceries')) return '🛒';
  if (cat.includes('health') || cat.includes('medical')) return '💊';
  if (cat.includes('bill') || cat.includes('utility') || cat.includes('rent')) return '🧾';
  return '💸';
};

const formatToK = (num) => {
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toFixed(0);
};

const parseDate = (dateStr) => {
  if (!dateStr) return new Date(0);
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/');
  if (timePart) {
    const [hours, minutes, seconds] = timePart.split(':');
    return new Date(year, month - 1, day, hours, minutes, seconds);
  }
  return new Date(year, month - 1, day);
};

const pieColors = ['#84A98C', '#5C8EAC', '#D98A8A', '#E3B5A4', '#B5B5B5', '#A5A58D', '#9A8C98'];

// --- MAIN APP ---

export default function App() {
  const [sheetData, setSheetData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Settings State
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [budget, setBudget] = useState('10000');
  const [appCurrency, setAppCurrency] = useState('HKD');
  const [tempBudget, setTempBudget] = useState(budget);
  const [tempCurrency, setTempCurrency] = useState(appCurrency);
  const [exchangeRates, setExchangeRates] = useState(null);

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);

  // 1. Load Permanent Settings from Storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedBudget = await AsyncStorage.getItem('@zenspend_budget');
        const savedCurrency = await AsyncStorage.getItem('@zenspend_currency');
        if (savedBudget) { setBudget(savedBudget); setTempBudget(savedBudget); }
        if (savedCurrency) { setAppCurrency(savedCurrency); setTempCurrency(savedCurrency); }
      } catch (e) { console.error(e); }
    };
    loadSettings();
  }, []);

  // 2. Fetch Data Logic
  const fetchSheetData = async () => {
    try {
      // Rates
      const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
      const rateData = await rateRes.json();
      setExchangeRates(rateData.rates);

      // Sheet
      const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRP86iBkm5Xz8nk-g5s6K6t7qkbZBAIEgtzcLhLAcB91d3Y_Px-3YOraz9hfYx1gHyDhmj2RNJoGbX2/pub?gid=707099685&single=true&output=csv";
      Papa.parse(sheetUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          const sorted = results.data
            .filter(row => row.Amount && row.Category)
            .map(row => ({
              ...row,
              // 2. NEW: Scrub the Amount column. 
              // This regex strips all letters, spaces, and commas, keeping only numbers, dots, and minus signs.
              Amount: String(row.Amount).replace(/[^0-9.-]+/g, '') 
            }))
            .sort((a, b) => parseDate(b.DateTimeStamp) - parseDate(a.DateTimeStamp));
          setSheetData(sorted);
          setLoading(false);
          setRefreshing(false);
        }
      });
    } catch (error) {
      console.error(error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchSheetData(); }, []);

  const getConvertedAmount = (amount, originalCurrency) => {
    const parsedAmount = parseFloat(amount) || 0;
    if (!exchangeRates || !originalCurrency || originalCurrency.toUpperCase() === appCurrency.toUpperCase()) {
      return parsedAmount;
    }
    const fromRate = exchangeRates[originalCurrency.toUpperCase()] || 1;
    const toRate = exchangeRates[appCurrency.toUpperCase()] || 1;
    return parsedAmount * (toRate / fromRate);
  };

  // --- MEMOIZED DATA ---

  const availableMonths = useMemo(() => {
    if (sheetData.length === 0) return ["Current Month"];
    const months = new Set();
    sheetData.forEach(item => {
      if (item.DateTimeStamp) {
        const parts = item.DateTimeStamp.split('/');
        if (parts.length >= 3) months.add(`${parts[1]}/${parts[2].split(' ')[0]}`);
      }
    });
    return Array.from(months);
  }, [sheetData]);

  const activeMonthLabel = availableMonths[selectedMonthIndex] || "Current Month";

  const { groupedTransactions, chartData } = useMemo(() => {
    if (sheetData.length === 0) return { groupedTransactions: [], chartData: { labels: [], data: [0] } };
    const monthData = sheetData.filter(item => item.DateTimeStamp && item.DateTimeStamp.includes(activeMonthLabel));
    const groups = {};
    const dailyTotals = {};

    monthData.forEach(item => {
      const amount = getConvertedAmount(item.Amount, item.Currency);
      const dateOnly = item.DateTimeStamp.split(' ')[0];
      const dayStr = dateOnly.split('/')[0];
      if (!groups[dateOnly]) groups[dateOnly] = [];
      groups[dateOnly].push(item);
      dailyTotals[dayStr] = (dailyTotals[dayStr] || 0) + amount;
    });

    const sortedDays = Object.keys(dailyTotals).sort((a, b) => parseInt(a) - parseInt(b));
    let runningSum = 0;
    const labels = sortedDays;
    const cumulative = sortedDays.map(day => { runningSum += dailyTotals[day]; return runningSum; });

    return {
      groupedTransactions: Object.keys(groups).map(date => ({ title: date, data: groups[date] })),
      chartData: { labels: labels.length ? labels : [""], data: cumulative.length ? cumulative : [0] }
    };
  }, [sheetData, activeMonthLabel, appCurrency, exchangeRates]);

  const dashboardMetrics = useMemo(() => {
    if (sheetData.length === 0) return { totalSpent: 0, recentTransactions: [], currentMonthLabel: "", pieData: [] };
    const latestMonth = availableMonths[0];
    let spentThisMonth = 0;
    const categoryTotals = {};

    sheetData.forEach(row => {
      if (row.DateTimeStamp && row.DateTimeStamp.includes(latestMonth)) {
        const amount = getConvertedAmount(row.Amount, row.Currency);
        spentThisMonth += amount;
        const cat = row.Category || "Uncategorized";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
      }
    });

    const pieDataArray = Object.keys(categoryTotals)
      .sort((a, b) => categoryTotals[b] - categoryTotals[a])
      .map((key, index) => {
        const amount = categoryTotals[key];
        // Calculate percentage (check for zero to avoid errors)
        const percentage = spentThisMonth > 0
          ? ((amount / spentThisMonth) * 100).toFixed(0)
          : 0;

        return {
          // New format: "Category (45% - 1.1k)"
          name: `${key} (${percentage}% - ${formatToK(amount)})`,
          population: amount,
          color: pieColors[index % pieColors.length],
          legendFontColor: "#8E8E93",
          legendFontSize: 12
        };
      });
    return { totalSpent: spentThisMonth, recentTransactions: sheetData.slice(0, 3), currentMonthLabel: latestMonth, pieData: pieDataArray };
  }, [sheetData, availableMonths, appCurrency, exchangeRates]);

  // --- RENDER HELPERS ---

  const renderTransactionItem = ({ item }) => {
    const details = item.Note || (item.Location ? item.Location.replace(/\n/g, ', ') : "No details");
    const converted = getConvertedAmount(item.Amount, item.Currency);
    const category = item.Category || "Uncategorized";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.categoryText}>{getCategoryEmoji(category)} {category}</Text>
          <Text style={styles.amountText}>{appCurrency} {converted.toFixed(2)}</Text>
        </View>
        <Text style={styles.noteText} numberOfLines={1}>{details}</Text>
      </View>
    );
  };

  const renderDashboard = () => {
    const { totalSpent, recentTransactions, currentMonthLabel, pieData } = dashboardMetrics;
    const budgetNum = parseFloat(budget) || 1;
    const progress = Math.min((totalSpent / budgetNum) * 100, 100);

    return (
      <ScrollView
        style={styles.tabContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSheetData(); }} tintColor="#84A98C" />}
      >
        <View style={styles.budgetContainer}>
          <Text style={styles.sectionTitle}>Remaining Budget</Text>
          <Text style={styles.budgetValue}>{appCurrency} {Math.max(budgetNum - totalSpent, 0).toFixed(2)}</Text>
          <Text style={styles.budgetSubText}>Spent {totalSpent.toFixed(2)} of {budgetNum} • {currentMonthLabel}</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: progress > 80 ? '#D98A8A' : '#84A98C' }]} />
          </View>
        </View>

        {pieData.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={[styles.sectionTitle, { alignSelf: 'flex-start', marginBottom: 10 }]}>Category Breakdown</Text>
            <PieChart
              data={pieData} width={screenWidth - 40} height={140}
              chartConfig={{ color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})` }}
              accessor={"population"} backgroundColor={"transparent"} center={[screenWidth / 4 - 20, 0]} hasLegend={false}
            />
            <View style={styles.legendContainer}>
              {pieData.map((item, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Recent Transactions</Text>
        {recentTransactions.map((item, index) => (
          <View key={index}>{renderTransactionItem({ item })}</View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { setLoading(true); fetchSheetData(); }} style={{ marginRight: 20 }}>
            <Ionicons name="sync" size={24} color="#8E8E93" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setTempBudget(budget); setTempCurrency(appCurrency); setSettingsVisible(true); }}>
            <Ionicons name="settings-outline" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#84A98C" /><Text style={styles.loadingText}>Syncing logs...</Text></View>
      ) : (
        <View style={styles.contentWrapper}>
          {activeTab === 'dashboard' ? renderDashboard() : (
            <View style={styles.transactionsWrapper}>
              <View style={styles.monthSelector}>
                <TouchableOpacity onPress={() => setSelectedMonthIndex(Math.min(selectedMonthIndex + 1, availableMonths.length - 1))}><Ionicons name="chevron-back" size={24} color="#FFFFFF" /></TouchableOpacity>
                <Text style={styles.monthSelectorText}>{activeMonthLabel}</Text>
                <TouchableOpacity onPress={() => setSelectedMonthIndex(Math.max(selectedMonthIndex - 1, 0))}><Ionicons name="chevron-forward" size={24} color="#FFFFFF" /></TouchableOpacity>
              </View>
              <LineChart
                data={{ labels: chartData.labels, datasets: [{ data: chartData.data }] }}
                width={screenWidth - 40} height={180} withDots={false} withInnerLines={false} withOuterLines={false}
                formatYLabel={(v) => Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : v}
                chartConfig={{
                  backgroundColor: '#1C1C1E', backgroundGradientFrom: '#1C1C1E', backgroundGradientTo: '#1C1C1E',
                  color: (opacity = 1) => `rgba(132, 169, 140, ${opacity})`, labelColor: () => `#8E8E93`,
                  propsForLabels: { fontFamily: '-apple-system, system-ui, Roboto, sans-serif' }
                }}
                bezier style={styles.chartStyle}
              />
              <SectionList
                sections={groupedTransactions} keyExtractor={(item, i) => i.toString()} renderItem={renderTransactionItem}
                renderSectionHeader={({ section: { title } }) => <Text style={styles.dateHeader}>{title}</Text>}
                contentContainerStyle={styles.listContainer}
              />
            </View>
          )}
        </View>
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('dashboard')}><Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>Dashboard</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('transactions')}><Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>Transactions</Text></TouchableOpacity>
      </View>

      <Modal visible={isSettingsVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Settings</Text><TouchableOpacity onPress={() => setSettingsVisible(false)}><Ionicons name="close" size={24} color="#8E8E93" /></TouchableOpacity></View>
          <Text style={styles.inputLabel}>Monthly Budget</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={tempBudget} onChangeText={setTempBudget} />
          <Text style={styles.inputLabel}>Base Currency</Text>
          <TextInput style={styles.input} autoCapitalize="characters" maxLength={3} value={tempCurrency} onChangeText={setTempCurrency} />
          <TouchableOpacity style={styles.saveButton} onPress={async () => {
            setBudget(tempBudget); setAppCurrency(tempCurrency.toUpperCase()); setSettingsVisible(false);
            await AsyncStorage.setItem('@zenspend_budget', tempBudget); await AsyncStorage.setItem('@zenspend_currency', tempCurrency.toUpperCase());
          }}><Text style={styles.saveButtonText}>Save Changes</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#8E8E93', fontSize: 16 },
  contentWrapper: { flex: 1 },
  tabContent: { flex: 1, paddingHorizontal: 20 },
  budgetContainer: { backgroundColor: '#2C2C2E', padding: 24, borderRadius: 20, marginTop: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1 },
  budgetValue: { fontSize: 40, fontWeight: '700', color: '#FFFFFF', marginTop: 8, marginBottom: 4 },
  budgetSubText: { fontSize: 14, color: '#8E8E93', marginBottom: 20 },
  progressBarBackground: { height: 8, backgroundColor: '#1C1C1E', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  chartContainer: { backgroundColor: '#2C2C2E', padding: 20, borderRadius: 20, marginTop: 16, alignItems: 'center' },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginBottom: 12 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
  legendText: { color: '#8E8E93', fontSize: 12 },
  transactionsWrapper: { flex: 1 },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  monthSelectorText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  chartStyle: { alignSelf: 'center', borderRadius: 16, marginVertical: 10 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  dateHeader: { fontSize: 14, fontWeight: '600', color: '#8E8E93', marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: '#2C2C2E', padding: 16, borderRadius: 16, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  categoryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  amountText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  noteText: { fontSize: 14, color: '#8E8E93' },
  tabBar: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderTopWidth: 1, borderTopColor: '#2C2C2E', paddingBottom: 30, paddingTop: 15 },
  tabButton: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: 16, color: '#8E8E93' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-start', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { backgroundColor: '#2C2C2E', padding: 24, paddingTop: 60, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  inputLabel: { color: '#8E8E93', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#1C1C1E', color: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 20 },
  saveButton: { backgroundColor: '#84A98C', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700' },
});