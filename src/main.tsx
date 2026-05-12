// Expenza - Core Logic
import './index.css';

// TypeScript Interfaces
interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
}

// Global State
let transactions: Transaction[] = JSON.parse(localStorage.getItem('transactions') || '[]');
let currentTheme = localStorage.getItem('theme') || 'dark';

// Chart instances
let balanceChart: any = null;
let categoryChart: any = null;

// DOM Elements
const doc = document;
const balanceEl = doc.getElementById('balance-amount')!;
const incomeEl = doc.getElementById('income-amount')!;
const expenseEl = doc.getElementById('expense-amount')!;
const transactionListEl = doc.getElementById('transaction-list')!;
const emptyStateEl = doc.getElementById('empty-state')!;
const modalEl = doc.getElementById('modal')!;
const transactionForm = doc.getElementById('transaction-form') as HTMLFormElement;
const searchInput = doc.getElementById('search-input') as HTMLInputElement;
const filterCategory = doc.getElementById('filter-category') as HTMLSelectElement;
const themeToggle = doc.getElementById('theme-toggle')!;
const themeIcon = doc.getElementById('theme-icon')!;
const themeText = doc.getElementById('theme-text')!;
const notificationEl = doc.getElementById('notification')!;

// Initialize
function init() {
  applyTheme();
  render();
  setupEventListeners();
  // @ts-ignore
  lucide.createIcons();
}

// Render everything
function render() {
  const filtered = filterTransactions();
  updateStats(filtered);
  updateTransactionList(filtered);
  updateCharts(filtered);
  localStorage.setItem('transactions', JSON.stringify(transactions));
}

// Filter logic
function filterTransactions() {
  const search = searchInput.value.toLowerCase();
  const category = filterCategory.value;

  return transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(search);
    const matchesCategory = category === 'all' || t.category === category;
    return matchesSearch && matchesCategory;
  });
}

// Update Stats (Balance, Income, Expense)
function updateStats(data: Transaction[]) {
  const income = data.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expense = data.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = income - expense;

  balanceEl.innerText = formatCurrency(balance);
  incomeEl.innerText = formatCurrency(income);
  expenseEl.innerText = formatCurrency(expense);

  // Update Monthly Insight
  const avgDayEl = doc.getElementById('avg-day')!;
  const budgetProgressEl = doc.getElementById('budget-progress')!;
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthlyExpenses = data.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.type === 'expense';
  }).reduce((acc, t) => acc + t.amount, 0);

  const avg = monthlyExpenses / new Date().getDate(); // Avg per day so far
  avgDayEl.innerText = formatCurrency(isNaN(avg) ? 0 : avg);

  // Fake budget progress (percentage of income or fixed amount)
  const budget = 5000; 
  const progress = Math.min((monthlyExpenses / budget) * 100, 100);
  budgetProgressEl.style.width = `${progress}%`;
}

// Update Transaction List
function updateTransactionList(data: Transaction[]) {
  transactionListEl.innerHTML = '';
  
  if (data.length === 0) {
    emptyStateEl.classList.remove('hidden');
  } else {
    emptyStateEl.classList.add('hidden');
    
    // Sort by date descending
    const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sorted.forEach(t => {
      const row = doc.createElement('tr');
      row.className = 'transaction-row group';
      row.innerHTML = `
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#f5f5f5] flex items-center justify-center text-[#4a4a4a] group-hover:bg-[#1a1a1a] group-hover:text-white transition-all">
              <i data-lucide="${getCategoryIcon(t.category)}" class="w-5 h-5"></i>
            </div>
            <span class="font-medium">${t.description}</span>
          </div>
        </td>
        <td class="px-6 py-4">
          <div class="flex justify-center">
             <span class="px-3 py-1 bg-[#f5f5f5] rounded-full text-[10px] font-bold uppercase tracking-wider text-[#9e9e9e]">${t.category}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-center">
          <span class="text-xs text-[#9e9e9e]">${formatDate(t.date)}</span>
        </td>
        <td class="px-6 py-4 text-right">
          <span class="font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}">
            ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, false)}
          </span>
        </td>
        <td class="px-6 py-4 text-right">
          <button class="btn-delete p-2 text-[#9e9e9e] hover:text-red-500 rounded-lg transition-colors" data-id="${t.id}">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      `;
      transactionListEl.appendChild(row);
    });
    // @ts-ignore
    lucide.createIcons();

    // Re-attach delete listeners
    doc.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        deleteTransaction(id!);
      });
    });
  }
}

