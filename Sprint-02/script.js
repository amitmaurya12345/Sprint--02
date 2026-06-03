// ==========================================
// 1. STATE MANAGEMENT
// ==========================================
let state = {
    salary: 0,
    expenses: []
};

// Chart instance
let expenseChart = null;

// Currency variables
let currentCurrency = 'INR';
let exchangeRates = {};

// DOM Elements
const salaryInput = document.getElementById('salaryInput');
const setSalaryBtn = document.getElementById('setSalaryBtn');
const expenseNameInput = document.getElementById('expenseName');
const expenseAmountInput = document.getElementById('expenseAmount');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const resetBtn = document.getElementById('resetBtn');
const totalSalaryEl = document.getElementById('totalSalary');
const totalExpensesEl = document.getElementById('totalExpenses');
const remainingBalanceEl = document.getElementById('remainingBalance');
const expensesListEl = document.getElementById('expensesList');
const salaryErrorEl = document.getElementById('salaryError');
const expenseErrorEl = document.getElementById('expenseError');

// ==========================================
// 2. LOCALSTORAGE FUNCTIONS
// ==========================================

function saveToLocalStorage() {
    const dataToSave = {
        salary: state.salary,
        expenses: state.expenses,
        currency: currentCurrency,
        lastUpdated: new Date().toISOString(),
        version: '1.0'
    };
    localStorage.setItem('cashflow_data', JSON.stringify(dataToSave));
    console.log('✅ Data saved to localStorage');
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem('cashflow_data');
    
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            state.salary = parsedData.salary || 0;
            state.expenses = parsedData.expenses || [];
            if (parsedData.currency) {
                currentCurrency = parsedData.currency;
                const selector = document.getElementById('currencySelector');
                if (selector) selector.value = currentCurrency;
            }
            console.log('✅ Data loaded from localStorage');
            return true;
        } catch (error) {
            console.error('❌ Error loading data:', error);
            return false;
        }
    }
    return false;
}

function clearLocalStorage() {
    localStorage.removeItem('cashflow_data');
}

// ==========================================
// 3. CURRENCY CONVERSION FUNCTIONS
// ==========================================

async function fetchExchangeRates() {
    try {
        const response = await fetch('https://api.frankfurter.app/latest?from=INR');
        if (!response.ok) throw new Error('API failed');
        const data = await response.json();
        exchangeRates = data.rates;
        exchangeRates.INR = 1;
        console.log('Exchange rates fetched:', exchangeRates);
        return true;
    } catch (error) {
        console.error('API Error, using fallback rates:', error);
        exchangeRates = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095, JPY: 1.8 };
        return false;
    }
}

function convertCurrency(amountInINR) {
    if (currentCurrency === 'INR') return amountInINR;
    const rate = exchangeRates[currentCurrency];
    return rate ? amountInINR * rate : amountInINR;
}

