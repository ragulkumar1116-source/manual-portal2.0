// Money Manager Pro - Firebase Service Interface

// ==========================================
// FIREBASE CONFIGURATION
// Replace the values below with your own Firebase Project Configuration
// ==========================================
const firebaseConfig = {
apiKey: "AIzaSyDIiBdSKMigymz8P4PooMSguP7LoLKvllg",
  authDomain: "hotel-c4382.firebaseapp.com",
  databaseURL: "https://hotel-c4382-default-rtdb.firebaseio.com",
  projectId: "hotel-c4382",
  storageBucket: "hotel-c4382.firebasestorage.app",
  messagingSenderId: "879811080075",
  appId: "1:879811080075:web:656ac50faffced4aee898e",
  measurementId: "G-EGS10RS2V4"
};

// Check if Firebase has been configured by the user
const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey && 
         firebaseConfig.apiKey !== "" && 
         !firebaseConfig.apiKey.startsWith("YOUR_");
};

// Initialize Firebase if configured
let auth, db;
let mockAuth = null;
let mockDb = null;

if (isFirebaseConfigured()) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.database();
    console.log("Firebase initialized successfully.");
  } catch (error) {
    console.error("Firebase initialization failed, falling back to Mock Database:", error);
    setupMockFirebase();
  }
} else {
  console.warn("Firebase credentials not configured. Falling back to client-side Mock Database.");
  setupMockFirebase();
}

// ==========================================
// MOCK DATABASE & AUTHENTICATION FALLBACK
// Stored in localStorage for instant developer preview
// ==========================================
function setupMockFirebase() {
  // Initialize mock storage
  if (!localStorage.getItem("mmp_users")) {
    localStorage.setItem("mmp_users", JSON.stringify({}));
  }
  if (!localStorage.getItem("mmp_active_session")) {
    localStorage.setItem("mmp_active_session", null);
  }

  const getUsers = () => JSON.parse(localStorage.getItem("mmp_users"));
  const setUsers = (users) => localStorage.setItem("mmp_users", JSON.stringify(users));
  
  mockAuth = {
    currentUser: null,
    signInWithEmailAndPassword: async (email, password) => {
      const users = getUsers();
      const user = Object.values(users).find(u => u.profile && u.profile.email === email);
      if (!user || user.profile.password !== password) {
        throw new Error("Invalid email or password.");
      }
      mockAuth.currentUser = { uid: user.profile.uid, email: user.profile.email };
      localStorage.setItem("mmp_active_session", JSON.stringify(mockAuth.currentUser));
      return { user: mockAuth.currentUser };
    },
    createUserWithEmailAndPassword: async (email, password) => {
      const users = getUsers();
      const exists = Object.values(users).find(u => u.profile && u.profile.email === email);
      if (exists) {
        throw new Error("Email address already registered.");
      }
      const uid = "mock_uid_" + Math.random().toString(36).substr(2, 9);
      users[uid] = {
        profile: { uid, email, password },
        income_records: {},
        expense_records: {},
        vehicle_expenses: {},
        custom_categories: {},
        settings: { theme: "auto" }
      };
      setUsers(users);
      mockAuth.currentUser = { uid, email };
      localStorage.setItem("mmp_active_session", JSON.stringify(mockAuth.currentUser));
      return { user: mockAuth.currentUser };
    },
    signOut: async () => {
      mockAuth.currentUser = null;
      localStorage.setItem("mmp_active_session", null);
    },
    sendPasswordResetEmail: async (email) => {
      const users = getUsers();
      const exists = Object.values(users).find(u => u.profile && u.profile.email === email);
      if (!exists) {
        throw new Error("No user found with this email address.");
      }
      return true; // Mock success
    },
    onAuthStateChanged: (callback) => {
      const active = JSON.parse(localStorage.getItem("mmp_active_session"));
      mockAuth.currentUser = active;
      callback(active);
    }
  };

  mockDb = {
    ref: (path) => {
      const parts = path.split('/');
      // Path will be like: money_manager_users/uid/child_type
      const root = parts[0];
      const uid = parts[1];
      const category = parts[2];
      const id = parts[3];

      return {
        set: async (value) => {
          const users = getUsers();
          if (!users[uid]) users[uid] = {};
          
          if (!category) {
            users[uid] = value;
          } else if (!id) {
            users[uid][category] = value;
          } else {
            if (!users[uid][category]) users[uid][category] = {};
            users[uid][category][id] = value;
          }
          setUsers(users);
          triggerListeners(uid);
          return true;
        },
        update: async (value) => {
          const users = getUsers();
          if (!users[uid]) users[uid] = {};
          if (!category) {
            users[uid] = { ...users[uid], ...value };
          } else if (!id) {
            users[uid][category] = { ...users[uid][category], ...value };
          } else {
            users[uid][category][id] = { ...users[uid][category][id], ...value };
          }
          setUsers(users);
          triggerListeners(uid);
          return true;
        },
        push: (value) => {
          const newId = "rec_" + Math.random().toString(36).substr(2, 9);
          const users = getUsers();
          if (!users[uid]) users[uid] = {};
          if (!users[uid][category]) users[uid][category] = {};
          
          users[uid][category][newId] = value;
          setUsers(users);
          triggerListeners(uid);
          
          return {
            key: newId,
            then: (cb) => { cb(); return Promise.resolve(); }
          };
        },
        remove: async () => {
          const users = getUsers();
          if (users[uid] && users[uid][category] && users[uid][category][id]) {
            delete users[uid][category][id];
            setUsers(users);
            triggerListeners(uid);
          }
          return true;
        },
        once: async (event) => {
          const users = getUsers();
          const data = users[uid] ? (category ? (id ? users[uid][category][id] : users[uid][category]) : users[uid]) : null;
          return {
            val: () => data
          };
        },
        on: (event, callback) => {
          if (!window.mockDbListeners) window.mockDbListeners = [];
          window.mockDbListeners.push({ uid, category, callback });
          const users = getUsers();
          const val = users[uid] || null;
          callback({
            val: () => val
          });
        },
        off: () => {
          window.mockDbListeners = (window.mockDbListeners || []).filter(l => l.uid !== uid);
        }
      };
    }
  };

  // Helper function to trigger Realtime database listeners on changes
  function triggerListeners(uid) {
    if (window.mockDbListeners) {
      const users = getUsers();
      window.mockDbListeners.forEach(listener => {
        if (listener.uid === uid) {
          listener.callback({
            val: () => users[uid] || null
          });
        }
      });
    }
  }

  // Bind mock objects
  auth = mockAuth;
  db = mockDb;
}