// Update Charts (Chart.js)
function updateCharts(data: Transaction[]) {
  const ctxBalance = (doc.getElementById('balanceChart') as HTMLCanvasElement).getContext('2d');
  const ctxCategory = (doc.getElementById('categoryChart') as HTMLCanvasElement).getContext('2d');

  if (!ctxBalance || !ctxCategory) return;

  // Monthly data mockup for Bar Chart (Income vs Expense)
  // In a real app we'd group by month. Here we just show current data totals
  const totalIncome = data.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = data.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  // Category data for Pie Chart
  const categories = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Others'];
  const categoryData = categories.map(cat => {
    return data.filter(t => t.category === cat && t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  });

  const isDark = currentTheme === 'dark';
  const textColor = isDark ? '#a0a0a0' : '#9e9e9e';
  const gridColor = isDark ? '#333333' : '#e5e5e5';

  // Balance Chart (Bar)
  if (balanceChart) balanceChart.destroy();
  // @ts-ignore
  balanceChart = new Chart(ctxBalance, {
    type: 'bar',
    data: {
      labels: ['Current Period'],
      datasets: [
        {
          label: 'Income',
          data: [totalIncome],
          backgroundColor: '#10b981', // emerald-500
          borderRadius: 8,
        },
        {
          label: 'Expense',
          data: [totalExpense],
          backgroundColor: '#f43f5e', // rose-500
          borderRadius: 8,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 10 } }
        }
      }
    }
  });

  // Category Chart (Doughnut)
  if (categoryChart) categoryChart.destroy();
  // @ts-ignore
  categoryChart = new Chart(ctxCategory, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: categoryData,
        backgroundColor: isDark ? [
          '#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'
        ] : [
          '#4a4a4a', '#8e9299', '#d1d1d1', '#1a1a1a', '#9e9e9e', '#e5e5e5'
        ],
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { size: 10 },
            boxWidth: 10,
            padding: 15
          }
        }
      },
      cutout: '70%'
    }
  });
}

// Helpers
function formatCurrency(amount: number, symbol = true) {
  return (symbol ? '₹' : '') + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string) {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'Food': return 'utensils';
    case 'Transport': return 'car';
    case 'Bills': return 'credit-card';
    case 'Shopping': return 'shopping-bag';
    case 'Entertainment': return 'clapperboard';
    default: return 'package';
  }
}

// Actions
function deleteTransaction(id: string) {
  transactions = transactions.filter(t => t.id !== id);
  render();
  showNotification('Transaction deleted.');
}

function showNotification(message: string) {
  notificationEl.innerText = message;
  notificationEl.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    notificationEl.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

// Theme
function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', currentTheme);
  applyTheme();
  render();
}

function applyTheme() {
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
    themeIcon.setAttribute('data-lucide', 'sun');
    themeText.innerText = 'Light Mode';
  } else {
    document.documentElement.classList.remove('dark');
    themeIcon.setAttribute('data-lucide', 'moon');
    themeText.innerText = 'Dark Mode';
  }
  // @ts-ignore
  lucide.createIcons();
}

// Event Listeners
function setupEventListeners() {
  doc.getElementById('btn-add-transaction')!.addEventListener('click', () => {
    modalEl.classList.add('active');
  });

  doc.getElementById('close-modal')!.addEventListener('click', () => {
    modalEl.classList.remove('active');
  });

  window.addEventListener('click', (e) => {
    if (e.target === modalEl) modalEl.classList.remove('active');
  });

  transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(transactionForm);
    
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      description: (doc.getElementById('form-description') as HTMLInputElement).value,
      amount: parseFloat((doc.getElementById('form-amount') as HTMLInputElement).value),
      type: (doc.getElementById('form-type') as HTMLSelectElement).value as 'income' | 'expense',
      category: (doc.getElementById('form-category') as HTMLSelectElement).value,
      date: (doc.getElementById('form-date') as HTMLInputElement).value
    };

    transactions.push(newTransaction);
    transactionForm.reset();
    modalEl.classList.remove('active');
    render();
    showNotification('Transaction saved!');
  });

  searchInput.addEventListener('input', render);
  filterCategory.addEventListener('change', render);

  doc.getElementById('clear-all')!.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all transactions?')) {
      transactions = [];
      render();
      showNotification('All data cleared.');
    }
  });

  themeToggle.addEventListener('click', toggleTheme);
}

// Run
init();