function formatConvertedCurrency(amountInINR) {
    const converted = convertCurrency(amountInINR);
    const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
    const symbol = symbols[currentCurrency] || '₹';
    
    if (currentCurrency === 'JPY') {
        return `${symbol}${Math.round(converted).toLocaleString()}`;
    }
    return `${symbol}${converted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function updateExchangeRateInfo() {
    const infoEl = document.getElementById('exchangeRateInfo');
    if (!infoEl) return;
    if (currentCurrency === 'INR') {
        infoEl.textContent = 'Showing Indian Rupee';
    } else {
        const rate = exchangeRates[currentCurrency];
        infoEl.textContent = rate ? `1 INR = ${rate.toFixed(4)} ${currentCurrency}` : 'Updating...';
    }
}

// ==========================================
// 4. THRESHOLD ALERT FUNCTIONS
// ==========================================

let alertShown = false;

function checkThresholdAlert() {
    const totalExpenses = state.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remainingBalance = state.salary - totalExpenses;
    const alertBanner = document.getElementById('alertBanner');
    const alertMessage = document.getElementById('alertMessage');
    
    if (state.salary > 0) {
        const percentageRemaining = (remainingBalance / state.salary) * 100;
        
        if (percentageRemaining < 10 && remainingBalance >= 0) {
            if (alertBanner) {
                alertBanner.style.display = 'flex';
                alertMessage.innerHTML = `⚠️ Critical Alert! Your remaining balance (${formatConvertedCurrency(remainingBalance)}) is below 10% of your salary (${formatConvertedCurrency(state.salary)}).`;
            }
            if (remainingBalanceEl && !alertShown) {
                remainingBalanceEl.classList.add('critical-balance');
                remainingBalanceEl.style.color = '#ef4444';
            }
            if (!alertShown) {
                showSuccessMessage('⚠️ Warning: Balance below 10%!');
                alertShown = true;
            }
        } else {
            if (alertBanner) alertBanner.style.display = 'none';
            if (remainingBalanceEl) {
                remainingBalanceEl.classList.remove('critical-balance');
                if (remainingBalance < 0) remainingBalanceEl.style.color = '#ef4444';
                else if (remainingBalance === 0) remainingBalanceEl.style.color = '#f59e0b';
                else remainingBalanceEl.style.color = '#10b981';
            }
            alertShown = false;
        }
    } else {
        if (alertBanner) alertBanner.style.display = 'none';
        alertShown = false;
    }
}

function closeAlert() {
    const alertBanner = document.getElementById('alertBanner');
    if (alertBanner) alertBanner.style.display = 'none';
    alertShown = false;
}

// ==========================================
// 5. PIE CHART FUNCTIONS
// ==========================================

function updatePieChart() {
    const totalExpenses = state.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remainingBalance = Math.max(0, state.salary - totalExpenses);
    
    const canvas = document.getElementById('expensePieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (expenseChart) expenseChart.destroy();
    
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Remaining Balance', 'Total Expenses'],
            datasets: [{
                data: [remainingBalance, totalExpenses],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${formatConvertedCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: { animateScale: true, duration: 800 }
        }
    });
    
    // Update legend
    const legendContainer = document.getElementById('chartLegend');
    if (legendContainer) {
        const total = remainingBalance + totalExpenses;
        const expPercent = total > 0 ? ((totalExpenses / total) * 100).toFixed(1) : 0;
        const balPercent = total > 0 ? ((remainingBalance / total) * 100).toFixed(1) : 0;
        legendContainer.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background: #10b981;"></div>
                <span>Remaining: ${formatConvertedCurrency(remainingBalance)} (${balPercent}%)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ef4444;"></div>
                <span>Expenses: ${formatConvertedCurrency(totalExpenses)} (${expPercent}%)</span>
            </div>
        `;
    }
}

// ==========================================
// 6. HELPER FUNCTIONS
// ==========================================

function formatCurrency(amount) {
    return `₹${amount.toLocaleString('en-IN')}`;
}

function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => element.classList.remove('show'), 3000);
}

