/* CiviAI shared frontend helpers.
   Edit API_BASE to point at your deployed backend before uploading. */
const API_BASE = window.CIVIAI_API_BASE || "https://civiai-backend.fastapicloud.dev";
const TOKEN_KEY = "civiai_token";

function getToken(){ return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); }
function setToken(t, remember){
  if (remember === false) { sessionStorage.setItem(TOKEN_KEY, t); localStorage.removeItem(TOKEN_KEY); }
  else { localStorage.setItem(TOKEN_KEY, t); sessionStorage.removeItem(TOKEN_KEY); }
}
function clearToken(){ localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); }
function isLoggedIn(){ return !!getToken(); }

/**
 * Thin wrapper around fetch. Throws an Error with a readable message on
 * any non-2xx response or network failure, so callers can just try/catch
 * and show state.error instead of re-implementing this everywhere.
 */
async function apiFetch(path, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  let response;
  try {
    response = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
  } catch (e) {
    throw new Error("Could not reach the CiviAI API. Check API_BASE and your network connection.");
  }

  if (response.status === 401) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch (e) { /* response wasn't JSON, keep statusText */ }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  if (response.status === 204) return null;
  return response.json();
}

async function loginRequest(email, password, remember) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token, remember);
  return data;
}

/* ---- formatting helpers ---- */
function formatNaira(amount) {
  if (amount === null || amount === undefined) return "Not available";
  const abs = Math.abs(amount);
  if (abs >= 1e9) return "\u20a6" + (amount / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "\u20a6" + (amount / 1e6).toFixed(2) + "M";
  return "\u20a6" + amount.toLocaleString();
}

function formatDate(value) {
  if (!value) return "Not available";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/* ---- toast ---- */
function ensureToastHost() {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    document.body.appendChild(host);
  }
  return host;
}
function showToast(message, isError) {
  const host = ensureToastHost();
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " toast-error" : "");
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ---- auth gate: shown when there's no token yet ---- */
function renderAuthGate(onSuccess) {
  if (isLoggedIn()) return;
  if (document.getElementById("auth-gate")) return;

  const gate = document.createElement("div");
  gate.id = "auth-gate";
  gate.innerHTML = `
    <div class="auth-box">
      <div class="vlogin-top">
        <div class="vlogin-brand">
          <img src="assets/logo.png" alt="CiviAI logo">
          <div>
            <div class="name">CIVI<span>AI</span></div>
            <div class="sub">Verification Console</div>
          </div>
        </div>
        <div class="vlogin-shield">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
      </div>

      <div class="vlogin-tagline">Trusted information. Stronger decisions.</div>
      <div class="vlogin-heading">Welcome to the<span>Verification Console</span></div>
      <div class="vlogin-sub">Verify, validate and build trust in information.</div>

      <div class="vlogin-field">
        <span class="field-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg></span>
        <label>Email address</label>
        <input type="email" id="ag-email" placeholder="you@example.com">
      </div>
      <div class="vlogin-field">
        <span class="field-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
        <label>Password</label>
        <input type="password" id="ag-password" placeholder="Enter your password">
        <button type="button" class="toggle-eye" id="ag-toggle-eye">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>

      <div id="ag-error" class="error-state hidden" style="margin-bottom:14px;"></div>

      <button class="vlogin-btn" id="ag-submit">
        Sign In <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>
      </button>

      <div class="vlogin-row">
        <label class="vlogin-remember"><input type="checkbox" id="ag-remember" checked> Remember me</label>
        <button class="vlogin-forgot" id="ag-forgot">Forgot password?</button>
      </div>

      <div class="vlogin-footer">
        <img src="assets/logo.png" alt="">
        <div>
          <div class="name">CIVI<span>AI</span></div>
          <div class="tag">Verification Console &middot; People. Projects. Progress.</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(gate);

  const errorBox = gate.querySelector("#ag-error");
  const pwField = gate.querySelector("#ag-password");
  gate.querySelector("#ag-toggle-eye").addEventListener("click", () => {
    pwField.type = pwField.type === "password" ? "text" : "password";
  });

  gate.querySelector("#ag-forgot").addEventListener("click", async () => {
    const email = gate.querySelector("#ag-email").value.trim();
    errorBox.classList.add("hidden");
    if (!email) {
      errorBox.textContent = "Enter your email address first, then tap \u201cForgot password?\u201d again.";
      errorBox.classList.remove("hidden");
      return;
    }
    try {
      const res = await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      showToast(res.message || "If that email exists, a reset link has been sent.");
    } catch (e) {
      showToast(e.message, true);
    }
  });

  gate.querySelector("#ag-submit").addEventListener("click", async () => {
    const email = gate.querySelector("#ag-email").value.trim();
    const password = pwField.value;
    const remember = gate.querySelector("#ag-remember").checked;
    errorBox.classList.add("hidden");
    if (!email || !password) {
      errorBox.textContent = "Enter both an email and password.";
      errorBox.classList.remove("hidden");
      return;
    }
    try {
      await loginRequest(email, password, remember);
      gate.remove();
      if (onSuccess) onSuccess();
    } catch (e) {
      errorBox.textContent = e.message;
      errorBox.classList.remove("hidden");
    }
  });
}
