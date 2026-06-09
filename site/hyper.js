function switchAuthTab(target) {
  hideAuthResult();
  document.querySelectorAll("[data-auth-tab]").forEach((button) => button.classList.toggle("active", button.dataset.authTab === target));
  document.querySelectorAll("[data-auth-form]").forEach((form) => form.classList.toggle("active", form.dataset.authForm === target));
  if (target === "signup") {
    window.requestAnimationFrame(() => window.mountTurnstile?.(document.querySelector('[data-signup-form]') || document));
  }
}

function markHyperPortalSession(mode = "view_only") {
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `visorcore_hyper_session=${encodeURIComponent(mode)}; Path=/; Domain=.visorcore.com; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
  tab.addEventListener("click", () => switchAuthTab(tab.dataset.authTab));
});

document.querySelectorAll("[data-auth-focus]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    switchAuthTab(button.dataset.authFocus);
    document.querySelector("#signin")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

function showAuthResult(kicker, title, message, primaryLabel = "Open View-Only Console") {
  const forms = document.querySelector('[data-auth-stage="forms"]');
  const result = document.querySelector('[data-auth-stage="result"]');
  if (!result) return;
  result.hidden = false;
  result.removeAttribute("aria-hidden");
  forms?.classList.add("is-exiting");
  setTimeout(() => {
    if (forms) {
      forms.hidden = true;
      forms.setAttribute("aria-hidden", "true");
      forms.classList.remove("is-active");
    }
    result.classList.add("is-active");
    result.querySelector("[data-auth-result-kicker]").textContent = kicker;
    result.querySelector("[data-auth-result-title]").textContent = title;
    result.querySelector("[data-auth-result-message]").textContent = message;
    const primary = result.querySelector("[data-preview-console]");
    if (primary) primary.textContent = primaryLabel;
  }, 180);
}

function hideAuthResult() {
  const forms = document.querySelector('[data-auth-stage="forms"]');
  const result = document.querySelector('[data-auth-stage="result"]');
  result?.classList.remove("is-active");
  if (result) {
    result.hidden = true;
    result.setAttribute("aria-hidden", "true");
  }
  if (forms) {
    forms.hidden = false;
    forms.removeAttribute("aria-hidden");
    forms.classList.remove("is-exiting");
    forms.classList.add("is-active");
  }
}

document.querySelectorAll("[data-auth-back]").forEach((button) => {
  button.addEventListener("click", () => {
    hideAuthResult();
  });
});

function showConsole(selector, mode = "view_only", account = null) {
  const consoleEl = document.querySelector(selector);
  if (!consoleEl) return;
  const isStaffConsole = consoleEl.hasAttribute("data-staff-console");
  const hasAccount = isStaffConsole || !!account || !!getStoredAccount();
  document.body.classList.toggle("is-console-active", hasAccount);
  consoleEl.classList.add("is-visible-console");
  consoleEl.classList.toggle("is-account-console", hasAccount);
  setConsoleAccess(mode, account);
  if (!isStaffConsole) renderAccountUi(account || getStoredAccount());
  consoleEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setConsoleAccess(mode, account = null) {
  const consoleEl = document.querySelector("[data-console]");
  if (!consoleEl) return;
  const fullAccess = mode === "full_access";
  consoleEl.dataset.accessMode = fullAccess ? "full" : "locked";
  consoleEl.classList.toggle("is-locked", !fullAccess);
  consoleEl.classList.toggle("is-unlocked", fullAccess);
  const note = consoleEl.querySelector("[data-access-note]");
  if (note) {
    note.textContent = fullAccess
      ? `Full management access unlocked${account?.company ? ` for ${account.company}` : ""}.`
      : "View-only mode. Confirm your email to unlock add, edit, delete, and host onboarding actions.";
  }
  if (account?.company) {
    consoleEl.querySelectorAll("[data-workspace-name], [data-workspace-title]").forEach((workspace) => {
      workspace.textContent = account.company;
    });
  }
  consoleEl.querySelectorAll("[data-host-open], .action-bar button").forEach((button) => {
    button.disabled = !fullAccess;
    button.setAttribute("aria-disabled", fullAccess ? "false" : "true");
  });
  const hasHosts = false;
  consoleEl.querySelectorAll("[data-host-scope], [data-host-sync-mode], [data-host-sync-target]").forEach((control) => {
    control.disabled = !hasHosts;
  });
}

document.querySelectorAll("[data-preview-console]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showConsole("[data-console]", localStorage.getItem("visorcore-hyper-access") || "view_only", getStoredAccount());
  });
});

document.querySelectorAll("[data-show-staff]").forEach((button) => {
  button.addEventListener("click", () => showConsole("[data-staff-console]", "full_access"));
});

async function submitStaffLogin(form) {
  const status = form.querySelector("[data-staff-status]");
  const submit = form.querySelector('button[type="submit"]');
  if (status) {
    status.textContent = "Checking staff credentials...";
    status.className = "form-status";
  }
  if (submit) submit.disabled = true;
  try {
    const response = await fetch("/api/staff/login", {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    if (!data.success) {
      if (status) {
        status.textContent = data.message || "Staff login failed.";
        status.classList.add("bad");
      }
      return;
    }
    localStorage.setItem("visorcore-staff-admin", JSON.stringify(data.admin || {}));
    renderStaffAdmin(data.admin || {});
    if (status) {
      status.textContent = data.admin?.mfa_required ? "Staff console unlocked." : "Staff console unlocked. MFA is temporarily disabled for this account.";
      status.classList.add("ok");
    }
    showConsole("[data-staff-console]", "full_access");
    loadStaffDashboard();
  } catch {
    if (status) {
      status.textContent = "The staff login service could not be reached.";
      status.classList.add("bad");
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

document.querySelectorAll("[data-staff-login-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitStaffLogin(form);
  });
});

function getStoredAccount() {
  try {
    return JSON.parse(localStorage.getItem("visorcore-hyper-account") || "null");
  } catch {
    return null;
  }
}

function passwordRuleState(password) {
  const lower = password.toLowerCase();
  const blocked = ["password", "hello", "welcome", "admin", "administrator", "visorcore", "hyperv", "qwerty", "letmein"];
  const allowedSymbol = /[!@#$%^&*();:,"'<>?\/{}\[\]|~]/;
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: allowedSymbol.test(password),
    blocked: password !== "" && !blocked.some((word) => lower.includes(word)),
  };
}

function updatePasswordRules(input) {
  const form = input.closest("form");
  const rules = form?.querySelector("[data-password-rules]");
  if (!rules) return true;
  if (input.hasAttribute("data-password-optional") && input.value === "") {
    rules.querySelectorAll("span").forEach((rule) => rule.classList.remove("is-valid"));
    return true;
  }
  const state = passwordRuleState(input.value);
  Object.entries(state).forEach(([name, valid]) => {
    rules.querySelector(`[data-rule="${name}"]`)?.classList.toggle("is-valid", valid);
  });
  return Object.values(state).every(Boolean);
}

document.querySelectorAll("[data-password-field]").forEach((input) => {
  input.addEventListener("input", () => updatePasswordRules(input));
  updatePasswordRules(input);
});

async function submitAuthForm(form, endpoint) {
  const status = form.querySelector("[data-auth-status]");
  const submit = form.querySelector('button[type="submit"]');
  if (endpoint.includes("signup")) {
    const password = form.querySelector("[data-password-field]");
    if (password && !updatePasswordRules(password)) {
      if (status) {
        status.textContent = "Password must meet every listed requirement.";
        status.className = "form-status bad";
      }
      return;
    }
    if (!form.querySelector('[name="cf-turnstile-response"]')) {
      if (status) {
        status.textContent = "Please complete the security challenge.";
        status.className = "form-status bad";
      }
      window.mountTurnstile?.(form);
      return;
    }
  }
  if (status) {
    status.textContent = "Working...";
    status.className = "form-status";
  }
  if (submit) submit.disabled = true;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    if (!data.success) {
      if (status) {
        status.textContent = data.message || "The request could not be completed.";
        status.classList.add("bad");
      }
      return;
    }
    if (data.account) {
      storeAccount(data.account, data.mode || "view_only");
      markHyperPortalSession(data.mode || "view_only");
    }
    if (endpoint.includes("signup")) {
      showAuthResult("Confirmation link sent", "Verify your account to unlock full control.", data.message || "We sent a secure confirmation link from hyper@visorcore.com. You can preview the console now, then return for full management access after verification.");
      showConsole("[data-console]", "view_only", data.account);
    } else {
      const full = data.mode === "full_access";
      showAuthResult(full ? "Signed in" : "Email confirmation needed", full ? "Console unlocked." : "Verify your email to unlock full control.", data.message || "", full ? "Open Console" : "Open View-Only Console");
      showConsole("[data-console]", data.mode || "view_only", data.account);
    }
  } catch {
    if (status) {
      status.textContent = "The portal could not reach the account service.";
      status.classList.add("bad");
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

document.querySelectorAll("[data-signup-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAuthForm(form, "/api/auth/signup");
  });
});

document.querySelectorAll("[data-login-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAuthForm(form, "/api/auth/login");
  });
});

document.querySelectorAll("[data-forgot-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.forgotToggle;
    const form = document.querySelector(`[data-forgot-form][data-forgot-type="${type}"]`);
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector("input")?.focus();
  });
});

document.querySelectorAll("[data-forgot-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-forgot-status]");
    const submit = form.querySelector('button[type="submit"]');
    const body = new FormData(form);
    body.set("type", form.dataset.forgotType || "client");
    status.textContent = "Sending reset email...";
    status.className = "form-status";
    if (submit) submit.disabled = true;
    try {
      const response = await fetch("/api/password/forgot", {
        method: "POST",
        body,
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await response.json();
      status.textContent = data.message || "If that account exists, a password reset email has been sent.";
      status.classList.add(data.success ? "ok" : "bad");
    } catch {
      status.textContent = "Password reset email could not be requested from this browser session.";
      status.className = "form-status bad";
    } finally {
      if (submit) submit.disabled = false;
    }
  });
});

document.querySelectorAll("[data-reset-form]").forEach((form) => {
  const params = new URLSearchParams(window.location.search);
  form.elements.token.value = params.get("token") || "";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-reset-status]");
    const password = form.querySelector("[data-password-field]");
    if (password && !updatePasswordRules(password)) {
      status.textContent = "Password must meet every listed requirement.";
      status.className = "form-status bad";
      return;
    }
    status.textContent = "Updating password...";
    status.className = "form-status";
    try {
      const response = await fetch("/api/password/reset", {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await response.json();
      status.textContent = data.message || (data.success ? "Password updated." : "Password could not be updated.");
      status.classList.add(data.success ? "ok" : "bad");
      if (data.success) {
        form.reset();
        const target = data.type === "staff" ? "/staff" : "/";
        setTimeout(() => { window.location.href = target; }, 1200);
      }
    } catch {
      status.textContent = "Password could not be reset from this browser session.";
      status.className = "form-status bad";
    }
  });
});

document.querySelectorAll(".portal-shell, .staff-admin-shell").forEach((shell) => {
  shell.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      shell.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
      shell.querySelectorAll("[data-view-panel]").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.viewPanel === view);
      });
    });
  });
});

const hostModal = document.querySelector("[data-host-modal]");
const openHost = () => {
  const consoleEl = document.querySelector("[data-console]");
  if (consoleEl?.classList.contains("is-locked")) {
    showAuthResult("Locked action", "Confirm your email first.", "Host onboarding is available after email confirmation. You can keep exploring the console in view-only mode.");
    return;
  }
  if (!hostModal) return;
  hostModal.classList.add("is-open");
  hostModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};
const closeHost = () => {
  if (!hostModal) return;
  hostModal.classList.remove("is-open");
  hostModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};
document.querySelectorAll("[data-host-open]").forEach((button) => button.addEventListener("click", openHost));
document.querySelectorAll("[data-host-close]").forEach((button) => button.addEventListener("click", closeHost));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeHost();
});

const storedAccess = localStorage.getItem("visorcore-hyper-access") || "view_only";
const storedAccount = getStoredAccount();
if (storedAccount) {
  markHyperPortalSession(storedAccess);
  showConsole("[data-console]", storedAccess, storedAccount);
} else {
  setConsoleAccess(storedAccess, null);
}

switchAuthTab(document.querySelector("[data-auth-tab].active")?.dataset.authTab || "signup");

function storeAccount(account, mode = "view_only") {
  localStorage.setItem("visorcore-hyper-account", JSON.stringify(account));
  localStorage.setItem("visorcore-hyper-access", mode);
  renderAccountUi(account);
}

function renderAccountUi(account) {
  if (!account) return;
  const consoleEl = document.querySelector("[data-console]");
  if (!consoleEl) return;
  consoleEl.querySelectorAll("[data-workspace-name], [data-workspace-title]").forEach((workspace) => {
    workspace.textContent = account.company || "Workspace";
  });
  const verified = !!account.verified;
  const banner = document.querySelector("[data-unverified-banner]");
  if (banner) {
    banner.hidden = verified;
    if (!verified) window.requestAnimationFrame(() => window.mountTurnstile?.(banner));
  }
  const profileForm = document.querySelector("[data-profile-form]");
  if (profileForm) {
    profileForm.elements.name.value = account.name || "";
    profileForm.elements.company.value = account.company || "";
    profileForm.elements.email.value = account.email || "";
  }
  const profilePill = document.querySelector("[data-profile-status-pill]");
  if (profilePill) {
    profilePill.textContent = verified ? "Verified" : "Pending Email";
    profilePill.className = verified ? "pill good" : "pill warn";
  }
  document.querySelector("[data-mfa-status]")?.replaceChildren(document.createTextNode(account.mfa_status === "enabled" ? "Enabled" : "Not configured. TOTP/passkey setup will be available here."));
}

document.querySelectorAll("[data-account-logout]").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
    } catch {}
    localStorage.removeItem("visorcore-hyper-account");
    localStorage.removeItem("visorcore-hyper-access");
    document.cookie = "visorcore_hyper_session=; Path=/; Domain=.visorcore.com; Max-Age=0; SameSite=Lax; Secure";
    window.location.href = "/";
  });
});

document.querySelectorAll("[data-profile-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-profile-status]");
    const password = form.querySelector("[data-password-field]");
    if (password && !updatePasswordRules(password)) {
      status.textContent = "Password must meet every listed requirement.";
      status.className = "form-status bad";
      return;
    }
    status.textContent = "Saving profile...";
    status.className = "form-status";
    try {
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await response.json();
      status.textContent = data.message || (data.success ? "Profile updated." : "Profile could not be updated.");
      status.classList.add(data.success ? "ok" : "bad");
      if (data.success && data.account) {
        form.elements.password.value = "";
        updatePasswordRules(form.elements.password);
        storeAccount(data.account, data.mode || (data.account.verified ? "full_access" : "view_only"));
        setConsoleAccess(data.mode || (data.account.verified ? "full_access" : "view_only"), data.account);
      }
    } catch {
      status.textContent = "Profile could not be saved from this browser session.";
      status.className = "form-status bad";
    }
  });
});

document.querySelectorAll("[data-resend-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-resend-status]");
    if (!form.querySelector('[name="cf-turnstile-response"]')) {
      status.textContent = "Complete the security challenge first.";
      status.className = "form-status bad";
      window.mountTurnstile?.(form);
      return;
    }
    status.textContent = "Sending verification email...";
    status.className = "form-status";
    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await response.json();
      status.textContent = data.message || (data.success ? "Verification email sent." : "Verification email failed.");
      status.classList.add(data.success ? "ok" : "bad");
      if (data.success && data.account) storeAccount(data.account, data.mode || "view_only");
    } catch {
      status.textContent = "Verification email could not be sent from this browser session.";
      status.className = "form-status bad";
    }
  });
});

document.querySelectorAll("[data-mfa-setup]").forEach((button) => {
  button.addEventListener("click", () => {
    const status = document.querySelector("[data-profile-status]");
    const mfa = document.querySelector("[data-mfa-status]");
    if (mfa) mfa.textContent = "MFA setup is queued for the next security pass: TOTP, recovery codes, and passkeys.";
    if (status) {
      status.textContent = "MFA setup controls are active here. TOTP/passkey enrollment will be connected in the next backend security pass.";
      status.className = "form-status ok";
    }
  });
});

function renderStaffAdmin(admin) {
  const name = admin.display_name || admin.name || "Johnny";
  const role = admin.role || "Super Admin";
  document.querySelectorAll("[data-staff-admin-name]").forEach((item) => {
    item.textContent = name;
  });
  document.querySelectorAll("[data-staff-admin-role]").forEach((item) => {
    item.textContent = role;
  });
}

function pill(value, type = "") {
  const className = type ? `pill ${type}` : "pill";
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

function tableRow(values) {
  return `<div>${values.map((value) => String(value).startsWith("<div") ? value : `<span>${value}</span>`).join("")}</div>`;
}

function clientActionButtons(client) {
  const id = escapeHtml(client.id || "");
  return `<div class="client-actions">
    <button type="button" data-client-action="suspend" data-client-id="${id}">Suspend</button>
    <button type="button" data-client-action="terminate" data-client-id="${id}">Terminate</button>
    <button type="button" data-client-action="delete" data-client-id="${id}">Delete</button>
  </div>`;
}

function renderStaffDashboard(data) {
  renderStaffAdmin(data.admin || {});
  Object.entries(data.summary || {}).forEach(([key, value]) => {
    document.querySelectorAll(`[data-admin-stat="${key}"]`).forEach((item) => {
      item.textContent = value;
    });
  });

  const clients = Array.isArray(data.clients) ? data.clients : [];
  const clientsTable = document.querySelector("[data-clients-table]");
  const clientsEmpty = document.querySelector("[data-clients-empty]");
  if (clientsTable) {
    clientsTable.querySelectorAll("div:not(:first-child)").forEach((row) => row.remove());
    clients.forEach((client) => {
      clientsTable.insertAdjacentHTML("beforeend", tableRow([
        escapeHtml(client.name || ""),
        escapeHtml(client.company || ""),
        escapeHtml(client.email || ""),
        pill(client.account_status && client.account_status !== "active" ? client.account_status : (client.verified ? "Verified" : "Pending Email"), client.verified && (!client.account_status || client.account_status === "active") ? "good" : "warn"),
        pill(client.license?.plan || "Free", "good"),
        clientActionButtons(client),
      ]));
    });
  }
  if (clientsEmpty) clientsEmpty.hidden = clients.length > 0;

  const licenses = Array.isArray(data.licenses) ? data.licenses : [];
  const licensesTable = document.querySelector("[data-licenses-table]");
  const licensesEmpty = document.querySelector("[data-licenses-empty]");
  if (licensesTable) {
    licensesTable.querySelectorAll("div:not(:first-child)").forEach((row) => row.remove());
    licenses.forEach((license) => {
      licensesTable.insertAdjacentHTML("beforeend", tableRow([
        escapeHtml(license.client || ""),
        escapeHtml(license.email || ""),
        pill(license.plan || "Free", "good"),
        pill(license.status || "Active", "good"),
        escapeHtml(license.key || "Not issued"),
      ]));
    });
  }
  if (licensesEmpty) licensesEmpty.hidden = licenses.length > 0;

  const admins = Array.isArray(data.admins) ? data.admins : [];
  const staffTable = document.querySelector("[data-staff-table]");
  if (staffTable) {
    staffTable.querySelectorAll("div:not(:first-child)").forEach((row) => row.remove());
    admins.forEach((admin) => {
      staffTable.insertAdjacentHTML("beforeend", tableRow([
        escapeHtml(admin.display_name || admin.name || ""),
        escapeHtml(admin.email || ""),
        escapeHtml(admin.role || ""),
        pill(admin.mfa_status || (admin.mfa_required ? "required" : "disabled"), admin.mfa_required ? "good" : "warn"),
        pill(admin.status || "active", admin.status === "active" ? "good" : "warn"),
      ]));
    });
  }
}

document.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-client-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.clientAction;
  const clientId = actionButton.dataset.clientId;
  if (!clientId || !action) return;
  if (!window.confirm(`Are you sure you want to ${action} this client?`)) return;
  actionButton.disabled = true;
  try {
    const body = new FormData();
    body.set("client_id", clientId);
    body.set("action", action);
    const response = await fetch("/api/staff/client-action", {
      method: "POST",
      body,
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    if (!data.success) window.alert(data.message || "Client action failed.");
    await loadStaffDashboard();
  } catch {
    window.alert("Client action could not be completed from this browser session.");
  } finally {
    actionButton.disabled = false;
  }
});

async function loadStaffDashboard() {
  if (!document.querySelector("[data-staff-console]")) return;
  try {
    const response = await fetch("/api/staff/dashboard", {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    if (data.success) renderStaffDashboard(data);
  } catch {
    // Keep the empty admin shell visible if the dashboard endpoint is unavailable.
  }
}

const storedStaffAdmin = localStorage.getItem("visorcore-staff-admin");
if (storedStaffAdmin && document.querySelector("[data-staff-console]")) {
  try {
    renderStaffAdmin(JSON.parse(storedStaffAdmin));
  } catch {
    localStorage.removeItem("visorcore-staff-admin");
  }
}

document.querySelectorAll("[data-staff-logout]").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await fetch("/api/staff/logout", { method: "POST", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
    } catch {}
    localStorage.removeItem("visorcore-staff-admin");
    window.location.href = "/staff";
  });
});