function showSuccessMessage(message) {
    const div = document.createElement('div');
    div.textContent = message;
    div.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#10b981;color:white;padding:12px 24px;border-radius:8px;z-index:9999;animation:slideIn 0.3s ease';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// 7. VALIDATION FUNCTIONS
// ==========================================

function validateSalary(amount) {
    if (!amount && amount !== 0) return 'Please enter a salary amount';
    if (isNaN(amount)) return 'Please enter a valid number';
    if (amount <= 0) return 'Salary must be greater than zero';
    return null;
}

function validateExpense(name, amount) {
    if (!name || name.trim() === '') return 'Please enter an expense name';
    if (name.trim().length < 2) return 'Expense name must be at least 2 characters';
    if (!amount && amount !== 0) return 'Please enter an expense amount';
    if (isNaN(amount)) return 'Please enter a valid number';
    if (amount <= 0) return 'Expense amount must be greater than zero';
    return null;
}

// ==========================================
// 8. UI UPDATE FUNCTIONS
// ==========================================

function updateAllCurrencyDisplays() {
    totalSalaryEl.textContent = formatConvertedCurrency(state.salary);
    const totalExpenses = state.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    totalExpensesEl.textContent = formatConvertedCurrency(totalExpenses);
    const remainingBalance = state.salary - totalExpenses;
    remainingBalanceEl.textContent = formatConvertedCurrency(remainingBalance);
    
    // Update expense list
    const expenseAmounts = document.querySelectorAll('.expense-amount');
    state.expenses.forEach((exp, i) => {
        if (expenseAmounts[i]) expenseAmounts[i].textContent = formatConvertedCurrency(exp.amount);
    });
    
    // Update progress bar
    const budgetPercentage = state.salary > 0 ? (totalExpenses / state.salary) * 100 : 0;
    const budgetPercentageEl = document.getElementById('budgetPercentage');
    const progressFill = document.getElementById('progressFill');
    if (budgetPercentageEl) budgetPercentageEl.textContent = `${Math.min(budgetPercentage, 100).toFixed(1)}%`;
    if (progressFill) {
        const percentage = Math.min(budgetPercentage, 100);
        progressFill.style.width = `${percentage}%`;
        progressFill.textContent = percentage >= 30 ? `${Math.floor(percentage)}%` : '';
        progressFill.classList.remove('warning', 'danger');
        if (percentage >= 90) progressFill.classList.add('danger');
        else if (percentage >= 70) progressFill.classList.add('warning');
    }
    
    updatePieChart();
    checkThresholdAlert();
}

function renderExpenses() {
    if (state.expenses.length === 0) {
        expensesListEl.innerHTML = `<div class="empty-state"><span class="material-symbols-outlined">receipt_long</span><p>No expenses added yet</p></div>`;
        return;
    }
    
    const sorted = [...state.expenses].reverse();
    expensesListEl.innerHTML = sorted.map((exp, idx) => {
        const origIdx = state.expenses.length - 1 - idx;
        const date = exp.date ? new Date(exp.date).toLocaleDateString() : 'Just now';
        return `
            <div class="expense-item">
                <div class="expense-info">
                    <span class="material-symbols-outlined">shopping_bag</span>
                    <div>
                        <div class="expense-name">${escapeHtml(exp.name)}</div>
                        <small style="color:var(--text-muted);font-size:0.75rem;">${date}</small>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:1rem;">
                    <span class="expense-amount">${formatConvertedCurrency(exp.amount)}</span>
                    <button class="delete-btn" onclick="deleteExpense(${origIdx})"><span class="material-symbols-outlined">delete</span></button>
                </div>
            </div>
        `;
    }).join('');
}

function updateUI() {
    updateAllCurrencyDisplays();
    renderExpenses();
    saveToLocalStorage();
}

// ==========================================
// 9. EVENT HANDLERS
// ==========================================

function setSalary() {
    const amount = parseFloat(salaryInput.value);
    const error = validateSalary(amount);
    if (error) {
        showError(salaryErrorEl, error);
        salaryInput.value = '';
        return;
    }
    state.salary = amount;
    updateUI();
    salaryInput.value = '';
    showSuccessMessage('✅ Salary updated!');
}

function addExpense() {
    const name = expenseNameInput.value;
    const amount = parseFloat(expenseAmountInput.value);
    const error = validateExpense(name, amount);
    if (error) {
        showError(expenseErrorEl, error);
        expenseNameInput.value = '';
        expenseAmountInput.value = '';
        return;
    }
    if (state.salary === 0) {
        showError(expenseErrorEl, 'Set salary first');
        return;
    }
    
    const currentTotal = state.expenses.reduce((s, e) => s + e.amount, 0);
    const remaining = state.salary - currentTotal;
    if (amount > remaining) {
        alert(`Cannot add ${formatConvertedCurrency(amount)}! Only ${formatConvertedCurrency(remaining)} remaining.`);
        expenseAmountInput.value = '';
        return;
    }
    
    state.expenses.push({ name: name.trim(), amount, id: Date.now(), date: new Date().toISOString() });
    updateUI();
    expenseNameInput.value = '';
    expenseAmountInput.value = '';
    showSuccessMessage(`💰 Added ${formatConvertedCurrency(amount)} for ${name}`);
}

function deleteExpense(index) {
    const exp = state.expenses[index];
    if (confirm(`Delete "${exp.name}" (${formatConvertedCurrency(exp.amount)})?`)) {
        state.expenses.splice(index, 1);
        updateUI();
        showSuccessMessage(`🗑️ Deleted ${exp.name}`);
    }
}

function resetAll() {
    if (confirm('⚠️ Delete ALL data? This cannot be undone!')) {
        state = { salary: 0, expenses: [] };
        updateUI();
        clearLocalStorage();
        showSuccessMessage('🔄 All reset');
    }
}

// ==========================================
// 10. PDF GENERATION
// ==========================================

async function downloadPDF() {
    if (!confirm('Generate PDF report?')) return;
    const btn = document.getElementById('downloadPDFBtn');
    const original = btn.innerHTML;
    btn.innerHTML = '⏳ Generating...';
    btn.disabled = true;
    
    try {
        const element = document.querySelector('.dashboard');
        const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        pdf.save(`CashFlow_${new Date().toISOString().split('T')[0]}.pdf`);
        showSuccessMessage('📄 PDF downloaded!');
    } catch (err) {
        console.error(err);
        alert('PDF failed');
    } finally {
        btn.innerHTML = original;
        btn.disabled = false;
    }
}

// ==========================================
// 11. CURRENCY CHANGE HANDLER
// ==========================================

async function onCurrencyChange() {
    const selector = document.getElementById('currencySelector');
    if (!selector) return;
    currentCurrency = selector.value;
    await fetchExchangeRates();
    await updateExchangeRateInfo();
    updateAllCurrencyDisplays();
    showSuccessMessage(`Currency changed to ${currentCurrency}`);
}

// ==========================================
// 12. THEME TOGGLE
// ==========================================

const themeBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
let savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon.textContent = 'light_mode';
}
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updatePieChart();
    });
}