// ==========================================
// CORE APP METHODS (Drives HTML operations)
// ==========================================

// Authentication Actions
const loginUser = (email, password) => {
  return auth.signInWithEmailAndPassword(email, password);
};

const registerUser = async (name, phone, email, password) => {
  const userCredential = await auth.createUserWithEmailAndPassword(email, password);
  const user = userCredential.user;
  
  // Create profile node
  await db.ref('money_manager_users/' + user.uid + '/profile').set({
    name: name,
    phone: phone,
    email: email
  });
  
  // Set default settings
  await db.ref('money_manager_users/' + user.uid + '/settings').set({
    theme: "auto"
  });

  return user;
};

const logoutUser = () => {
  return auth.signOut();
};

const resetPassword = (email) => {
  return auth.sendPasswordResetEmail(email);
};

const onAuthChanged = (callback) => {
  if (isFirebaseConfigured()) {
    auth.onAuthStateChanged(callback);
  } else {
    auth.onAuthStateChanged(callback);
  }
};

const changePassword = async (newPassword) => {
  if (isFirebaseConfigured()) {
    const user = auth.currentUser;
    return user.updatePassword(newPassword);
  } else {
    // Mock Password Change
    const user = auth.currentUser;
    const users = JSON.parse(localStorage.getItem("mmp_users"));
    if (users[user.uid] && users[user.uid].profile) {
      users[user.uid].profile.password = newPassword;
      localStorage.setItem("mmp_users", JSON.stringify(users));
      return true;
    }
    throw new Error("Mock user not found.");
  }
};

// Database Profile Settings Actions
const updateProfileSettings = (name, phone) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/profile').update({
    name: name,
    phone: phone
  });
};

const updateThemeSettings = (theme) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/settings').update({
    theme: theme
  });
};

// Transaction Management Operations

// 1. Income Records
const saveIncome = (amount, category, date, time, note) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/income_records').push({
    amount: parseFloat(amount),
    category,
    date,
    time,
    note,
    createdAt: Date.now()
  });
};

const updateIncome = (id, amount, category, date, time, note) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/income_records/' + id).set({
    amount: parseFloat(amount),
    category,
    date,
    time,
    note,
    createdAt: Date.now()
  });
};

const deleteIncome = (id) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/income_records/' + id).remove();
};

// 2. Expense Records
const saveExpense = (amount, category, date, time, note) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/expense_records').push({
    amount: parseFloat(amount),
    category,
    date,
    time,
    note,
    createdAt: Date.now()
  });
};

const updateExpense = (id, amount, category, date, time, note) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/expense_records/' + id).set({
    amount: parseFloat(amount),
    category,
    date,
    time,
    note,
    createdAt: Date.now()
  });
};

const deleteExpense = (id) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/expense_records/' + id).remove();
};

// 3. Vehicle Expenses (Separate section with vehicleType: 'car' | 'bike')
const saveVehicleExpense = (vehicleType, category, amount, date, time, note) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/vehicle_expenses').push({
    vehicleType, // 'car' or 'bike'
    category,    // e.g. 'Fuel', 'Service', etc.
    amount: parseFloat(amount),
    date,
    time,
    note,
    createdAt: Date.now()
  });
};

const updateVehicleExpense = (id, vehicleType, category, amount, date, time, note) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/vehicle_expenses/' + id).set({
    vehicleType,
    category,
    amount: parseFloat(amount),
    date,
    time,
    note,
    createdAt: Date.now()
  });
};

const deleteVehicleExpense = (id) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/vehicle_expenses/' + id).remove();
};

// 4. Custom Categories Operations
const saveCustomCategory = (name, type) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/custom_categories').push({
    name,
    type // 'income' or 'expense'
  });
};

const deleteCustomCategory = (id) => {
  const uid = auth.currentUser.uid;
  return db.ref('money_manager_users/' + uid + '/custom_categories/' + id).remove();
};

// Load Realtime Data listener
const listenToUserData = (callback) => {
  if (!auth.currentUser) return () => {};
  const uid = auth.currentUser.uid;
  const dbRef = db.ref('money_manager_users/' + uid);
  dbRef.on('value', (snapshot) => {
    callback(snapshot.val());
  });
  
  // Return deregister handle
  return () => dbRef.off();
};

// Export to Global namespace
window.MMP_Firebase = {
  isConfigured: isFirebaseConfigured,
  loginUser,
  registerUser,
  logoutUser,
  resetPassword,
  onAuthChanged,
  changePassword,
  updateProfileSettings,
  updateThemeSettings,
  saveIncome,
  updateIncome,
  deleteIncome,
  saveExpense,
  updateExpense,
  deleteExpense,
  saveVehicleExpense,
  updateVehicleExpense,
  deleteVehicleExpense,
  saveCustomCategory,
  deleteCustomCategory,
  listenToUserData
};
