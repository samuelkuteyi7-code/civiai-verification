/* CiviAI shared frontend helpers.
   Edit API_BASE to point at your deployed backend before uploading. */
const API_BASE = window.CIVIAI_API_BASE || "https://civiai-backend.fastapicloud.dev";
const TOKEN_KEY = "civiai_token";

function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }
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

async function loginRequest(email, password) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
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
    <div class="auth-box card">
      <div class="auth-title">Sign in to CiviAI</div>
      <div class="auth-sub">Use your existing CiviAI account to continue.</div>
      <div class="field">
        <label>Email</label>
        <input type="email" id="ag-email" placeholder="you@example.com">
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" id="ag-password" placeholder="Password">
      </div>
      <div id="ag-error" class="error-state hidden" style="margin-bottom:12px;"></div>
      <button class="btn btn-primary" id="ag-submit" style="width:100%;">Sign in</button>
    </div>
  `;
  document.body.appendChild(gate);

  const errorBox = gate.querySelector("#ag-error");
  gate.querySelector("#ag-submit").addEventListener("click", async () => {
    const email = gate.querySelector("#ag-email").value.trim();
    const password = gate.querySelector("#ag-password").value;
    errorBox.classList.add("hidden");
    if (!email || !password) {
      errorBox.textContent = "Enter both an email and password.";
      errorBox.classList.remove("hidden");
      return;
    }
    try {
      await loginRequest(email, password);
      gate.remove();
      if (onSuccess) onSuccess();
    } catch (e) {
      errorBox.textContent = e.message;
      errorBox.classList.remove("hidden");
    }
  });
}