// ==========================================
// 13. MOBILE HAMBURGER MENU
// ==========================================

const menuIcon = document.querySelector('.menu');
const navPart2 = document.querySelector('.nav_part2');

function toggleMobileMenu() {
    if (navPart2) {
        navPart2.classList.toggle('active');
        menuIcon.textContent = navPart2.classList.contains('active') ? 'close' : 'menu';
    }
}
if (menuIcon) menuIcon.addEventListener('click', toggleMobileMenu);
document.addEventListener('click', (e) => {
    if (navPart2 && navPart2.classList.contains('active') && 
        !navPart2.contains(e.target) && !menuIcon.contains(e.target)) {
        navPart2.classList.remove('active');
        menuIcon.textContent = 'menu';
    }
});
window.addEventListener('resize', () => {
    if (window.innerWidth > 500 && navPart2 && navPart2.classList.contains('active')) {
        navPart2.classList.remove('active');
        if (menuIcon) menuIcon.textContent = 'menu';
    }
});

// ==========================================
// 14. EVENT LISTENERS & INIT
// ==========================================

setSalaryBtn?.addEventListener('click', setSalary);
addExpenseBtn?.addEventListener('click', addExpense);
resetBtn?.addEventListener('click', resetAll);
salaryInput?.addEventListener('keypress', (e) => e.key === 'Enter' && setSalary());
expenseAmountInput?.addEventListener('keypress', (e) => e.key === 'Enter' && addExpense());
document.getElementById('downloadPDFBtn')?.addEventListener('click', downloadPDF);
document.getElementById('currencySelector')?.addEventListener('change', onCurrencyChange);

window.deleteExpense = deleteExpense;
window.closeAlert = closeAlert;

// Initialize
async function init() {
    await fetchExchangeRates();
    loadFromLocalStorage();
    await updateExchangeRateInfo();
    updateUI();
}
init();

setInterval(() => {
    if (state.salary > 0 || state.expenses.length) saveToLocalStorage();
}, 30000);
window.addEventListener('beforeunload', () => saveToLocalStorage());
console.log('✅ Cash-Flow Fully Loaded!');