/**
 * UNIFIED SYSTEM: License Validation + Login Controller
 */

(function () {
    // --- 1. CONFIGURATION ---
    const firebaseConfig = {
        apiKey: "AIzaSyAMnnp5WiV3HAlPSUX73GqG6zxwQRXSpuA",
        authDomain: "lickey-33267.firebaseapp.com",
        databaseURL: "https://lickey-33267-default-rtdb.firebaseio.com",
        projectId: "lickey-33267",
        storageBucket: "lickey-33267.firebasestorage.app",
        messagingSenderId: "283310739978",
        appId: "1:283310739978:web:bc2887db5e9ce5d9ec05f3",
        measurementId: "G-1ZZ1RRZKB2"
    };

    // --- 2. LICENSE SYSTEM LOGIC ---
    function loadFirebase(callback) {
        if (window.firebase) return callback();
        const s1 = document.createElement("script");
        s1.src = "https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js";
        s1.onload = () => {
            const s2 = document.createElement("script");
            s2.src = "https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js";
            s2.onload = callback;
            document.head.appendChild(s2);
        };
        document.head.appendChild(s1);
    }

    function initLicenseSystem() {
        // Double check body exists, if not wait a split second
        if (!document.body) {
            setTimeout(initLicenseSystem, 50);
            return;
        }

        firebase.initializeApp(firebaseConfig);
        const db = firebase.database();
        const storedKey = localStorage.getItem("licenseKey");

        const getServerTime = () => {
            return new Promise((res) => {
                db.ref("/.info/serverTimeOffset").once("value", (snap) => {
                    res(Date.now() + (snap.val() || 0));
                });
            });
        };

        const injectStyles = () => {
            if (document.getElementById('lic-styles')) return;
            const style = document.createElement("style");
            style.id = 'lic-styles';
            style.innerHTML = `
                .lic-wrap { position:fixed; top:0; left:0; width:100%; height:100vh; background:linear-gradient(to bottom, #24243e, #1a1a2e, #0f0c29); display:flex; justify-content:center; align-items:center; z-index:9999999; font-family: sans-serif; color: white; }
                .lic-box { background:#16213e; padding:3rem; border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.6); width:90%; max-width:420px; text-align:center; border:1px solid #e94560; }
                .lic-box h2 { margin:0 0 10px; color:#e94560; }
                .lic-in { width:100%; padding:14px; margin-bottom:20px; border-radius:10px; border:1px solid #0f3460; background:#1a1a2e; color:white; box-sizing:border-box; }
                .lic-btn { background:#e94560; color:white; border:none; padding:14px; border-radius:10px; cursor:pointer; font-weight:bold; width:100%; }
                .lic-status { margin-top:20px; min-height: 24px; }
                .t-err { color:#ff4e4e; } .t-ok { color:#4eff8a; }
            `;
            document.head.appendChild(style);
        };

        window.showUI = (msg = "Enter your license key to continue", isErr = false) => {
            injectStyles();
            document.body.style.overflow = "hidden";
            
            // Remove old overlay if it exists
            const oldOverlay = document.getElementById("lic-overlay");
            if (oldOverlay) oldOverlay.remove();

            const ui = document.createElement('div');
            ui.id = "lic-overlay";
            ui.innerHTML = `
                <div class="lic-wrap">
                    <div class="lic-box">
                        <h2>🔐 System Locked</h2>
                        <p>${msg}</p>
                        <input type="text" id="lic-field" class="lic-in" placeholder="XXXX-XXXX-XXXX-XXXX">
                        <button class="lic-btn" onclick="window.verifyAction()">Activate System</button>
                        <div id="lic-info" class="lic-status ${isErr ? 't-err' : ''}"></div>
                    </div>
                </div>`;
            document.body.appendChild(ui);

            window.verifyAction = async () => {
                const key = document.getElementById('lic-field').value.trim();
                const info = document.getElementById('lic-info');
                if (!key) return info.innerHTML = "❌ Please enter a key.";
                info.innerHTML = "⌛ Verifying...";
                validate(key, true);
            };
        };

        async function validate(key, isManual = false) {
            try {
                const snap = await db.ref("licenses/" + key).once("value");
                const data = snap.val();
                const now = await getServerTime();

                if (!data) throw new Error("Key not found.");
                if (data.status !== "active") throw new Error("License disabled.");
                if (data.expiry && now > data.expiry) throw new Error("License expired.");
                
                const currentHost = window.location.hostname;
                if (data.domain && data.domain !== "" && data.domain !== "localhost" && currentHost !== data.domain) {
                    throw new Error("Locked to: " + data.domain);
                }

                localStorage.setItem("licenseKey", key);
                if (isManual) {
                    document.getElementById('lic-info').innerHTML = "✅ Success!";
                    setTimeout(() => location.reload(), 1000);
                } else {
                    startKiller(key);
                    initLoginController(); // License passed! Launch the app login.
                }
            } catch (e) {
                localStorage.removeItem("licenseKey");
                if (isManual) document.getElementById('lic-info').innerHTML = "❌ " + e.message;
                else window.showUI(e.message, true);
            }
        }

        function startKiller(key) {
            db.ref("licenses/" + key).on("value", async (snap) => {
                const data = snap.val();
                const now = await getServerTime();
                if (!data || data.status !== "active" || (data.expiry && now > data.expiry)) {
                    localStorage.removeItem("licenseKey");
                    location.reload();
                }
            });
        }

        if (!storedKey) window.showUI(); else validate(storedKey);
    }

    // --- 3. LOGIN CONTROLLER LOGIC ---
    function setupLoginListeners() {
        if (typeof lucide !== 'undefined') lucide.createIcons();

        const loginForm = document.getElementById("login-form");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const loginBtn = document.getElementById("login-submit-btn");
        const fallbackBadge = document.getElementById("fallback-badge");

        if (window.MMP_Firebase && !MMP_Firebase.isConfigured() && fallbackBadge) {
            fallbackBadge.style.display = "block";
        }

        if (window.MMP_Firebase) {
            MMP_Firebase.onAuthChanged((user) => {
                if (user) window.location.replace("dashboard.html");
            });
        }

        if (loginForm) {
            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const email = emailInput.value.trim();
                const password = passwordInput.value;

                if (!email || !password) return showToast("Fields required", "error");
                
                const originalBtnHTML = loginBtn.innerHTML;
                loginBtn.disabled = true;
                loginBtn.innerHTML = `Logging in...`;

                try {
                    await MMP_Firebase.loginUser(email, password);
                    showToast("Success!", "success");
                    setTimeout(() => { window.location.href = "dashboard.html"; }, 1000);
                } catch (error) {
                    showToast(error.message || "Failed", "error");
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = originalBtnHTML;
                }
            });
        }
    }

    function initLoginController() {
        // If document is already interactive/complete, bind immediately
        if (document.readyState === "interactive" || document.readyState === "complete") {
            setupLoginListeners();
        } else {
            document.addEventListener("DOMContentLoaded", setupLoginListeners);
        }
    }

    // --- UTILITIES ---
    function showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        if (!container) { alert(message); return; }
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // START EVERYTHING
    loadFirebase(initLicenseSystem);
})();
