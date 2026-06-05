/**
 * UNIFIED LICENSE SYSTEM - CLIENT ENGINE
 */
(function () {
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

    async function init() {
        firebase.initializeApp(firebaseConfig);
        const db = firebase.database();
        const storedKey = localStorage.getItem("licenseKey");
        const currentFilename = window.location.pathname.split("/").pop() || "index.html";

        // Fetch redirection paths from JSON config
        let config = { activatedRedirect: "index.html", licensePage: "license.html" };
        try {
            const res = await fetch('license-config.json');
            if (res.ok) config = await res.json();
        } catch(e) { console.warn("Config file parsing failed, using defaults."); }

        function getServerTime() {
            return new Promise((res) => {
                db.ref("/.info/serverTimeOffset").once("value", (snap) => {
                    res(Date.now() + (snap.val() || 0));
                });
            });
        }

        // Run validation logic
        async function validate(key, isManual = false) {
            const info = document.getElementById('lic-info');
            try {
                const snap = await db.ref("licenses/" + key).once("value");
                const data = snap.val();
                const now = await getServerTime();

                if (!data) throw new Error("Key not found in database.");
                if (data.status !== "active") throw new Error("This license has been disabled.");
                if (data.expiry && now > data.expiry) throw new Error("License expired.");
                
                const currentHost = window.location.hostname;
                if (data.domain && data.domain !== "" && data.domain !== "localhost" && currentHost !== data.domain) {
                    throw new Error("This key is locked to: " + data.domain);
                }

                // If Validated Successfully
                localStorage.setItem("licenseKey", key);
                
                if (isManual && info) {
                    info.className = "lic-status t-ok";
                    info.innerHTML = `✅ Welcome, ${data.user || 'Authorized User'}!`;
                    setTimeout(() => { window.location.href = config.activatedRedirect; }, 1500);
                } else {
                    // Start the real-time kill switch listener
                    startKiller(key);
                    // If they are hanging around on the license page but are active, route them out
                    if (currentFilename === config.licensePage) {
                        window.location.href = config.activatedRedirect;
                    }
                }
            } catch (e) {
                localStorage.removeItem("licenseKey");
                if (isManual && info) {
                    info.className = "lic-status t-err";
                    info.innerHTML = "❌ " + e.message;
                } else if (currentFilename !== config.licensePage) {
                    window.location.href = config.licensePage;
                }
            }
        }

        function startKiller(key) {
            db.ref("licenses/" + key).on("value", async (snap) => {
                const data = snap.val();
                const now = await getServerTime();
                const isInvalid = !data || data.status !== "active" || (data.expiry && now > data.expiry);

                if (isInvalid) {
                    localStorage.removeItem("licenseKey");
                    window.location.href = config.licensePage;
                }
            });
        }

        // Manual Hook-Up if run inside license.html UI
        const btn = document.getElementById('activate-btn');
        if (btn) {
            btn.onclick = () => {
                const key = document.getElementById('lic-field').value.trim();
                if (!key && info) return info.innerHTML = "❌ Please enter a key.";
                if (info) { info.className = "lic-status"; info.innerHTML = "⌛ Verifying..."; }
                validate(key, true);
            };
        }

        // Automatic Check Routine upon file entry
        if (!storedKey) {
            if (currentFilename !== config.licensePage) {
                window.location.href = config.licensePage;
            }
        } else {
            validate(storedKey);
        }
    }

    loadFirebase(init);
})();
