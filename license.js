/**
 * MONEY MANAGER PRO - UNIFIED LICENSE SYSTEM
 * Security Architecture: Gatekeeper Pattern (Client Defended)
 */
(function () {
    // 1. License Database Configuration
    const licFirebaseConfig = {
        apiKey: "AIzaSyAMnnp5WiV3HAlPSUX73GqG6zxwQRXSpuA",
        authDomain: "lickey-33267.firebaseapp.com",
        databaseURL: "https://lickey-33267-default-rtdb.firebaseio.com",
        projectId: "lickey-33267",
        storageBucket: "lickey-33267.firebasestorage.app",
        messagingSenderId: "283310739978",
        appId: "1:283310739978:web:bc2887db5e9ce5d9ec05f3",
        measurementId: "G-1ZZ1RRZKB2"
    };

    let licDb;

    function initLicenseSystem() {
        // Safe check for multi-app initialization variants
        const licApp = firebase.initializeApp(licFirebaseConfig, "licSystemInstance");
        licDb = licApp.database();
        
        const storedKey = localStorage.getItem("mmp_license_key");

        if (!storedKey) {
            showLicUI();
        } else {
            validateLic(storedKey);
        }
    }

    // Prevents system clock manipulation tricks
    function getNetworkTime() {
        return new Promise((resolve) => {
            licDb.ref("/.info/serverTimeOffset").once("value", (snap) => {
                resolve(Date.now() + (snap.val() || 0));
            });
        });
    }

    function injectLicStyles() {
        if (document.getElementById('lic-core-styles')) return;
        const style = document.createElement("style");
        style.id = 'lic-core-styles';
        style.innerHTML = `
            .lic-wrap { position:fixed; top:0; left:0; width:100%; height:100vh; background:#0f0c29; background:linear-gradient(to bottom, #1e1b4b, #0f172a, #020617); display:flex; justify-content:center; align-items:center; z-index:9999999; font-family: system-ui, -apple-system, sans-serif; color: white; }
            .lic-box { background:#1e293b; padding:2.5rem; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); width:90%; max-width:400px; text-align:center; border:1px solid #334155; }
            .lic-box h2 { margin:0 0 8px; color:#f43f5e; font-size:1.6rem; font-weight:700; }
            .lic-box p { color: #94a3b8; margin-bottom: 24px; font-size:0.95rem; line-height:1.5; }
            .lic-in { width:100%; padding:14px; margin-bottom:16px; border-radius:8px; border:1px solid #475569; background:#0f172a; color:white; font-size:1.1rem; text-align:center; box-sizing:border-box; outline:none; font-family:monospace; letter-spacing:1px; }
            .lic-in:focus { border-color: #f43f5e; box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.2); }
            .lic-btn { background:#f43f5e; color:white; border:none; padding:14px; border-radius:8px; cursor:pointer; font-weight:600; width:100%; font-size:1rem; transition: 0.2s ease; }
            .lic-btn:hover { background:#e11d48; }
            .lic-status { margin-top:16px; font-weight: 500; font-size:0.9rem; min-height: 20px; }
            .t-err { color:#f87171; } .t-ok { color:#4ade80; }
        `;
        document.head.appendChild(style);
    }

    function showLicUI(errMsg = "Activation key required to access Money Manager Pro.", isErr = false) {
        injectLicStyles();
        document.body.style.overflow = "hidden";
        document.getElementById("app-secure-container").style.display = "none";

        const root = document.getElementById("license-overlay-root");
        root.innerHTML = `
            <div class="lic-wrap">
              <div class="lic-box">
                <h2>🔐 Software Lock</h2>
                <p id="lic-desc-msg">${errMsg}</p>
                <input type="text" id="lic-input-field" class="lic-in" placeholder="XXXX-XXXX-XXXX-XXXX" value="${localStorage.getItem("mmp_license_key") || ''}">
                <button class="lic-btn" id="lic-auth-btn">Activate Instance</button>
                <div id="lic-feedback" class="lic-status ${isErr ? 't-err' : ''}"></div>
              </div>
            </div>
        `;

        document.getElementById("lic-auth-btn").addEventListener("click", () => {
            const key = document.getElementById('lic-input-field').value.trim();
            const feedback = document.getElementById('lic-feedback');
            if (!key) {
                feedback.className = "lic-status t-err";
                feedback.innerHTML = "❌ Key input cannot be blank.";
                return;
            }
            feedback.className = "lic-status";
            feedback.innerHTML = "⌛ Validating platform registry...";
            validateLic(key, true);
        });
    }

    async function validateLic(key, isManualTrigger = false) {
        try {
            const snap = await licDb.ref("licenses/" + key).once("value");
            const data = snap.val();
            const currentTime = await getNetworkTime();

            if (!data) throw new Error("License key matching record not found.");
            if (data.status !== "active") throw new Error("This developer license has been suspended.");
            if (data.expiry && currentTime > data.expiry) {
                throw new Error("Expired: " + new Date(data.expiry).toLocaleDateString());
            }

            // Domain Matching
            const host = window.location.hostname;
            if (data.domain && data.domain !== "" && data.domain !== "localhost" && data.domain !== "127.0.0.1") {
                if (host !== data.domain) throw new Error("Unlicensed domain space: " + host);
            }

            // Success Execution
            localStorage.setItem("mmp_license_key", key);

            if (isManualTrigger) {
                const feedback = document.getElementById('lic-feedback');
                feedback.className = "lic-status t-ok";
                feedback.innerHTML = `✅ Confirmed. Registered to ${data.user || 'Enterprise Operator'}`;
                setTimeout(() => {
                    location.reload();
                }, 1200);
            } else {
                // Remove locks and mount primary app context safely
                document.getElementById("license-overlay-root").innerHTML = "";
                document.body.style.overflow = "auto";
                document.getElementById("app-secure-container").style.display = "block";
                
                // Track backend changes continuously
                attachLiveKillswitch(key);
            }

        } catch (err) {
            localStorage.removeItem("mmp_license_key");
            if (isManualTrigger) {
                const feedback = document.getElementById('lic-feedback');
                feedback.className = "lic-status t-err";
                feedback.innerHTML = "❌ " + err.message;
            } else {
                showLicUI(err.message, true);
            }
        }
    }

    function attachLiveKillswitch(key) {
        licDb.ref("licenses/" + key).on("value", async (snap) => {
            const data = snap.val();
            const currentTime = await getNetworkTime();

            const dropInstance = !data || 
                                 data.status !== "active" || 
                                 (data.expiry && currentTime > data.expiry);

            if (dropInstance) {
                localStorage.removeItem("mmp_license_key");
                location.reload(); 
            }
        });
    }

    // Dynamic Engine Checker
    if (window.firebase) {
        initLicenseSystem();
    } else {
        window.addEventListener('load', () => {
            if(window.firebase) initLicenseSystem();
        });
    }
})();
