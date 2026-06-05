// Money Manager Pro - Dashboard Controller

document.addEventListener("DOMContentLoaded", () => {
  // Global Data States
  let rawUserData = null;
  let currentTheme = "auto";
  let activeTab = "overview";
  
  // Calendar Navigation State
  let calCurrentDate = new Date();
  let calSelectedDateStr = formatDateKey(new Date());

  // Vehicle Categories
  const carCategories = ["Fuel", "Service", "Insurance", "Repair", "Toll", "Parking"];
  const bikeCategories = ["Fuel", "Service", "Insurance", "Repair"];

  // Default Categories
  const defaultIncomeCategories = ["Salary", "Bonus", "Freelance", "Business", "Other"];
  const defaultExpenseCategories = ["Food", "Travel", "Shopping", "Medical", "Personal", "Utility Bills", "Other"];

  // Chart Instances (to prevent double rendering)
  let overviewPieChart = null;
  let reportsPieChart = null;
  let reportsBarChart = null;

  // Active Delete/Edit State Cache
  let activeDeleteId = null;
  let activeDeleteType = null; // 'income', 'expense', or 'vehicle'

  // Initialize UI
  lucide.createIcons();
  setupEventListeners();
  setDefaultDates();

  // ==========================================
  // AUTHENTICATION & INITIALIZATION
  // ==========================================
  MMP_Firebase.onAuthChanged((user) => {
    if (!user) {
      // Redirect to login if unauthenticated
      window.location.replace("index.html");
      return;
    }
    
    // Set up Realtime Database listener
    MMP_Firebase.listenToUserData((data) => {
      rawUserData = data || {};
      
      // Update UI components with fresh database snapshot
      updateUserProfileUI();
      applyUserTheme();
      updateDashboardStats();
      renderRecentTransactions();
      renderCalendar();
      updateCalendarDayDetails(calSelectedDateStr);
      renderTransactionsList();
      renderVehicleExpenses();
      renderCustomCategoriesManager();
      renderReportsAndCharts();
      
      // Refresh Lucide Icons after renders
      lucide.createIcons();
    });
  });

  // Apply visual theme from database settings
  function applyUserTheme() {
    if (rawUserData && rawUserData.settings) {
      currentTheme = rawUserData.settings.theme || "auto";
    }
    
    const htmlElement = document.documentElement;
    if (currentTheme === "dark") {
      htmlElement.setAttribute("data-theme", "dark");
    } else if (currentTheme === "light") {
      htmlElement.setAttribute("data-theme", "light");
    } else {
      // Auto Mode
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      htmlElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
  }

  // Populate Header & Sidebar User Details Card
  function updateUserProfileUI() {
    const profile = (rawUserData && rawUserData.profile) || {};
    const email = profile.email || "No Email Loaded";
    const name = profile.name || "User";
    const phone = profile.phone || "No Mobile Number";

    document.getElementById("sb-user-name").textContent = name;
    document.getElementById("sb-user-phone").textContent = phone;
    document.getElementById("sb-user-email").textContent = email;
  }

  // Pre-fill inputs with default current date and time
  function setDefaultDates() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = today.toTimeString().split(' ')[0].substring(0, 5);

    document.getElementById("income-date").value = dateStr;
    document.getElementById("income-time").value = timeStr;
    document.getElementById("expense-date").value = dateStr;
    document.getElementById("expense-time").value = timeStr;
    document.getElementById("vehicle-date").value = dateStr;
    document.getElementById("vehicle-time").value = timeStr;

    // Filters Date Defaults
    document.getElementById("tx-filter-start").value = dateStr;
    document.getElementById("tx-filter-end").value = dateStr;
  }

  // ==========================================
  // TAB NAVIGATIONCONTROLLER
  // ==========================================
  function setupEventListeners() {
    // Desktop Nav & Mobile Bottom Nav tabs mapping
    const navs = [...document.querySelectorAll(".nav-link"), ...document.querySelectorAll(".mobile-nav-link")];
    navs.forEach(nav => {
      nav.addEventListener("click", (e) => {
        const tab = nav.getAttribute("data-tab");
        if (tab) {
          e.preventDefault();
          switchTab(tab);
        }
      });
    });

    // Logout
    document.getElementById("logout-btn").addEventListener("click", async () => {
      try {
        await MMP_Firebase.logoutUser();
        window.location.href = "index.html";
      } catch (error) {
        showToast("Error logging out.", "error");
      }
    });

    // View All link in Overview Recent Txns
    const viewAllLink = document.getElementById("view-all-tx-link");
    if (viewAllLink) {
      viewAllLink.addEventListener("click", () => switchTab("transactions"));
    }

    // Modal Control Triggers
    setupModalEvents();

    // Custom Category Management form
    document.getElementById("custom-category-form").addEventListener("submit", handleAddCustomCategory);

    // Filters Controls & Search input
    document.getElementById("tx-search-input").addEventListener("input", renderTransactionsList);
    document.getElementById("tx-filter-range").addEventListener("change", handleFilterRangeChange);
    document.getElementById("tx-filter-start").addEventListener("change", renderTransactionsList);
    document.getElementById("tx-filter-end").addEventListener("change", renderTransactionsList);
    document.getElementById("tx-filter-type").addEventListener("change", renderTransactionsList);

    // Vehicle Type choice change inside modal: toggles car/bike sub-categories
    const vhTypeSelect = document.getElementById("vehicle-type");
    vhTypeSelect.addEventListener("change", () => updateVehicleCategoryDropdown(vhTypeSelect.value));

    // Vehicle Tab Filter switches
    const vhTabs = document.querySelectorAll("[data-vh-filter]");
    vhTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        vhTabs.forEach(btn => btn.classList.remove("active"));
        tab.classList.add("active");
        renderVehicleExpenses();
      });
    });

    // Calendar navigation
    document.getElementById("cal-prev-btn").addEventListener("click", () => {
      calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
      renderCalendar();
    });
    document.getElementById("cal-next-btn").addEventListener("click", () => {
      calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
      renderCalendar();
    });

    // Reports sub-tabs switching (Daily, Monthly, Yearly)
    const reportTabs = [
      { btn: "report-tab-daily", period: "daily" },
      { btn: "report-tab-monthly", period: "monthly" },
      { btn: "report-tab-yearly", period: "yearly" }
    ];
    reportTabs.forEach(item => {
      const btn = document.getElementById(item.btn);
      btn.addEventListener("click", () => {
        reportTabs.forEach(x => document.getElementById(x.btn).classList.remove("active"));
        btn.classList.add("active");
        renderReportsAndCharts(item.period);
      });
    });

    // Export Triggers
    document.getElementById("export-excel-btn").addEventListener("click", handleExcelExport);
    document.getElementById("export-pdf-btn").addEventListener("click", handlePDFExport);
  }

  function switchTab(tabId) {
    activeTab = tabId;
    
    // Toggle active link states in both navigation bars
    const navs = [...document.querySelectorAll(".nav-link"), ...document.querySelectorAll(".mobile-nav-link")];
    navs.forEach(nav => {
      if (nav.getAttribute("data-tab") === tabId) {
        nav.classList.add("active");
      } else {
        nav.classList.remove("active");
      }
    });

    // Toggle content panes
    const panes = document.querySelectorAll(".view-pane");
    panes.forEach(pane => {
      if (pane.id === `view-${tabId}`) {
        pane.style.display = "block";
      } else {
        pane.style.display = "none";
      }
    });

    // Format title in Header strip
    const displayTitleMap = {
      "overview": "Overview Dashboard",
      "transactions": "Transaction Ledger",
      "vehicles": "Vehicle Log Book",
      "custom-categories": "Custom Categories",
      "reports": "Analytical Reports"
    };
    document.getElementById("page-display-title").textContent = displayTitleMap[tabId] || "Dashboard";

    // Destroys/re-creates Chart engines to resize properly when switching panes
    if (tabId === "reports") {
      setTimeout(() => renderReportsAndCharts(), 100);
    } else if (tabId === "overview") {
      setTimeout(() => renderOverviewPieChart(), 100);
    }
  }

  function handleFilterRangeChange(e) {
    const range = e.target.value;
    const customDiv = document.getElementById("tx-custom-date-inputs");
    if (range === "custom") {
      customDiv.style.display = "flex";
    } else {
      customDiv.style.display = "none";
    }
    renderTransactionsList();
  }

  // ==========================================
  // MODALS DIALOGS CONTROLLER UTILITIES
  // ==========================================
  function setupModalEvents() {
    // Quick Add Income button
    document.getElementById("quick-add-income-btn").addEventListener("click", () => {
      openModal("income-modal");
      resetIncomeForm();
    });

    // Quick Add Expense button
    document.getElementById("quick-add-expense-btn").addEventListener("click", () => {
      openModal("expense-modal");
      resetExpenseForm();
    });

    // Add Vehicle log button
    document.getElementById("add-vehicle-expense-btn").addEventListener("click", () => {
      openModal("vehicle-modal");
      resetVehicleForm();
    });

    // Register backdrop clicks & close buttons for all modals
    const closeButtons = document.querySelectorAll(".modal-close, .modal-close-btn");
    closeButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const backdrop = btn.closest(".modal-backdrop");
        if (backdrop) closeModal(backdrop.id);
      });
    });

    // Submissions
    document.getElementById("income-form").addEventListener("submit", handleIncomeSubmit);
    document.getElementById("expense-form").addEventListener("submit", handleExpenseSubmit);
    document.getElementById("vehicle-form").addEventListener("submit", handleVehicleSubmit);
    document.getElementById("delete-confirm-btn").addEventListener("click", handleRecordDelete);

    // Setup chip select helpers
    setupChipsListener("income-chips-wrapper", "income-category");
    setupChipsListener("expense-chips-wrapper", "expense-category");
  }

  function openModal(modalId) {
    document.getElementById(modalId).classList.add("show");
  }

  function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("show");
  }

  function setupChipsListener(containerId, inputId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    
    // Event delegation on chips click
    container.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (chip) {
        container.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        input.value = chip.getAttribute("data-val");
      }
    });

    // Remove active chips if user types something else manually
    input.addEventListener("input", () => {
      const val = input.value;
      container.querySelectorAll(".chip").forEach(c => {
        if (c.getAttribute("data-val").toLowerCase() === val.toLowerCase().trim()) {
          c.classList.add("active");
        } else {
          c.classList.remove("active");
        }
      });
    });
  }

  // Injects custom categories dynamically as selectable Chips into Add Modals
  function rebuildChipsWithCustomCategories() {
    const customCats = getCustomCategoriesList();
    
    // 1. Income Chips
    const incomeWrapper = document.getElementById("income-chips-wrapper");
    const activeIncomeVal = document.getElementById("income-category").value;
    const customIncomes = customCats.filter(c => c.type === "income" || c.type === "manual").map(c => c.name);
    const totalIncomes = [...defaultIncomeCategories, ...customIncomes];
    
    incomeWrapper.innerHTML = totalIncomes.map(cat => {
      const isActive = cat.toLowerCase() === activeIncomeVal.toLowerCase().trim() ? "active" : "";
      return `<div class="chip ${isActive}" data-val="${cat}">${cat}</div>`;
    }).join('');

    // 2. Expense Chips
    const expenseWrapper = document.getElementById("expense-chips-wrapper");
    const activeExpenseVal = document.getElementById("expense-category").value;
    const customExpenses = customCats.filter(c => c.type === "expense" || c.type === "manual").map(c => c.name);
    const totalExpenses = [...defaultExpenseCategories, ...customExpenses];

    expenseWrapper.innerHTML = totalExpenses.map(cat => {
      const isActive = cat.toLowerCase() === activeExpenseVal.toLowerCase().trim() ? "active" : "";
      return `<div class="chip ${isActive}" data-val="${cat}">${cat}</div>`;
    }).join('');
  }

  function updateVehicleCategoryDropdown(vehicleType, selectedValue = "") {
    const select = document.getElementById("vehicle-category");
    const list = vehicleType === "car" ? carCategories : bikeCategories;
    
    select.innerHTML = list.map(c => {
      const isSel = c === selectedValue ? "selected" : "";
      return `<option value="${c}" ${isSel}>${c}</option>`;
    }).join('');
  }

  // ==========================================
  // CORE CALCULATIONS AND AGGREGATIONS
  // ==========================================
  
  function getIncomeRecords() {
    if (!rawUserData || !rawUserData.income_records) return [];
    return Object.entries(rawUserData.income_records).map(([id, rec]) => ({ id, type: 'income', ...rec }));
  }

  function getExpenseRecords() {
    if (!rawUserData || !rawUserData.expense_records) return [];
    return Object.entries(rawUserData.expense_records).map(([id, rec]) => ({ id, type: 'expense', ...rec }));
  }

  function getVehicleRecords() {
    if (!rawUserData || !rawUserData.vehicle_expenses) return [];
    return Object.entries(rawUserData.vehicle_expenses).map(([id, rec]) => ({ id, type: 'vehicle', ...rec }));
  }

  function getCustomCategoriesList() {
    if (!rawUserData || !rawUserData.custom_categories) return [];
    return Object.entries(rawUserData.custom_categories).map(([id, cat]) => ({ id, ...cat }));
  }

  // Aggregates and updates Top Summary Cards (Total Balance, Income, Expense, Savings)
  function updateDashboardStats() {
    const incomes = getIncomeRecords();
    const expenses = getExpenseRecords();
    const vehicles = getVehicleRecords();

    // Current Date details for monthly filters
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Calculate totals of all time for Total Balance
    const totalAllIncome = incomes.reduce((sum, r) => sum + r.amount, 0);
    const totalAllExpense = expenses.reduce((sum, r) => sum + r.amount, 0);
    const totalAllVehicle = vehicles.reduce((sum, r) => sum + r.amount, 0);
    const totalBalance = totalAllIncome - (totalAllExpense + totalAllVehicle);

    // Calculate totals for current month
    const thisMonthIncome = incomes.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).reduce((sum, r) => sum + r.amount, 0);

    const thisMonthExpense = expenses.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).reduce((sum, r) => sum + r.amount, 0);

    const thisMonthVehicle = vehicles.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).reduce((sum, r) => sum + r.amount, 0);

    const monthlyExpenseTotal = thisMonthExpense + thisMonthVehicle;
    
    // Monthly Savings = Monthly Income - Monthly Expense
    const monthlySavings = thisMonthIncome - monthlyExpenseTotal;

    // Render numbers in local currency format
    document.getElementById("summary-balance").textContent = formatCurrency(totalBalance);
    document.getElementById("summary-income").textContent = formatCurrency(thisMonthIncome);
    document.getElementById("summary-expense").textContent = formatCurrency(monthlyExpenseTotal);
    document.getElementById("summary-savings").textContent = formatCurrency(monthlySavings);
  }

  // ==========================================
  // TRANSACTION SUBMISSIONS LOGIC (CRUD)
  // ==========================================

  // Reset forms helper routines
  function resetIncomeForm() {
    document.getElementById("income-id").value = "";
    document.getElementById("income-amount").value = "";
    document.getElementById("income-category").value = "Salary";
    document.getElementById("income-note").value = "";
    document.getElementById("income-modal-title").innerHTML = `<i data-lucide="plus-circle" style="color: var(--income);"></i> Add Income`;
    document.getElementById("income-save-btn").textContent = "Save Income";
    setDefaultDates();
    rebuildChipsWithCustomCategories();
  }

  function resetExpenseForm() {
    document.getElementById("expense-id").value = "";
    document.getElementById("expense-amount").value = "";
    document.getElementById("expense-category").value = "Food";
    document.getElementById("expense-note").value = "";
    document.getElementById("expense-modal-title").innerHTML = `<i data-lucide="minus-circle" style="color: var(--expense);"></i> Add Expense`;
    document.getElementById("expense-save-btn").textContent = "Save Expense";
    setDefaultDates();
    rebuildChipsWithCustomCategories();
  }

  function resetVehicleForm() {
    document.getElementById("vehicle-id").value = "";
    document.getElementById("vehicle-type").value = "car";
    document.getElementById("vehicle-amount").value = "";
    document.getElementById("vehicle-note").value = "";
    document.getElementById("vehicle-modal-title").innerHTML = `<i data-lucide="car" style="color: var(--balance);"></i> Log Vehicle Expense`;
    document.getElementById("vehicle-save-btn").textContent = "Log Expense";
    updateVehicleCategoryDropdown("car");
    setDefaultDates();
  }

  // Form submits handlers
  async function handleIncomeSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("income-id").value;
    const amount = document.getElementById("income-amount").value;
    const category = document.getElementById("income-category").value;
    const date = document.getElementById("income-date").value;
    const time = document.getElementById("income-time").value;
    const note = document.getElementById("income-note").value.trim();

    if (!amount || amount <= 0 || !category || !date || !time) {
      showToast("Please enter valid transaction fields.", "error");
      return;
    }

    try {
      if (id) {
        await MMP_Firebase.updateIncome(id, amount, category, date, time, note);
        showToast("Income record updated.", "success");
      } else {
        await MMP_Firebase.saveIncome(amount, category, date, time, note);
        showToast("Income record added.", "success");
      }
      closeModal("income-modal");
    } catch (err) {
      showToast("Operation failed.", "error");
    }
  }

  async function handleExpenseSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("expense-id").value;
    const amount = document.getElementById("expense-amount").value;
    const category = document.getElementById("expense-category").value;
    const date = document.getElementById("expense-date").value;
    const time = document.getElementById("expense-time").value;
    const note = document.getElementById("expense-note").value.trim();

    if (!amount || amount <= 0 || !category || !date || !time) {
      showToast("Please enter valid transaction fields.", "error");
      return;
    }

    try {
      if (id) {
        await MMP_Firebase.updateExpense(id, amount, category, date, time, note);
        showToast("Expense record updated.", "success");
      } else {
        await MMP_Firebase.saveExpense(amount, category, date, time, note);
        showToast("Expense record added.", "success");
      }
      closeModal("expense-modal");
    } catch (err) {
      showToast("Operation failed.", "error");
    }
  }

  async function handleVehicleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("vehicle-id").value;
    const type = document.getElementById("vehicle-type").value;
    const amount = document.getElementById("vehicle-amount").value;
    const category = document.getElementById("vehicle-category").value;
    const date = document.getElementById("vehicle-date").value;
    const time = document.getElementById("vehicle-time").value;
    const note = document.getElementById("vehicle-note").value.trim();

    if (!amount || amount <= 0 || !category || !date || !time) {
      showToast("Please fill in valid transaction fields.", "error");
      return;
    }

    try {
      if (id) {
        await MMP_Firebase.updateVehicleExpense(id, type, category, amount, date, time, note);
        showToast("Vehicle expense updated.", "success");
      } else {
        await MMP_Firebase.saveVehicleExpense(type, category, amount, date, time, note);
        showToast("Vehicle expense logged.", "success");
      }
      closeModal("vehicle-modal");
    } catch (err) {
      showToast("Operation failed.", "error");
    }
  }

  // Open Edit panels depending on transaction item type
  window.editTransaction = (id, type) => {
    if (type === "income") {
      const records = getIncomeRecords();
      const rec = records.find(r => r.id === id);
      if (rec) {
        openModal("income-modal");
        document.getElementById("income-id").value = rec.id;
        document.getElementById("income-amount").value = rec.amount;
        document.getElementById("income-category").value = rec.category;
        document.getElementById("income-date").value = rec.date;
        document.getElementById("income-time").value = rec.time;
        document.getElementById("income-note").value = rec.note || "";
        
        document.getElementById("income-modal-title").innerHTML = `<i data-lucide="edit" style="color: var(--income);"></i> Edit Income`;
        document.getElementById("income-save-btn").textContent = "Update Income";
        
        rebuildChipsWithCustomCategories();
        // Update active chip state manually
        const chips = document.querySelectorAll("#income-chips-wrapper .chip");
        chips.forEach(c => {
          if (c.getAttribute("data-val") === rec.category) c.classList.add("active");
          else c.classList.remove("active");
        });
        lucide.createIcons();
      }
    } else if (type === "expense") {
      const records = getExpenseRecords();
      const rec = records.find(r => r.id === id);
      if (rec) {
        openModal("expense-modal");
        document.getElementById("expense-id").value = rec.id;
        document.getElementById("expense-amount").value = rec.amount;
        document.getElementById("expense-category").value = rec.category;
        document.getElementById("expense-date").value = rec.date;
        document.getElementById("expense-time").value = rec.time;
        document.getElementById("expense-note").value = rec.note || "";

        document.getElementById("expense-modal-title").innerHTML = `<i data-lucide="edit" style="color: var(--expense);"></i> Edit Expense`;
        document.getElementById("expense-save-btn").textContent = "Update Expense";

        rebuildChipsWithCustomCategories();
        const chips = document.querySelectorAll("#expense-chips-wrapper .chip");
        chips.forEach(c => {
          if (c.getAttribute("data-val") === rec.category) c.classList.add("active");
          else c.classList.remove("active");
        });
        lucide.createIcons();
      }
    } else if (type === "vehicle") {
      const records = getVehicleRecords();
      const rec = records.find(r => r.id === id);
      if (rec) {
        openModal("vehicle-modal");
        document.getElementById("vehicle-id").value = rec.id;
        document.getElementById("vehicle-type").value = rec.vehicleType;
        document.getElementById("vehicle-amount").value = rec.amount;
        document.getElementById("vehicle-date").value = rec.date;
        document.getElementById("vehicle-time").value = rec.time;
        document.getElementById("vehicle-note").value = rec.note || "";
        
        document.getElementById("vehicle-modal-title").innerHTML = `<i data-lucide="edit" style="color: var(--balance);"></i> Edit Vehicle Expense`;
        document.getElementById("vehicle-save-btn").textContent = "Update Expense";
        
        updateVehicleCategoryDropdown(rec.vehicleType, rec.category);
        lucide.createIcons();
      }
    }
  };

  // Open Delete confirmation
  window.confirmDeleteTransaction = (id, type) => {
    activeDeleteId = id;
    activeDeleteType = type;
    openModal("delete-confirm-modal");
  };

  async function handleRecordDelete() {
    if (!activeDeleteId || !activeDeleteType) return;
    
    try {
      if (activeDeleteType === "income") {
        await MMP_Firebase.deleteIncome(activeDeleteId);
      } else if (activeDeleteType === "expense") {
        await MMP_Firebase.deleteExpense(activeDeleteId);
      } else if (activeDeleteType === "vehicle") {
        await MMP_Firebase.deleteVehicleExpense(activeDeleteId);
      }
      
      showToast("Transaction deleted successfully.", "success");
      closeModal("delete-confirm-modal");
    } catch (err) {
      showToast("Deletion failed.", "error");
    } finally {
      activeDeleteId = null;
      activeDeleteType = null;
    }
  }

  // Opens a descriptive visual details popup of the entry
  window.viewTransactionDetails = (id, type) => {
    let rec = null;
    if (type === "income") {
      rec = getIncomeRecords().find(r => r.id === id);
    } else if (type === "expense") {
      rec = getExpenseRecords().find(r => r.id === id);
    } else if (type === "vehicle") {
      rec = getVehicleRecords().find(r => r.id === id);
    }

    if (!rec) return;

    openModal("view-details-modal");

    const badge = document.getElementById("view-details-badge");
    const amountLabel = document.getElementById("view-details-amount");
    const typeLabel = document.getElementById("view-details-type");
    const catLabel = document.getElementById("view-details-category");
    const dtLabel = document.getElementById("view-details-datetime");
    const notesBox = document.getElementById("view-details-notes");

    amountLabel.textContent = formatCurrency(rec.amount);
    catLabel.textContent = rec.category;
    dtLabel.textContent = `${formatDate(rec.date)} @ ${rec.time}`;
    notesBox.textContent = rec.note || "No notes entered for this transaction.";

    if (type === "income") {
      typeLabel.textContent = "Income";
      typeLabel.style.color = "var(--income)";
      badge.style.backgroundColor = "var(--income-glow)";
      badge.style.color = "var(--income)";
      badge.innerHTML = `<i data-lucide="trending-up" style="width: 32px; height: 32px; margin-top: 16px;"></i>`;
    } else if (type === "expense") {
      typeLabel.textContent = "Expense";
      typeLabel.style.color = "var(--expense)";
      badge.style.backgroundColor = "var(--expense-glow)";
      badge.style.color = "var(--expense)";
      badge.innerHTML = `<i data-lucide="trending-down" style="width: 32px; height: 32px; margin-top: 16px;"></i>`;
    } else if (type === "vehicle") {
      typeLabel.textContent = `Vehicle Expense (${rec.vehicleType})`;
      typeLabel.style.color = "var(--balance)";
      badge.style.backgroundColor = "var(--balance-glow)";
      badge.style.color = "var(--balance)";
      badge.innerHTML = `<i data-lucide="car" style="width: 32px; height: 32px; margin-top: 16px;"></i>`;
    }
    
    lucide.createIcons();
  };

  // ==========================================
  // RENDERING MODULES - RECENT ACTIVITY
  // ==========================================
  function renderRecentTransactions() {
    const list = getCombinedSortedTransactions();
    const container = document.getElementById("recent-transactions-container");
    
    // Take recent 5 transactions
    const recent = list.slice(0, 5);
    
    if (recent.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 2rem;">No recent records.</div>`;
      return;
    }

    container.innerHTML = recent.map(tx => generateTransactionHTML(tx, true)).join('');
  }

  function getCombinedSortedTransactions() {
    const incomes = getIncomeRecords();
    const expenses = getExpenseRecords();
    const vehicles = getVehicleRecords().map(r => ({
      ...r,
      category: `${r.vehicleType.toUpperCase()} - ${r.category}` // Combine vehicle details in categories for unified view
    }));

    const combined = [...incomes, ...expenses, ...vehicles];
    // Sort descending by date and time (newest first)
    return combined.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB - dateA;
    });
  }

  // Generates item elements
  function generateTransactionHTML(tx, showActions = true) {
    let typeClass = "";
    let amtSign = "";
    let typeBadgeIcon = "";
    let actionType = tx.type; // 'income', 'expense' or 'vehicle'

    if (tx.type === "income") {
      typeClass = "amount-income";
      amtSign = "+";
      typeBadgeIcon = "tx-income-icon";
    } else if (tx.type === "expense") {
      typeClass = "amount-expense";
      amtSign = "-";
      typeBadgeIcon = "tx-expense-icon";
    } else {
      typeClass = "amount-vehicle";
      amtSign = "-";
      typeBadgeIcon = "tx-vehicle-icon";
    }

    let noteHTML = tx.note ? `<div class="tx-notes">${tx.note}</div>` : "";
    
    let actionsHTML = "";
    if (showActions) {
      actionsHTML = `
        <div class="tx-actions">
          <button class="btn btn-secondary btn-icon" onclick="viewTransactionDetails('${tx.id}', '${actionType}')"><i data-lucide="eye"></i></button>
          <button class="btn btn-secondary btn-icon" onclick="editTransaction('${tx.id}', '${actionType}')"><i data-lucide="edit"></i></button>
          <button class="btn btn-danger btn-icon" onclick="confirmDeleteTransaction('${tx.id}', '${actionType}')"><i data-lucide="trash-2"></i></button>
        </div>
      `;
    } else {
      // Small eye details trigger for overview list item
      actionsHTML = `
        <div class="tx-actions">
          <button class="btn btn-secondary btn-icon" onclick="viewTransactionDetails('${tx.id}', '${actionType}')"><i data-lucide="eye"></i></button>
        </div>
      `;
    }

    const iconName = tx.type === "income" ? "trending-up" : (tx.type === "expense" ? "trending-down" : "car");

    return `
      <div class="transaction-item fade-in">
        <div class="tx-icon-wrapper ${typeBadgeIcon}">
          <i data-lucide="${iconName}"></i>
        </div>
        <div class="tx-details">
          <span class="tx-category">${tx.category}</span>
          <div class="tx-meta">
            <span>${formatDate(tx.date)}</span>
            <span>•</span>
            <span>${tx.time}</span>
          </div>
          ${noteHTML}
        </div>
        <div class="tx-amount ${typeClass}">
          ${amtSign}${formatCurrency(tx.amount)}
        </div>
        ${actionsHTML}
      </div>
    `;
  }

  // ==========================================
  // RENDERING MODULES - MASTER LEDGER TABS
  // ==========================================
  function renderTransactionsList() {
    const list = getCombinedSortedTransactions();
    const container = document.getElementById("master-transactions-container");
    const countLabel = document.getElementById("tx-count-label");

    // Grab search and range inputs
    const query = document.getElementById("tx-search-input").value.toLowerCase().trim();
    const range = document.getElementById("tx-filter-range").value;
    const filterType = document.getElementById("tx-filter-type").value;
    const startVal = document.getElementById("tx-filter-start").value;
    const endVal = document.getElementById("tx-filter-end").value;

    let filtered = list;

    // 1. Type Filter
    if (filterType !== "all") {
      filtered = filtered.filter(tx => tx.type === filterType);
    }

    // 2. Date Presets Filters
    const todayStr = formatDateKey(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateKey(yesterday);

    if (range === "today") {
      filtered = filtered.filter(tx => tx.date === todayStr);
    } else if (range === "yesterday") {
      filtered = filtered.filter(tx => tx.date === yesterdayStr);
    } else if (range === "week") {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (startOfWeek.getDay() === 0 ? -6 : 1)); // Map Monday
      startOfWeek.setHours(0,0,0,0);
      filtered = filtered.filter(tx => new Date(tx.date) >= startOfWeek);
    } else if (range === "month") {
      const now = new Date();
      filtered = filtered.filter(tx => {
        const d = new Date(tx.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
    } else if (range === "year") {
      const now = new Date();
      filtered = filtered.filter(tx => new Date(tx.date).getFullYear() === now.getFullYear());
    } else if (range === "custom") {
      if (startVal && endVal) {
        filtered = filtered.filter(tx => tx.date >= startVal && tx.date <= endVal);
      }
    }

    // 3. Query Text Search
    if (query !== "") {
      filtered = filtered.filter(tx => {
        return tx.category.toLowerCase().includes(query) ||
               (tx.note && tx.note.toLowerCase().includes(query)) ||
               tx.amount.toString().includes(query);
      });
    }

    // Update count display
    countLabel.textContent = `Showing ${filtered.length} entries`;

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 4rem;">No transactions match criteria.</div>`;
      return;
    }

    container.innerHTML = filtered.map(tx => generateTransactionHTML(tx, true)).join('');
    lucide.createIcons();
  }

  // ==========================================
  // VEHICLE EXPENSE LOGBOOK
  // ==========================================
  function renderVehicleExpenses() {
    const list = getVehicleRecords();
    const container = document.getElementById("vehicle-expenses-container");
    
    // Calculate total spendings
    const carSum = list.filter(v => v.vehicleType === "car").reduce((sum, v) => sum + v.amount, 0);
    const bikeSum = list.filter(v => v.vehicleType === "bike").reduce((sum, v) => sum + v.amount, 0);

    document.getElementById("vh-car-total-label").textContent = formatCurrency(carSum);
    document.getElementById("vh-bike-total-label").textContent = formatCurrency(bikeSum);

    // Apply vehicle tab filter: 'all', 'car', 'bike'
    const activeFilter = document.querySelector(".tabs button.active[data-vh-filter]").getAttribute("data-vh-filter");
    
    let filtered = list;
    if (activeFilter !== "all") {
      filtered = list.filter(v => v.vehicleType === activeFilter);
    }

    // Sort descending
    filtered.sort((a,b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 4rem;">No vehicle bills logged.</div>`;
      return;
    }

    container.innerHTML = filtered.map(v => generateTransactionHTML(v, true)).join('');
    lucide.createIcons();
  }

  // ==========================================
  // CUSTOM CATEGORIES PANEL
  // ==========================================
  async function handleAddCustomCategory(e) {
    e.preventDefault();
    const nameInput = document.getElementById("new-cat-name");
    const typeSelect = document.getElementById("new-cat-type");

    const name = nameInput.value.trim();
    const type = typeSelect.value;

    if (!name) return;

    try {
      // Save to Firebase
      await MMP_Firebase.saveCustomCategory(name, type);
      showToast(`Custom Category "${name}" added.`, "success");
      nameInput.value = "";
      rebuildChipsWithCustomCategories();
    } catch (err) {
      showToast("Failed to create category.", "error");
    }
  }

  window.deleteCustomCategory = async (id, name) => {
    try {
      await MMP_Firebase.deleteCustomCategory(id);
      showToast(`Deleted category: "${name}"`, "info");
      rebuildChipsWithCustomCategories();
    } catch (err) {
      showToast("Failed to delete category.", "error");
    }
  };

  function renderCustomCategoriesManager() {
    const list = getCustomCategoriesList();
    const container = document.getElementById("custom-categories-container");

    if (list.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-tertiary); padding: 2rem;">No custom categories defined.</div>`;
      return;
    }

    container.innerHTML = list.map(cat => {
      const typeLabelClass = cat.type === "income" ? "cat-income" : (cat.type === "expense" ? "cat-expense" : "cat-manual");
      const icon = cat.type === "income" ? "trending-up" : (cat.type === "expense" ? "trending-down" : "sliders");
      
      return `
        <div class="cat-badge ${typeLabelClass} fade-in">
          <span style="display: flex; align-items: center; gap: 0.35rem;">
            <i data-lucide="${icon}" style="width: 14px; height: 14px;"></i> ${cat.name}
          </span>
          <button class="modal-close" onclick="deleteCustomCategory('${cat.id}', '${cat.name}')" style="background: transparent; border: none; cursor: pointer; color: var(--expense);">
            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      `;
    }).join('');
    
    lucide.createIcons();
  }

  // ==========================================
  // MONTHLY CALENDAR COMPONENT
  // ==========================================
  function renderCalendar() {
    const container = document.getElementById("calendar-days-grid");
    const monthLabel = document.getElementById("cal-month-year-label");

    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthLabel.textContent = `${monthNames[month]} ${year}`;

    // Clear previous date cell nodes, keep headers
    const headers = container.querySelectorAll(".calendar-day-header");
    container.innerHTML = "";
    headers.forEach(h => container.appendChild(h));

    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1...
    // Adjust index so Monday is the first cell
    const adjustedFirstDay = (firstDayIndex + 6) % 7; 
    
    const lastDayDate = new Date(year, month + 1, 0).getDate();

    // 1. Empty prefix cells
    for (let i = 0; i < adjustedFirstDay; i++) {
      const cell = document.createElement("div");
      cell.className = "calendar-cell empty";
      container.appendChild(cell);
    }

    // Grab all records to match dates
    const incomes = getIncomeRecords();
    const expenses = getExpenseRecords();
    const vehicles = getVehicleRecords();
    const todayStr = formatDateKey(new Date());

    // 2. Day cells
    for (let day = 1; day <= lastDayDate; day++) {
      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      cell.textContent = day;

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cell.setAttribute("data-date", dateStr);

      if (dateStr === todayStr) {
        cell.classList.add("today");
      }

      if (dateStr === calSelectedDateStr) {
        cell.classList.add("active-day");
      }

      // Check transaction logs for this day to render indicator dots
      const hasIncome = incomes.some(r => r.date === dateStr);
      const hasExpense = expenses.some(r => r.date === dateStr) || vehicles.some(r => r.date === dateStr);

      if (hasIncome || hasExpense) {
        const dots = document.createElement("div");
        dots.className = "calendar-dots";
        if (hasIncome) {
          const dot = document.createElement("div");
          dot.className = "dot dot-income";
          dots.appendChild(dot);
        }
        if (hasExpense) {
          const dot = document.createElement("div");
          dot.className = "dot dot-expense";
          dots.appendChild(dot);
        }
        cell.appendChild(dots);
      }

      // Register date selection
      cell.addEventListener("click", () => {
        container.querySelectorAll(".calendar-cell").forEach(c => c.classList.remove("active-day"));
        cell.classList.add("active-day");
        calSelectedDateStr = dateStr;
        updateCalendarDayDetails(dateStr);
      });

      container.appendChild(cell);
    }
  }

  function updateCalendarDayDetails(dateStr) {
    document.getElementById("cal-selected-date-label").textContent = formatDate(dateStr);

    const incomes = getIncomeRecords().filter(r => r.date === dateStr);
    const expenses = getExpenseRecords().filter(r => r.date === dateStr);
    const vehicles = getVehicleRecords().filter(r => r.date === dateStr);

    const dayIncome = incomes.reduce((sum, r) => sum + r.amount, 0);
    const dayExpense = expenses.reduce((sum, r) => sum + r.amount, 0) + vehicles.reduce((sum, r) => sum + r.amount, 0);
    const dayBalance = dayIncome - dayExpense;

    document.getElementById("cal-day-income").textContent = formatCurrency(dayIncome);
    document.getElementById("cal-day-expense").textContent = formatCurrency(dayExpense);
    document.getElementById("cal-day-balance").textContent = formatCurrency(dayBalance);

    // Dynamic color values
    const balEl = document.getElementById("cal-day-balance");
    if (dayBalance > 0) balEl.style.color = "var(--income)";
    else if (dayBalance < 0) balEl.style.color = "var(--expense)";
    else balEl.style.color = "var(--text-primary)";

    // List notes
    const combinedNotes = [...incomes, ...expenses, ...vehicles]
                          .filter(r => r.note)
                          .map(r => `• ${r.category}: "${r.note}"`)
                          .join("<br>");

    document.getElementById("cal-day-notes").innerHTML = combinedNotes || "No notes logged for this day.";
  }

  // ==========================================
  // REPORTS VIEW & CHART.JS GRAPH CONTROLLER
  // ==========================================
  function renderReportsAndCharts(period = "daily") {
    // Report labels
    const titleLabel = document.getElementById("report-title-label");
    const periodLabel = document.getElementById("report-period-label");

    const incomes = getIncomeRecords();
    const expenses = getExpenseRecords();
    const vehicles = getVehicleRecords();

    let titleText = "";
    let periodText = "";

    let repIncome = 0;
    let repExpense = 0;

    const now = new Date();
    const todayStr = formatDateKey(now);

    if (period === "daily") {
      titleText = "Daily Summary Ledger";
      periodText = formatDate(todayStr);
      
      repIncome = incomes.filter(r => r.date === todayStr).reduce((sum, r) => sum + r.amount, 0);
      repExpense = expenses.filter(r => r.date === todayStr).reduce((sum, r) => sum + r.amount, 0) +
                   vehicles.filter(r => r.date === todayStr).reduce((sum, r) => sum + r.amount, 0);

    } else if (period === "monthly") {
      titleText = "Monthly Summary Ledger";
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      periodText = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      repIncome = incomes.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).reduce((sum, r) => sum + r.amount, 0);

      repExpense = expenses.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).reduce((sum, r) => sum + r.amount, 0) + vehicles.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).reduce((sum, r) => sum + r.amount, 0);

    } else if (period === "yearly") {
      titleText = "Yearly Summary Ledger";
      periodText = `Year ${now.getFullYear()}`;

      repIncome = incomes.filter(r => new Date(r.date).getFullYear() === now.getFullYear()).reduce((sum, r) => sum + r.amount, 0);
      repExpense = expenses.filter(r => new Date(r.date).getFullYear() === now.getFullYear()).reduce((sum, r) => sum + r.amount, 0) +
                   vehicles.filter(r => new Date(r.date).getFullYear() === now.getFullYear()).reduce((sum, r) => sum + r.amount, 0);
    }

    titleLabel.innerHTML = `<i data-lucide="book-open"></i> ${titleText}`;
    periodLabel.textContent = periodText;

    const repSavings = repIncome - repExpense;
    document.getElementById("rep-income-val").textContent = formatCurrency(repIncome);
    document.getElementById("rep-expense-val").textContent = formatCurrency(repExpense);
    document.getElementById("rep-savings-val").textContent = formatCurrency(repSavings);

    // Refresh Lucide icon
    lucide.createIcons();

    // Render graphs
    renderReportsGraphs();
  }

  // Draw or Redraw Canvas Chart.js graphs
  function renderReportsGraphs() {
    const expenses = getExpenseRecords();
    const vehicles = getVehicleRecords();
    const incomes = getIncomeRecords();

    // 1. Expense Pie Chart Data compiling
    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    vehicles.forEach(v => {
      const cat = `Vech - ${v.vehicleType.toUpperCase()} (${v.category})`;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + v.amount;
    });

    const pieLabels = Object.keys(categoryTotals);
    const pieData = Object.values(categoryTotals);

    // Pie chart colors palette
    const bgColors = [
      '#f87171', '#fb923c', '#fbbf24', '#34d399', '#22d3ee', 
      '#60a5fa', '#818cf8', '#c084fc', '#f472b6', '#a1a1aa'
    ];

    const ctxPie = document.getElementById("reports-pie-chart").getContext("2d");
    if (reportsPieChart) reportsPieChart.destroy();
    
    if (pieData.length === 0) {
      // Draw a fallback empty pie
      reportsPieChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
          labels: ['No Data'],
          datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } else {
      reportsPieChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
          labels: pieLabels,
          datasets: [{
            data: pieData,
            backgroundColor: bgColors.slice(0, pieLabels.length)
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() }
            }
          }
        }
      });
    }

    // 2. Bar Chart Data compiling: Monthly Income vs Expenses (Last 6 Months)
    const monthBuckets = {};
    const now = new Date();
    
    // Generate labels for last 6 months
    const monthLabels = [];
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      monthLabels.push({ key, label: `${monthsShort[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}` });
      monthBuckets[key] = { income: 0, expense: 0 };
    }

    // Bucket incomes
    incomes.forEach(r => {
      const key = r.date.substring(0, 7); // Grab YYYY-MM
      if (monthBuckets[key]) monthBuckets[key].income += r.amount;
    });

    // Bucket expenses
    expenses.forEach(r => {
      const key = r.date.substring(0, 7);
      if (monthBuckets[key]) monthBuckets[key].expense += r.amount;
    });
    vehicles.forEach(r => {
      const key = r.date.substring(0, 7);
      if (monthBuckets[key]) monthBuckets[key].expense += r.amount;
    });

    const barLabels = monthLabels.map(m => m.label);
    const barIncomeData = monthLabels.map(m => monthBuckets[m.key].income);
    const barExpenseData = monthLabels.map(m => monthBuckets[m.key].expense);

    const ctxBar = document.getElementById("reports-bar-chart").getContext("2d");
    if (reportsBarChart) reportsBarChart.destroy();

    reportsBarChart = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: [
          {
            label: 'Income',
            data: barIncomeData,
            backgroundColor: '#10b981'
          },
          {
            label: 'Expense',
            data: barExpenseData,
            backgroundColor: '#ef4444'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() }
          }
        },
        scales: {
          x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() } },
          y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() } }
        }
      }
    });
  }

  // Mini Pie Chart rendering for the main Overview tab
  function renderOverviewPieChart() {
    const expenses = getExpenseRecords();
    const vehicles = getVehicleRecords();

    // Sum category spending
    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    vehicles.forEach(v => {
      const cat = `Vehicle (${v.vehicleType})`;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + v.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    const ctx = document.getElementById("overview-pie-chart").getContext("2d");
    if (overviewPieChart) overviewPieChart.destroy();

    if (data.length === 0) {
      overviewPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['No Data'],
          datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
      return;
    }

    overviewPieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#22d3ee', '#60a5fa', '#818cf8', '#c084fc']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() }
          }
        }
      }
    });
  }

  // ==========================================
  // EXPORT ENGINE (EXCEL & PDF GENERATION)
  // ==========================================
  
  function handleExcelExport() {
    try {
      const incomes = getIncomeRecords();
      const expenses = getExpenseRecords();
      const vehicles = getVehicleRecords();

      // Compile rows in user specified format: Date, Time, Category, Type, Amount, Notes
      const rows = [];

      incomes.forEach(r => {
        rows.push({
          Date: r.date,
          Time: r.time,
          Category: r.category,
          Type: "Income",
          Amount: r.amount,
          Notes: r.note || ""
        });
      });

      expenses.forEach(r => {
        rows.push({
          Date: r.date,
          Time: r.time,
          Category: r.category,
          Type: "Expense",
          Amount: r.amount,
          Notes: r.note || ""
        });
      });

      vehicles.forEach(r => {
        rows.push({
          Date: r.date,
          Time: r.time,
          Category: `${r.vehicleType.toUpperCase()} - ${r.category}`,
          Type: `Vehicle Expense`,
          Amount: r.amount,
          Notes: r.note || ""
        });
      });

      // Sort rows chronological
      rows.sort((a,b) => new Date(a.Date) - new Date(b.Date));

      // Build SheetJS Workbook
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger");

      // Download
      XLSX.writeFile(workbook, "Money_Report.xlsx");
      showToast("Excel Export Completed.", "success");
    } catch (err) {
      console.error(err);
      showToast("Excel Export failed.", "error");
    }
  }

  function handlePDFExport() {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      const profile = (rawUserData && rawUserData.profile) || {};
      const name = profile.name || "User";
      const phone = profile.phone || "N/A";
      const email = profile.email || "N/A";

      // 1. Header user details
      doc.setFontSize(22);
      doc.setTextColor(99, 102, 241); // Indigo color
      doc.text("Money Manager Pro", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Personal Ledger Summary & Report", 14, 25);
      
      // User Profile Card on right
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Name: ${name}`, 130, 20);
      doc.text(`Mobile: ${phone}`, 130, 25);
      doc.text(`Email: ${email}`, 130, 30);
      
      doc.setLineWidth(0.5);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 35, 196, 35);

      // 2. Summary Metrics Table (Cumulative totals)
      const incomes = getIncomeRecords();
      const expenses = getExpenseRecords();
      const vehicles = getVehicleRecords();

      const totalInc = incomes.reduce((s,r) => s+r.amount, 0);
      const totalExp = expenses.reduce((s,r) => s+r.amount, 0) + vehicles.reduce((s,r) => s+r.amount, 0);
      const totalSav = totalInc - totalExp;

      doc.setFontSize(14);
      doc.setTextColor(99, 102, 241);
      doc.text("Financial Summary (All Time)", 14, 45);

      doc.autoTable({
        startY: 50,
        head: [['Metric', 'Total Amount']],
        body: [
          ['Total Incomes', `Rs. ${totalInc.toFixed(2)}`],
          ['Total Expenses & Vehicle Bills', `Rs. ${totalExp.toFixed(2)}`],
          ['Cumulative Savings', `Rs. ${totalSav.toFixed(2)}`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] }
      });

      // 3. Transactions Ledger Details Table
      doc.setFontSize(14);
      doc.setTextColor(99, 102, 241);
      doc.text("Ledger Activity Transactions", 14, doc.lastAutoTable.finalY + 15);

      const tableData = [];
      const combined = getCombinedSortedTransactions();
      combined.forEach(tx => {
        tableData.push([
          tx.date,
          tx.time,
          tx.category,
          tx.type.toUpperCase(),
          `Rs. ${tx.amount.toFixed(2)}`,
          tx.note || ""
        ]);
      });

      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Date', 'Time', 'Category', 'Type', 'Amount', 'Notes']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 8 }
      });

      // 4. Save/Download PDF
      doc.save("Money_Report.pdf");
      showToast("PDF Export Completed.", "success");
    } catch (err) {
      console.error(err);
      showToast("PDF Export failed.", "error");
    }
  }

  // ==========================================
  // VIEW RENDER CONVERT UTILITY ROUTINES
  // ==========================================
  
  // Format numeric values as Currency (INR ₹ by default)
  function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(value);
  }

  // Formats date YYYY-MM-DD to DD-MM-YYYY or readable string
function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

  // Helper date key formatter
  function formatDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Toast Notification helper
  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "info";
    if (type === "success") icon = "check-circle";
    if (type === "error") icon = "alert-circle";
    
    toast.innerHTML = `
      <i class="toast-icon" data-lucide="${icon}"></i>
      <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    // Slide transition
    toast.style.transform = "translateY(0)";
    
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
});
