const authCopy = {
  login: {
    kicker: "Welcome back",
    title: "Step back into your Hyper Portal.",
    message: "Resume secure Hyper-V operations from one polished command center. Your hosts, virtual machines, networks, checkpoints, and account controls are ready when you sign in."
  },
  signup: {
    kicker: "Client portal",
    title: "Create your Hyper Portal account.",
    message: "Sign up first, confirm your email, then connect Hyper-V hosts through a secure outbound agent. Existing clients can switch to Sign In from the toggle."
  }
};

function switchAuthTab(target) {
  hideAuthResult();
  document.querySelectorAll("[data-auth-tab]").forEach((button) => button.classList.toggle("active", button.dataset.authTab === target));
  document.querySelectorAll("[data-auth-form]").forEach((form) => form.classList.toggle("active", form.dataset.authForm === target));
  const copy = authCopy[target] || authCopy.signup;
  const kicker = document.querySelector("[data-auth-copy-kicker]");
  const title = document.querySelector("[data-auth-copy-title]");
  const message = document.querySelector("[data-auth-copy-message]");
  if (kicker) kicker.textContent = copy.kicker;
  if (title) title.textContent = copy.title;
  if (message) message.textContent = copy.message;
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
  const billingOnly = mode === "billing_only" || account?.account_status === "suspended";
  consoleEl.dataset.accessMode = fullAccess ? "full" : "locked";
  if (billingOnly) consoleEl.dataset.accessMode = "billing_only";
  consoleEl.classList.toggle("is-locked", !fullAccess);
  consoleEl.classList.toggle("is-unlocked", fullAccess && !billingOnly);
  consoleEl.classList.toggle("is-suspended", billingOnly);
  const note = consoleEl.querySelector("[data-access-note]");
  if (note) {
    note.textContent = billingOnly
      ? "Account suspended. Only Billing is available until outstanding balances are paid."
      : fullAccess
      ? `Full management access unlocked${account?.company ? ` for ${account.company}` : ""}.`
      : "View-only mode. Confirm your email to unlock add, edit, delete, and host onboarding actions.";
  }
  if (account?.company) {
    consoleEl.querySelectorAll("[data-workspace-name], [data-workspace-title]").forEach((workspace) => {
      workspace.textContent = account.company;
    });
  }
  consoleEl.querySelectorAll("[data-host-open], .action-bar button").forEach((button) => {
    button.disabled = !fullAccess || billingOnly;
    button.setAttribute("aria-disabled", fullAccess && !billingOnly ? "false" : "true");
  });
  const hasHosts = connectedHostsCount > 0;
  consoleEl.querySelectorAll("[data-host-scope], [data-host-sync-mode], [data-host-sync-target]").forEach((control) => {
    control.disabled = !hasHosts || billingOnly;
  });
  updateVmToolbarState();
  if (billingOnly) {
    activatePortalView(consoleEl.querySelector(".portal-shell"), "billing");
  }
}

document.querySelectorAll("[data-agent-status-open]").forEach((button) => {
  button.addEventListener("click", () => {
    const shell = document.querySelector(".portal-shell");
    activatePortalView(shell, "hosts");
    document.querySelector("[data-host-open]")?.focus();
  });
});

document.querySelectorAll("[data-mfa-ready-open]").forEach((button) => {
  button.addEventListener("click", () => {
    const shell = document.querySelector(".portal-shell");
    activatePortalView(shell, "profile");
    document.querySelector("[data-mfa-setup]")?.click();
  });
});

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
      status.textContent = data.admin?.mfa_required ? "Staff console unlocked with MFA." : "Staff console unlocked. Configure staff MFA from Admins and Staff.";
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
      if (data.mfa_required) {
        form.querySelector("[data-login-mfa-field]")?.removeAttribute("hidden");
        form.querySelector('[name="mfa"]')?.focus();
      }
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
      startHostRequestPolling();
    } else {
      const full = data.mode === "full_access";
      const billingOnly = data.mode === "billing_only";
      showAuthResult(
        billingOnly ? "Billing attention needed" : (full ? "Signed in" : "Email confirmation needed"),
        billingOnly ? "Billing is available." : (full ? "Console unlocked." : "Verify your email to unlock full control."),
        data.message || "",
        billingOnly ? "Open Billing" : (full ? "Open Console" : "Open View-Only Console")
      );
      showConsole("[data-console]", data.mode || "view_only", data.account);
      startHostRequestPolling();
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

let billingInvoicesLoading = false;
let hostRequestsLoading = false;
let lastPendingHostCount = 0;
let hostRequestPollTimer = null;
let liveRefreshBurstTimer = null;
let connectedHostsCount = 0;
let selectedVmKey = "";
let latestVmInventory = [];

function startHostRequestPolling() {
  if (hostRequestPollTimer || !getStoredAccount()) return;
  loadHostRequests();
  hostRequestPollTimer = window.setInterval(loadHostRequests, 2000);
}

function startLiveRefreshBurst(durationMs = 18000) {
  if (!getStoredAccount()) return;
  if (liveRefreshBurstTimer) window.clearInterval(liveRefreshBurstTimer);
  loadHostRequests();
  liveRefreshBurstTimer = window.setInterval(loadHostRequests, 700);
  window.setTimeout(() => {
    if (liveRefreshBurstTimer) {
      window.clearInterval(liveRefreshBurstTimer);
      liveRefreshBurstTimer = null;
    }
  }, durationMs);
}

function activatePortalView(shell, view) {
  if (!shell || !view) return;
  const consoleEl = shell.closest("[data-console]");
  if (consoleEl?.classList.contains("is-suspended") && view !== "billing") {
    view = "billing";
    const status = document.querySelector("[data-billing-status]");
    if (status) {
      status.textContent = "Account suspended. Only Billing is available until billing is current.";
      status.className = "form-status bad";
    }
  }
  shell.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  shell.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  });
  if (view === "billing" && consoleEl && !billingInvoicesLoading) loadBillingInvoices();
  if (view === "users" && consoleEl) loadSubUsers();
  if (view === "hosts" && consoleEl && !hostRequestsLoading) loadHostRequests();
}

document.querySelectorAll(".portal-shell, .staff-admin-shell").forEach((shell) => {
  shell.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activatePortalView(shell, button.dataset.view);
    });
  });
});

document.querySelectorAll("[data-view-shortcut]").forEach((button) => {
  button.addEventListener("click", () => activatePortalView(document.querySelector(".portal-shell"), button.dataset.viewShortcut));
});

const hostModal = document.querySelector("[data-host-modal]");
const openHost = () => {
  const consoleEl = document.querySelector("[data-console]");
  if (consoleEl?.classList.contains("is-suspended")) {
    showAuthResult("Account suspended", "Billing must be current first.", "Hyper-V host onboarding is paused while the account is suspended. Open Billing, pay the outstanding balance, and access will restore automatically.", "Open Billing");
    activatePortalView(consoleEl.querySelector(".portal-shell"), "billing");
    return;
  }
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

const vmConsoleModal = document.querySelector("[data-vm-console-modal]");
function renderVmConsoleState(type, title, message, features = []) {
  const screen = vmConsoleModal?.querySelector("[data-vm-console-screen]");
  if (!screen) return;
  screen.classList.toggle("is-ready", type === "ready");
  screen.classList.toggle("is-error", type === "error");
  screen.innerHTML = `
    <div class="console-reticle"></div>
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(message)}</p>
    ${features.length ? `<div class="console-session-features">${features.map((feature) => `<span>${escapeHtml(feature)}</span>`).join("")}</div>` : ""}
  `;
}

async function requestVmConsoleSession(vm) {
  renderVmConsoleState("loading", "Preparing secure console", "Requesting a per-session gateway token for this VM.");
  try {
    const body = new FormData();
    body.set("host_id", vm.host_id || "");
    body.set("vm_name", vm.name || "");
    body.set("vm_id", vm.id || "");
    const response = await fetch("/api/console-session", {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await parseJsonResponse(response);
    if (!data.success) {
      renderVmConsoleState("error", "Console gateway not ready", data.message || "The console gateway could not create a session for this VM.", data.features || []);
      return;
    }
    renderVmConsoleState("ready", "Console session reserved", data.message || "Gateway session is ready.", data.features || []);
  } catch (error) {
    console.error("VisorCore console session failed", error);
    renderVmConsoleState("error", "Console gateway unavailable", "The browser could not reach the console session endpoint.");
  }
}

function openVmConsole(vm) {
  if (!vmConsoleModal || !vm) return;
  const title = vmConsoleModal.querySelector("[data-vm-console-title]");
  const host = vmConsoleModal.querySelector("[data-vm-console-host]");
  if (title) title.textContent = `${vm.name || "VM"} Console`;
  if (host) host.textContent = `${vm.host || "Hyper-V Host"} - ${vm.state || "Unknown"}`;
  renderVmConsoleState("loading", "Gateway session initializing", "VisorCore is checking whether a low-latency console gateway is available for this host.");
  vmConsoleModal.classList.add("is-open");
  vmConsoleModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  requestVmConsoleSession(vm);
}
function closeVmConsole() {
  if (!vmConsoleModal) return;
  vmConsoleModal.classList.remove("is-open");
  vmConsoleModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
document.querySelectorAll("[data-vm-console-close]").forEach((button) => button.addEventListener("click", closeVmConsole));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVmConsole();
});

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command was blocked.");
}

document.querySelectorAll("[data-copy-host-command]").forEach((button) => {
  button.addEventListener("click", async () => {
    const command = document.querySelector("[data-host-install-command]")?.textContent?.trim() || "";
    const status = document.querySelector("[data-host-command-status]");
    if (!command) return;
    button.disabled = true;
    if (status) {
      status.textContent = "Copying...";
      status.className = "copy-status";
    }
    try {
      await copyTextToClipboard(command);
      button.textContent = "Copied";
      if (status) {
        status.textContent = "Copied. Paste it into an Administrator PowerShell window on the Hyper-V host.";
        status.className = "copy-status good";
      }
      window.setTimeout(() => {
        button.textContent = "Copy PowerShell Command";
        if (status) status.textContent = "";
      }, 4200);
    } catch {
      if (status) {
        status.textContent = "Copy was blocked. Select the command text and copy it manually.";
        status.className = "copy-status bad";
      }
    } finally {
      button.disabled = false;
    }
  });
});

const storedAccess = localStorage.getItem("visorcore-hyper-access") || "view_only";
const storedAccount = getStoredAccount();
if (storedAccount) {
  markHyperPortalSession(storedAccess);
  showConsole("[data-console]", storedAccess, storedAccount);
  refreshAccountSession();
  startHostRequestPolling();
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
  const suspended = account.account_status === "suspended" || account.access_mode === "billing_only";
  const banner = document.querySelector("[data-unverified-banner]");
  if (banner) {
    banner.hidden = verified || suspended;
    if (!verified && !suspended) window.requestAnimationFrame(() => window.mountTurnstile?.(banner));
  }
  const suspendedBanner = document.querySelector("[data-suspended-banner]");
  if (suspendedBanner) {
    suspendedBanner.hidden = !suspended;
  }
  const profileForm = document.querySelector("[data-profile-form]");
  if (profileForm) {
    profileForm.elements.name.value = account.name || "";
    profileForm.elements.company.value = account.company || "";
    profileForm.elements.email.value = account.email || "";
  }
  const profilePill = document.querySelector("[data-profile-status-pill]");
  if (profilePill) {
    profilePill.textContent = suspended ? "Suspended" : (verified ? "Verified" : "Pending Email");
    profilePill.className = suspended ? "pill bad" : (verified ? "pill good" : "pill warn");
  }
  const workspaceCode = account.workspace_code || "your_workspace_code";
  const installCommand = document.querySelector("[data-host-install-command]");
  if (installCommand) {
    installCommand.textContent = [
      "Set-ExecutionPolicy RemoteSigned -Scope Process -Force",
      '$installer = (iwr "https://raw.githubusercontent.com/VisorCore/hyper-agent/main/install.ps1" -UseBasicParsing).Content',
      'if ($installer -match "<html|Bot Verification|grecaptcha") { throw "VisorCore installer download returned HTML instead of PowerShell. Contact support@visorcore.com." }',
      "iex $installer",
      `Register-VisorCoreHost -Workspace "${workspaceCode}" -Region "us-central" -RequireMfa`,
    ].join("\n");
  }
  const mfaStatus = document.querySelector("[data-mfa-status]");
  if (mfaStatus) {
    const statusText = account.mfa_status === "enabled"
      ? "Enabled. A 6-digit authenticator code is required at sign-in."
      : (account.mfa_status === "pending_verification" ? "Pending verification. Scan the QR code and verify a code to finish setup." : "Not configured. Click Configure MFA to enroll an authenticator app.");
    mfaStatus.textContent = statusText;
  }
  if (Array.isArray(account.sub_users)) {
    renderSubUsers({ users: account.sub_users });
  }
}

async function refreshAccountSession() {
  try {
    const response = await fetch("/api/auth/session", {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    if (!data.success || !data.account) return;
    storeAccount(data.account, data.mode || data.account.access_mode || "view_only");
    setConsoleAccess(data.mode || data.account.access_mode || "view_only", data.account);
  } catch {
    // Keep the local shell visible if the session refresh cannot be reached.
  }
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function renderInvoices(data) {
  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  const table = document.querySelector("[data-invoices-table]");
  const empty = document.querySelector("[data-invoices-empty]");
  const balance = document.querySelector("[data-billing-balance]");
  const summary = document.querySelector("[data-billing-summary]");
  const pay = document.querySelector("[data-pay-balance]");
  const total = Number(data.outstanding_total || 0);
  if (balance) {
    balance.textContent = `${money(total)} due`;
    balance.className = total > 0 ? "pill warn" : "pill good";
  }
  if (summary) {
    summary.textContent = total > 0
      ? "Pay all outstanding balances to automatically restore Hyper Portal access."
      : "Your subscription/license is active. Payment methods, billing periods, credits, and invoices are managed from this Billing workspace.";
  }
  if (table) {
    table.querySelectorAll("div:not(:first-child)").forEach((row) => row.remove());
    invoices.forEach((invoice) => {
      table.insertAdjacentHTML("beforeend", tableRow([
        escapeHtml(invoice.id || ""),
        escapeHtml(invoice.description || ""),
        escapeHtml(money(invoice.balance ?? invoice.amount_due)),
        pill(invoice.status || "Due", String(invoice.status || "").toLowerCase() === "paid" ? "good" : "warn"),
        escapeHtml(invoice.due_at ? new Date(invoice.due_at).toLocaleDateString() : "On receipt"),
      ]));
    });
  }
  if (empty) empty.style.display = invoices.length ? "none" : "block";
  if (pay) {
    pay.textContent = total > 0 ? `Pay ${money(total)} and Unsuspend` : "Reactivate Account";
    pay.hidden = getStoredAccount()?.account_status !== "suspended" && total <= 0;
  }
}

function permissionLabel(permission) {
  const labels = {
    "vm.manage": "VMs",
    "switch.manage": "Switches",
    "checkpoint.manage": "Checkpoints",
    "storage.manage": "Storage",
    "replication.manage": "Replication",
    "events.view": "Events",
    "users.manage": "Users",
    "account.admin": "Admin",
    "owner.transfer": "Owner transfer",
  };
  return labels[permission] || permission;
}

function renderSubUsers(data) {
  const users = Array.isArray(data.users) ? data.users : [];
  const table = document.querySelector("[data-subusers-table]");
  const empty = document.querySelector("[data-subusers-empty]");
  if (table) {
    table.querySelectorAll("div:not(:first-child)").forEach((row) => row.remove());
    users.forEach((user) => {
      table.insertAdjacentHTML("beforeend", tableRow([
        `<span><strong>${escapeHtml(user.name || "Sub-user")}</strong><small>${escapeHtml(user.email || "")}</small></span>`,
        escapeHtml(user.role || "Operator"),
        escapeHtml((user.permissions || []).map(permissionLabel).join(", ") || "No permissions"),
        user.mfa_required ? pill("Required", "good") : pill("Optional", "warn"),
        `<div class="row-actions"><span>${pill(user.status || "invited", "warn")}</span><button type="button" class="danger" data-subuser-delete="${escapeHtml(user.id || "")}">Remove</button></div>`,
      ]));
    });
  }
  if (empty) empty.style.display = users.length ? "none" : "block";
}

async function loadSubUsers() {
  if (!document.querySelector("[data-subusers-table]")) return;
  try {
    const response = await fetch("/api/account/users", {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    if (data.success) renderSubUsers(data);
  } catch {
    const status = document.querySelector("[data-subuser-status]");
    if (status) {
      status.textContent = "Sub-users could not be loaded from this browser session.";
      status.className = "form-status bad";
    }
  }
}

async function loadBillingInvoices() {
  if (!document.querySelector("[data-invoices-table]")) return;
  if (billingInvoicesLoading) return;
  billingInvoicesLoading = true;
  try {
    const response = await fetch("/api/billing/invoices", {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    if (!data.success) return;
    renderInvoices(data);
    if (data.account) {
      storeAccount(data.account, data.mode || data.account.access_mode || "view_only");
      setConsoleAccess(data.mode || data.account.access_mode || "view_only", data.account);
    }
  } catch {
    const status = document.querySelector("[data-billing-status]");
    if (status) {
      status.textContent = "Billing could not be loaded from this browser session.";
      status.className = "form-status bad";
    }
  } finally {
    billingInvoicesLoading = false;
  }
}

function hostStatusPill(status) {
  const value = String(status || "pending_approval");
  if (value === "approved") return pill("Approved", "good");
  if (value === "denied") return pill("Denied", "bad");
  return pill("Pending Approval", "warn");
}

function inventoryArray(host, key) {
  const inventory = host?.inventory || {};
  return Array.isArray(inventory[key]) ? inventory[key] : [];
}

function approvedInventoryHosts(hosts) {
  return hosts.filter((host) => (host.status || "") === "approved");
}

function inventoryCount(hosts, key, fallbackArrayKey = "") {
  return hosts.reduce((total, host) => {
    const inventory = host.inventory || {};
    const value = Number(inventory[key] || 0);
    if (value > 0) return total + value;
    return fallbackArrayKey ? total + inventoryArray(host, fallbackArrayKey).length : total;
  }, 0);
}

function flattenInventory(hosts, key) {
  return hosts.flatMap((host) => inventoryArray(host, key).map((item) => ({
    ...item,
    host: item.host || host.computer_name || "Host",
    host_id: host.id || "",
    workspace: host.workspace || "",
  })));
}

function setTableRows(selector, rows) {
  const table = document.querySelector(selector);
  if (!table) return;
  table.querySelectorAll("div:not(:first-child)").forEach((row) => row.remove());
  rows.forEach((row) => table.insertAdjacentHTML("beforeend", tableRow(row)));
  table.style.display = rows.length ? "" : "none";
}

function setPanelEmpty(panelName, isEmpty, message = "") {
  const empty = document.querySelector(`[data-view-panel="${panelName}"] [data-empty-state]`);
  if (!empty) return;
  empty.style.display = isEmpty ? "block" : "none";
  if (message) {
    const text = empty.querySelector("p");
    if (text) text.textContent = message;
  }
}

function formatInventoryDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatSeconds(value) {
  const seconds = Number(value || 0);
  if (seconds <= 0) return "0m";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function clampPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function formatCapacity(gb) {
  const value = Number(gb || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 GB";
  if (value >= 1024) {
    const tb = value / 1024;
    return `${tb >= 10 ? Math.round(tb) : tb.toFixed(1)} TB`;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} GB`;
}

function formatMbps(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "0 Mbps";
  if (number >= 1000) {
    const gbps = number / 1000;
    return `${gbps >= 10 ? Math.round(gbps) : gbps.toFixed(1)} Gbps`;
  }
  return `${number >= 10 ? Math.round(number) : number.toFixed(1)} Mbps`;
}

function sumInventoryMetric(hosts, reader) {
  return hosts.reduce((total, host) => {
    const value = Number(reader(host.inventory || {}, host) || 0);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

function aggregateHostResources(hosts) {
  const memoryGb = sumInventoryMetric(hosts, (inventory) => inventory.host?.total_memory_gb);
  const memoryAssignedGb = sumInventoryMetric(hosts, (inventory) => (
    inventoryArray({ inventory }, "vms").reduce((total, vm) => total + (Number(vm.memory_assigned_mb || 0) / 1024), 0)
  ));
  const cpuCores = sumInventoryMetric(hosts, (inventory) => inventory.host?.logical_processor_count || inventory.host?.processor_count);
  const cpuLoadTotal = sumInventoryMetric(hosts, (inventory) => inventory.host?.cpu_load_percent);
  const cpuLoadSamples = hosts.filter((host) => Number(host.inventory?.host?.cpu_load_percent || 0) > 0).length;
  const storageTotalGb = sumInventoryMetric(hosts, (inventory) => inventory.storage?.total_gb);
  const storageFreeGb = sumInventoryMetric(hosts, (inventory) => inventory.storage?.free_gb);
  const networkRxMbps = sumInventoryMetric(hosts, (inventory) => inventory.network?.rx_mbps);
  const networkTxMbps = sumInventoryMetric(hosts, (inventory) => inventory.network?.tx_mbps);
  return {
    cpuCores,
    cpuLoadPercent: cpuLoadSamples ? cpuLoadTotal / cpuLoadSamples : 0,
    memoryGb,
    memoryAssignedGb,
    storageTotalGb,
    storageFreeGb,
    storageUsedGb: Math.max(0, storageTotalGb - storageFreeGb),
    networkRxMbps,
    networkTxMbps,
  };
}

function updateUtilizationMeter(selector, labelSelector, percent, label = "") {
  const meter = document.querySelector(selector);
  const labelEl = document.querySelector(labelSelector);
  const clamped = clampPercent(percent);
  if (meter) meter.style.width = `${clamped}%`;
  if (labelEl) labelEl.textContent = label || `${clamped}%`;
}

function renderDashboardEvents(events) {
  const container = document.querySelector("[data-dashboard-events]");
  const empty = document.querySelector("[data-dashboard-events-empty]");
  if (!container) return;
  const liveEvents = Array.isArray(events) ? events.slice(0, 5) : [];
  container.innerHTML = liveEvents.map((event) => `
    <div class="dashboard-event">
      <b>${escapeHtml(event.level || "Info")}</b>
      <span>${escapeHtml(event.host || "Host")}</span>
      <small>${escapeHtml(`${event.id || ""} ${String(event.message || "").slice(0, 120)}`.trim())}</small>
    </div>
  `).join("");
  container.style.display = liveEvents.length ? "grid" : "none";
  if (empty) empty.style.display = liveEvents.length ? "none" : "block";
}

function vmStatePill(state) {
  const value = String(state || "Unknown");
  const lower = value.toLowerCase();
  if (lower === "running") return pill(value, "good");
  if (["off", "paused", "saved"].includes(lower)) return pill(value, lower === "off" ? "" : "warn");
  return pill(value, "warn");
}

function vmKey(vm) {
  return `${vm.host_id || ""}::${vm.name || ""}`;
}

function findSelectedVm() {
  return latestVmInventory.find((vm) => vmKey(vm) === selectedVmKey) || null;
}

function updateVmToolbarState() {
  const selected = findSelectedVm();
  const label = document.querySelector("[data-selected-vm-label]");
  const consoleEl = document.querySelector("[data-console]");
  const fullAccess = consoleEl?.classList.contains("is-unlocked") && !consoleEl?.classList.contains("is-suspended");
  if (label) {
    label.textContent = selected ? `${selected.name || "Selected VM"} on ${selected.host || "host"}` : "Select a VM to control it";
  }
  document.querySelectorAll("[data-vm-toolbar-command]").forEach((button) => {
    if (selected) {
      button.dataset.queueCommand = button.dataset.vmToolbarCommand;
      button.dataset.targetType = "vm";
      button.dataset.hostId = selected.host_id || "";
      button.dataset.targetName = selected.name || "";
      button.dataset.targetId = selected.id || "";
    } else {
      delete button.dataset.queueCommand;
      delete button.dataset.targetType;
      delete button.dataset.hostId;
      delete button.dataset.targetName;
      delete button.dataset.targetId;
    }
    button.disabled = !selected || !fullAccess;
    button.setAttribute("aria-disabled", !selected || !fullAccess ? "true" : "false");
  });
  document.querySelectorAll("[data-vm-toolbar-console]").forEach((button) => {
    button.disabled = !selected;
    button.setAttribute("aria-disabled", selected ? "false" : "true");
  });
}

function vmSelectionButton(vm) {
  const key = escapeHtml(vmKey(vm));
  const active = key === escapeHtml(selectedVmKey) ? " active" : "";
  return `<button type="button" class="vm-select-button${active}" data-select-vm="${key}">${escapeHtml(vm.name || "Unnamed VM")}</button>`;
}

function commandButtonsForVm(vm) {
  const hostId = escapeHtml(vm.host_id || "");
  const name = escapeHtml(vm.name || "");
  const state = String(vm.state || "").toLowerCase();
  const commandButton = (action, label, intent = "") => `<button type="button" ${intent ? `data-command-intent="${intent}"` : ""} data-queue-command="${action}" data-target-type="vm" data-host-id="${hostId}" data-target-name="${name}">${label}</button>`;
  const primary = state === "running"
    ? `${commandButton("vm.restart", "Restart")}${commandButton("vm.checkpoint", "Checkpoint")}`
    : commandButton("vm.start", "Start", "primary");
  return `<div class="row-actions">
    <span class="command-group command-group-primary">${primary}<button type="button" data-open-vm-console data-vm-key="${escapeHtml(vmKey(vm))}">Console</button></span>
    <span class="command-group">${commandButton("vm.pause", "Pause")}${commandButton("vm.resume", "Resume")}${commandButton("vm.save", "Save")}</span>
    <span class="command-group">${commandButton("vm.set_cpu", "CPU")}${commandButton("vm.set_memory", "RAM")}${commandButton("vm.set_notes", "Notes")}${commandButton("vm.rename", "Rename")}</span>
    <span class="command-group command-group-danger">${commandButton("vm.shutdown", "Graceful Shutdown", "danger")}${commandButton("vm.turn_off", "Hard Power Off", "danger")}</span>
  </div>`;
}

function commandButtonsForCheckpoint(checkpoint) {
  const hostId = escapeHtml(checkpoint.host_id || "");
  const name = escapeHtml(checkpoint.name || "");
  const vm = escapeHtml(checkpoint.vm || "");
  return `<div class="row-actions">
    <button type="button" data-queue-command="checkpoint.apply" data-target-type="checkpoint" data-host-id="${hostId}" data-target-name="${name}" data-option-vm-name="${vm}">Apply</button>
    <button type="button" class="danger" data-queue-command="checkpoint.delete" data-target-type="checkpoint" data-host-id="${hostId}" data-target-name="${name}" data-option-vm-name="${vm}">Delete</button>
  </div>`;
}

function commandButtonsForDisk(disk) {
  const hostId = escapeHtml(disk.host_id || "");
  const path = escapeHtml(disk.path || "");
  return `<div class="row-actions">
    <button type="button" data-queue-command="disk.resize" data-target-type="disk" data-host-id="${hostId}" data-target-name="${path}">Resize</button>
    <button type="button" data-queue-command="disk.optimize" data-target-type="disk" data-host-id="${hostId}" data-target-name="${path}">Optimize</button>
  </div>`;
}

function renderOverviewInventory(hosts) {
  const approved = approvedInventoryHosts(hosts);
  const pending = hosts.filter((host) => (host.status || "pending_approval") === "pending_approval").length;
  const resources = aggregateHostResources(approved);
  const networkTotal = resources.networkRxMbps + resources.networkTxMbps;
  const kpis = document.querySelectorAll('[data-view-panel="overview"] .portal-kpis > div');
  const values = [
    ["Hosts", String(approved.length), pending ? `${pending} awaiting approval` : "Connected and reporting"],
    ["CPU Cores", String(Math.round(resources.cpuCores)), "Logical cores across hosts"],
    ["Memory", formatCapacity(resources.memoryGb), `${formatCapacity(resources.memoryAssignedGb)} assigned to VMs`],
    ["Storage", formatCapacity(resources.storageTotalGb), `${formatCapacity(resources.storageFreeGb)} free`],
    ["Network", formatMbps(networkTotal), `${formatMbps(resources.networkRxMbps)} down / ${formatMbps(resources.networkTxMbps)} up`],
  ];
  kpis.forEach((card, index) => {
    const value = values[index];
    if (!value) return;
    const span = card.querySelector("span");
    const strong = card.querySelector("strong");
    const small = card.querySelector("small");
    if (span) span.textContent = value[0];
    if (strong) strong.textContent = value[1];
    if (small) small.textContent = value[2];
  });
  updateUtilizationMeter("[data-util-cpu]", "[data-util-cpu-label]", resources.cpuLoadPercent);
  updateUtilizationMeter(
    "[data-util-memory]",
    "[data-util-memory-label]",
    resources.memoryGb > 0 ? (resources.memoryAssignedGb / resources.memoryGb) * 100 : 0,
  );
  updateUtilizationMeter(
    "[data-util-storage]",
    "[data-util-storage-label]",
    resources.storageTotalGb > 0 ? (resources.storageUsedGb / resources.storageTotalGb) * 100 : 0,
  );
  renderDashboardEvents(flattenInventory(approved, "events"));
  const overviewEmpty = document.querySelector('[data-view-panel="overview"] [data-empty-state]');
  if (overviewEmpty) overviewEmpty.style.display = approved.length ? "none" : "block";
}

function renderInventoryViews(hosts) {
  const approved = approvedInventoryHosts(hosts);
  renderOverviewInventory(hosts);

  setTableRows("[data-host-inventory-table]", approved.map((host) => {
    const inventory = host.inventory || {};
    const hostInfo = inventory.host || {};
    const online = String(host.agent_status || "").toLowerCase() === "online";
    return [
      escapeHtml(host.computer_name || hostInfo.name || "Hyper-V Host"),
      escapeHtml(hostInfo.os || "Windows Hyper-V"),
      escapeHtml(inventory.agent_version || "0.2.0"),
      online ? pill("Online", "good") : pill(host.agent_status || "Waiting", "warn"),
    ];
  }));
  const hostsEmpty = document.querySelector('[data-view-panel="hosts"] > .portal-card > [data-empty-state]');
  if (hostsEmpty) hostsEmpty.style.display = approved.length ? "none" : "block";

  const syncTargets = document.querySelector("[data-host-sync-targets]");
  if (syncTargets) {
    syncTargets.innerHTML = approved.length
      ? approved.map((host) => `<label class="check-row"><input type="checkbox" data-host-sync-target value="${escapeHtml(host.id || "")}"> ${escapeHtml(host.computer_name || "Unnamed Host")}</label>`).join("")
      : '<label class="check-row"><input type="checkbox" data-host-sync-target disabled> No hosts connected yet</label>';
  }

  const vms = flattenInventory(approved, "vms");
  latestVmInventory = vms;
  if (selectedVmKey && !findSelectedVm()) selectedVmKey = "";
  const vmCount = inventoryCount(approved, "vm_count", "vms");
  setTableRows("[data-vm-table]", vms.map((vm) => [
    vmSelectionButton(vm),
    escapeHtml(vm.host || ""),
    escapeHtml(`${Number(vm.cpu_usage || 0)}% / ${Number(vm.memory_assigned_mb || 0)} MB`),
    vmStatePill(vm.state || vm.status),
    commandButtonsForVm(vm),
  ]));
  updateVmToolbarState();
  setPanelEmpty("vms", vms.length === 0, vmCount > 0
    ? "This host is reporting VM counts only. Rerun the Add Host command once to upgrade the scheduled-task agent and populate VM details."
    : "VMs appear automatically after a host agent finishes inventory sync.");

  const switches = flattenInventory(approved, "switches");
  const networkGrid = document.querySelector("[data-network-grid]");
  if (networkGrid) {
    networkGrid.innerHTML = switches.map((item) => `
      <div>
        <b>${escapeHtml(item.name || "Virtual Switch")}</b>
        <span>${escapeHtml(item.host || "")} - ${escapeHtml(item.switch_type || "Switch")}${item.net_adapter ? ` - ${escapeHtml(item.net_adapter)}` : ""}</span>
        <div class="network-actions">
          <button type="button" data-queue-command="switch.rename" data-target-type="switch" data-host-id="${escapeHtml(item.host_id || "")}" data-target-name="${escapeHtml(item.name || "")}">Rename</button>
          <button type="button" data-queue-command="switch.set_notes" data-target-type="switch" data-host-id="${escapeHtml(item.host_id || "")}" data-target-name="${escapeHtml(item.name || "")}">Notes</button>
        </div>
      </div>
    `).join("");
    networkGrid.style.display = switches.length ? "" : "none";
  }
  const switchCount = inventoryCount(approved, "switch_count", "switches");
  setPanelEmpty("networks", switches.length === 0, switchCount > 0
    ? "This host is reporting switch counts only. Rerun the Add Host command once to upgrade the scheduled-task agent and populate virtual switch details."
    : "Switches and virtual network adapters will be discovered per host, with an all-host sync option for matching switch configuration.");

  const checkpoints = flattenInventory(approved, "checkpoints");
  setTableRows("[data-checkpoint-table]", checkpoints.map((checkpoint) => [
    escapeHtml(checkpoint.vm || ""),
    escapeHtml(checkpoint.name || "Checkpoint"),
    escapeHtml(formatInventoryDate(checkpoint.created_at)),
    pill(checkpoint.type || "Checkpoint", "warn"),
    commandButtonsForCheckpoint(checkpoint),
  ]));
  setPanelEmpty("checkpoints", checkpoints.length === 0, "Checkpoints will appear here after connected hosts report VM inventory.");

  const disks = flattenInventory(approved, "disks");
  setTableRows("[data-storage-table]", disks.map((disk) => [
    escapeHtml((disk.path || "").split(/[\\/]/).pop() || disk.path || "Virtual disk"),
    escapeHtml(disk.vm || ""),
    escapeHtml(`${Number(disk.size_gb || 0)} GB`),
    commandButtonsForDisk(disk),
  ]));
  setPanelEmpty("storage", disks.length === 0, "Storage inventory appears after host agent sync.");

  const replicas = flattenInventory(approved, "replication");
  setTableRows("[data-replication-table]", replicas.map((replica) => [
    escapeHtml(replica.vm || ""),
    escapeHtml(replica.replica_server || replica.host || ""),
    pill(replica.health || replica.state || "Unknown", String(replica.health || "").toLowerCase() === "normal" ? "good" : "warn"),
    escapeHtml(formatInventoryDate(replica.last_replication_time)),
  ]));
  setPanelEmpty("replication", replicas.length === 0, "Replication relationships will auto-discover across hosts once they are connected.");

  const events = flattenInventory(approved, "events").slice(0, 40);
  setTableRows("[data-events-table]", events.map((event) => [
    escapeHtml(formatInventoryDate(event.time)),
    escapeHtml(event.host || ""),
    pill(event.level || "Info", String(event.level || "").toLowerCase().includes("error") ? "bad" : ""),
    escapeHtml(`${event.id || ""} ${String(event.message || "").slice(0, 140)}`),
  ]));
  setPanelEmpty("events", events.length === 0, "Host, VM, checkpoint, migration, and replication events appear after the first agent sync.");
}

function renderRecentCommandStatus(commands = []) {
  const status = document.querySelector("[data-command-status]");
  if (!status || !Array.isArray(commands) || commands.length === 0) return;
  const latest = commands[0];
  const state = String(latest.status || "queued").toLowerCase();
  const target = latest.target_name ? ` ${latest.target_name}` : "";
  const title = state === "succeeded" ? "Action complete" : (state === "failed" ? "Action needs attention" : "Action in progress");
  setCommandStatus(state === "succeeded" ? "good" : (state === "failed" ? "bad" : "active"), title, `${latest.label || latest.action || "Command"}${target}: ${latest.message || state}`);
}

function renderHostRequests(data) {
  const hosts = Array.isArray(data.hosts) ? data.hosts : [];
  const list = document.querySelector("[data-host-requests-list]");
  const empty = document.querySelector("[data-host-requests-empty]");
  const count = document.querySelector("[data-host-request-count]");
  const connectedList = document.querySelector("[data-connected-hosts-list]");
  const connectedEmpty = document.querySelector("[data-connected-hosts-empty]");
  const connectedCount = document.querySelector("[data-connected-host-count]");
  const popup = document.querySelector("[data-host-request-popup]");
  const popupText = document.querySelector("[data-host-request-popup-text]");
  const pending = hosts.filter((host) => (host.status || "pending_approval") === "pending_approval");
  const approved = hosts.filter((host) => (host.status || "") === "approved");
  const removing = hosts.filter((host) => ["deletion_requested", "delete_command_sent"].includes(host.status || ""));
  connectedHostsCount = approved.length;
  if (count) {
    count.textContent = `${pending.length} pending`;
    count.className = pending.length ? "pill warn" : "pill good";
  }
  if (list) {
    list.innerHTML = "";
    pending.forEach((host) => {
      const id = escapeHtml(host.id || "");
      list.insertAdjacentHTML("beforeend", `
        <div class="host-request-item">
          <div>
            <strong>${escapeHtml(host.computer_name || "Unnamed Hyper-V Host")}</strong>
            <span>${escapeHtml(host.user_name || "Unknown user")} - ${escapeHtml(host.region || "us-central")} - Workspace ${escapeHtml(host.workspace || data.workspace_code || "")}</span>
            <small>${host.hyperv_module_available ? "Hyper-V module detected" : "Hyper-V module not detected"} - ${escapeHtml(host.registered_at ? new Date(host.registered_at).toLocaleString() : "Just now")}</small>
          </div>
          <div class="host-request-actions">
            <button type="button" data-host-action="approve" data-host-id="${id}">Approve Host</button>
            <button type="button" data-host-action="deny" data-host-id="${id}">Deny Request</button>
          </div>
        </div>
      `);
    });
  }
  if (empty) empty.style.display = pending.length ? "none" : "block";
  if (connectedCount) {
    connectedCount.textContent = `${approved.length} connected`;
    connectedCount.className = approved.length ? "pill good" : "pill";
  }
  if (connectedList) {
    connectedList.innerHTML = "";
    approved.concat(removing).forEach((host) => {
      const id = escapeHtml(host.id || "");
      const online = String(host.agent_status || "").toLowerCase() === "online";
      const deleting = ["deletion_requested", "delete_command_sent"].includes(host.status || "");
      const inventory = host.inventory || {};
      const vmCount = Number(inventory.vm_count || 0);
      const switchCount = Number(inventory.switch_count || 0);
      connectedList.insertAdjacentHTML("beforeend", `
        <div class="connected-host-item">
          <div>
            <strong>${escapeHtml(host.computer_name || "Unnamed Hyper-V Host")}</strong>
            <span>${escapeHtml(host.region || "us-central")} - ${deleting ? "Removal requested" : (online ? "Agent online" : "Agent approved, waiting for check-in")}</span>
            <small>${deleting ? "VisorCore asked the agent to unregister the scheduled task. If this does not clear, use Hard Delete to remove the portal record." : (online ? `${vmCount} VMs discovered - ${switchCount} switches discovered - Last check-in ${escapeHtml(host.last_checkin_at ? new Date(host.last_checkin_at).toLocaleString() : "just now")}` : "The background agent task syncs inventory every 10 seconds and listens for commands every 1 second after approval.")}</small>
          </div>
          <div class="connected-host-meta">
            ${deleting ? pill("Removal Requested", "warn") : (online ? pill("Online", "good") : hostStatusPill("approved"))}
            ${deleting ? pill("Awaiting Agent", "warn") : (online ? pill(`${vmCount} VMs`, vmCount > 0 ? "good" : "warn") : pill("Inventory Pending", "warn"))}
            <button type="button" class="host-delete-button" data-host-action="${deleting ? "hard_delete" : "delete"}" data-host-id="${id}">${deleting ? "Hard Delete" : "Soft Delete"}</button>
          </div>
        </div>
      `);
    });
  }
  if (connectedEmpty) connectedEmpty.style.display = (approved.length || removing.length) ? "none" : "block";
  const hostScope = document.querySelector("[data-host-scope]");
  if (hostScope) {
    hostScope.innerHTML = approved.length
      ? `<option>All Hosts</option>${approved.map((host) => `<option>${escapeHtml(host.computer_name || "Unnamed Host")}</option>`).join("")}`
      : `<option>All Hosts</option><option>No hosts connected</option>`;
    hostScope.disabled = approved.length === 0;
  }
  document.querySelectorAll("[data-host-sync-mode], [data-host-sync-target]").forEach((control) => {
    control.disabled = approved.length === 0;
  });
  renderInventoryViews(hosts);
  renderRecentCommandStatus(data.commands || []);
  if (popup) {
    popup.hidden = pending.length === 0;
    if (popupText && pending.length) {
      popupText.textContent = `${pending[0].computer_name || "A Hyper-V host"} is waiting for approval in the Hosts tab.`;
    }
  }
  if (pending.length > lastPendingHostCount) {
    activatePortalView(document.querySelector(".portal-shell"), "hosts");
  }
  lastPendingHostCount = pending.length;
}

async function loadHostRequests() {
  if (!getStoredAccount() || !document.querySelector("[data-host-requests-list]")) return;
  if (hostRequestsLoading) return;
  hostRequestsLoading = true;
  try {
    const response = await fetch("/api/hosts", {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    if (data.success) {
      renderHostRequests(data);
      return true;
    }
  } catch {
    // Keep the current host shell unchanged if polling fails.
  } finally {
    hostRequestsLoading = false;
  }
  return false;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      parse_failed: true,
      message: text ? "The server returned a non-JSON response after processing the request." : "The server returned an empty response after processing the request.",
    };
  }
}

function showDangerConfirm(title, message, confirmLabel = "Confirm") {
  const modal = document.querySelector("[data-danger-confirm-modal]");
  if (!modal) return Promise.resolve(window.confirm(message));
  const titleEl = modal.querySelector("[data-danger-confirm-title]");
  const messageEl = modal.querySelector("[data-danger-confirm-message]");
  const accept = modal.querySelector("[data-danger-confirm-accept]");
  const cancelButtons = modal.querySelectorAll("[data-danger-confirm-cancel]");
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (accept) accept.textContent = confirmLabel;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  return new Promise((resolve) => {
    const cleanup = (value) => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      accept?.removeEventListener("click", onAccept);
      cancelButtons.forEach((button) => button.removeEventListener("click", onCancel));
      resolve(value);
    };
    const onAccept = () => cleanup(true);
    const onCancel = () => cleanup(false);
    accept?.addEventListener("click", onAccept);
    cancelButtons.forEach((button) => button.addEventListener("click", onCancel));
  });
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-host-action]");
  if (!button) return;
  const action = button.dataset.hostAction;
  const hostId = button.dataset.hostId;
  if (!hostId || !action) return;
  if (action === "delete" && !window.confirm("Soft delete this host? VisorCore will ask the online agent to unregister its scheduled task before removing the portal record.")) return;
  if (action === "hard_delete" && !window.confirm("Hard delete this host record? This removes only the portal record and does not remove the scheduled task from the Hyper-V server.")) return;
  button.disabled = true;
  try {
    const body = new FormData();
    body.set("host_id", hostId);
    body.set("action", action);
    const response = await fetch("/api/hosts", {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await parseJsonResponse(response);
    if (data.parse_failed) {
      const refreshed = await loadHostRequests();
      if (!refreshed) window.alert(data.message);
      return;
    }
    if (!data.success && data.requires_hard_delete) {
      if (window.confirm(`${data.message || "Soft delete could not reach the agent."}\n\nHard delete the portal record anyway?`)) {
        body.set("action", "hard_delete");
        const hardResponse = await fetch("/api/hosts", {
          method: "POST",
          body,
          credentials: "same-origin",
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        });
        const hardData = await parseJsonResponse(hardResponse);
        if (hardData.parse_failed) {
          const refreshed = await loadHostRequests();
          if (!refreshed) window.alert(hardData.message);
          return;
        }
        if (!hardData.success) window.alert(hardData.message || "Hard delete failed.");
        renderHostRequests(hardData);
        return;
      }
    } else if (!data.success) {
      window.alert(data.message || "Host action failed.");
    }
    renderHostRequests(data);
    if (data.success && action === "approve") {
      activatePortalView(document.querySelector(".portal-shell"), "hosts");
    }
  } catch (error) {
    console.error("VisorCore host action failed", error);
    const refreshed = await loadHostRequests();
    if (!refreshed) window.alert("Host status could not be refreshed from this browser session. Sign out, sign back in, and try again.");
  } finally {
    button.disabled = false;
  }
});

async function commandOptionsForButton(button) {
  const action = button.dataset.queueCommand;
  const targetName = button.dataset.targetName || "";
  const options = {};
  if (["vm.shutdown", "vm.turn_off"].includes(action)) {
    const isPowerOff = action === "vm.turn_off";
    const confirmed = await showDangerConfirm(
      isPowerOff ? "Hard power off this VM?" : "Gracefully shut down this VM?",
      isPowerOff
        ? `Hard Power Off immediately cuts power to "${targetName}". Unsaved guest data can be lost.`
        : `Graceful Shutdown asks the guest OS inside "${targetName}" to shut down cleanly. If guest tools are not responding, it may fail.`,
      isPowerOff ? "Hard Power Off" : "Graceful Shutdown",
    );
    if (!confirmed) return null;
  } else if (["vm.restart", "vm.pause", "vm.resume", "vm.save"].includes(action)) {
    const labels = {
      "vm.restart": "Restart",
      "vm.pause": "Pause",
      "vm.resume": "Resume",
      "vm.save": "Save",
    };
    if (!window.confirm(`${labels[action] || "Run action on"} VM "${targetName}"?`)) return null;
  }
  if (action === "vm.checkpoint") {
    const name = window.prompt(`Checkpoint name for "${targetName}"`, `VisorCore ${new Date().toLocaleString()}`);
    if (!name) return null;
    options.name = name;
  }
  if (action === "vm.rename" || action === "switch.rename") {
    const name = window.prompt(`New name for "${targetName}"`, targetName);
    if (!name || name === targetName) return null;
    options.new_name = name;
  }
  if (action === "vm.set_notes" || action === "switch.set_notes") {
    const notes = window.prompt(`Notes for "${targetName}"`, "");
    if (notes === null) return null;
    options.notes = notes;
  }
  if (action === "vm.set_cpu") {
    const count = window.prompt(`CPU count for "${targetName}"`, "2");
    if (!count) return null;
    options.count = count;
  }
  if (action === "vm.set_memory") {
    const startupGb = window.prompt(`Startup memory in GB for "${targetName}"`, "4");
    if (!startupGb) return null;
    options.startup_gb = startupGb;
  }
  if (action === "vm.export") {
    const path = window.prompt(`Export path on the Hyper-V host for "${targetName}"`, "C:\\VMExports");
    if (!path) return null;
    options.path = path;
  }
  if (action === "vm.move_storage") {
    const path = window.prompt(`Destination storage path on the Hyper-V host for "${targetName}"`, "D:\\Hyper-V");
    if (!path) return null;
    options.path = path;
  }
  if (action === "checkpoint.apply") {
    if (!window.confirm(`Apply checkpoint "${targetName}" to VM "${button.dataset.optionVmName || ""}"? This will restore the VM to that checkpoint.`)) return null;
    options.vm_name = button.dataset.optionVmName || "";
  }
  if (action === "checkpoint.delete") {
    if (!window.confirm(`Delete checkpoint "${targetName}" from VM "${button.dataset.optionVmName || ""}"?`)) return null;
    options.vm_name = button.dataset.optionVmName || "";
  }
  if (action === "disk.resize") {
    const sizeGb = window.prompt("New virtual disk size in GB", "128");
    if (!sizeGb) return null;
    options.size_gb = sizeGb;
  }
  if (action === "disk.optimize") {
    if (!window.confirm(`Optimize virtual disk "${targetName}"?`)) return null;
  }
  return options;
}

function setCommandStatus(type, title, message) {
  const status = document.querySelector("[data-command-status]");
  if (!status) return;
  status.className = `command-status ${type || ""}`;
  status.innerHTML = `<span class="status-orb" aria-hidden="true"></span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(message)}</small></span>`;
}

document.addEventListener("click", (event) => {
  const selector = event.target.closest("[data-select-vm]");
  if (selector) {
    selectedVmKey = selector.dataset.selectVm || "";
    updateVmToolbarState();
    document.querySelectorAll("[data-select-vm]").forEach((button) => {
      button.classList.toggle("active", button.dataset.selectVm === selectedVmKey);
    });
    return;
  }
  const consoleButton = event.target.closest("[data-open-vm-console], [data-vm-toolbar-console]");
  if (consoleButton) {
    const key = consoleButton.dataset.vmKey || selectedVmKey;
    const vm = latestVmInventory.find((item) => vmKey(item) === key);
    openVmConsole(vm);
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-queue-command]");
  if (!button) return;
  const options = await commandOptionsForButton(button);
  if (options === null) return;
  button.disabled = true;
  setCommandStatus("active", "Sending action", `${button.textContent.trim() || "Command"} is being handed to the host agent.`);
  try {
    const body = new FormData();
    body.set("host_id", button.dataset.hostId || "");
    body.set("command", button.dataset.queueCommand || "");
    body.set("target_type", button.dataset.targetType || "");
    body.set("target_name", button.dataset.targetName || "");
    body.set("target_id", button.dataset.targetId || "");
    body.set("options", JSON.stringify(options));
    const response = await fetch("/api/commands", {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await parseJsonResponse(response);
    if (!data.success) {
      setCommandStatus("bad", "Action blocked", data.message || "Command could not be sent.");
      return;
    }
    renderRecentCommandStatus(data.commands || []);
    setCommandStatus("good", "Action sent", data.message || "The host agent is picking this up now.");
    startLiveRefreshBurst();
  } catch (error) {
    console.error("VisorCore command queue failed", error);
    setCommandStatus("bad", "Action failed", "Command could not be sent from this browser session.");
  } finally {
    button.disabled = false;
    updateVmToolbarState();
  }
});

document.querySelectorAll("[data-pay-balance]").forEach((button) => {
  button.addEventListener("click", async () => {
    const status = document.querySelector("[data-billing-status]");
    button.disabled = true;
    if (status) {
      status.textContent = "Processing payment...";
      status.className = "form-status";
    }
    try {
      const body = new FormData();
      body.set("action", "pay_all");
      const response = await fetch("/api/billing/invoices", {
        method: "POST",
        body,
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await response.json();
      if (status) {
        status.textContent = data.message || (data.success ? "Payment recorded." : "Payment failed.");
        status.className = data.success ? "form-status ok" : "form-status bad";
      }
      if (data.success) {
        renderInvoices(data);
        if (data.account) {
          storeAccount(data.account, data.mode || data.account.access_mode || "view_only");
          setConsoleAccess(data.mode || data.account.access_mode || "view_only", data.account);
        }
      }
    } catch {
      if (status) {
        status.textContent = "Payment could not be completed from this browser session.";
        status.className = "form-status bad";
      }
    } finally {
      button.disabled = false;
    }
  });
});

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

async function postMfaAction(action, code = "") {
  const body = new FormData();
  body.set("action", action);
  if (code) body.set("code", code);
  const response = await fetch("/api/auth/mfa", {
    method: "POST",
    body,
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  });
  return response.json();
}

document.querySelectorAll("[data-mfa-setup]").forEach((button) => {
  button.addEventListener("click", async () => {
    const status = document.querySelector("[data-profile-status]");
    const panel = document.querySelector("[data-mfa-panel]");
    const qr = document.querySelector("[data-mfa-qr]");
    const secret = document.querySelector("[data-mfa-secret]");
    button.disabled = true;
    if (status) {
      status.textContent = "Preparing MFA enrollment...";
      status.className = "form-status";
    }
    try {
      const data = await postMfaAction("start");
      if (status) {
        status.textContent = data.message || (data.success ? "Scan the MFA QR code." : "MFA setup failed.");
        status.className = data.success ? "form-status ok" : "form-status bad";
      }
      if (!data.success) return;
      if (panel) panel.hidden = false;
      if (qr) {
        qr.hidden = !data.qr_url;
        qr.src = data.qr_url || "";
      }
      if (secret) secret.textContent = data.secret || "";
      if (data.account) {
        storeAccount(data.account, data.mode || data.account.access_mode || "view_only");
      }
    } catch {
      if (status) {
        status.textContent = "MFA setup could not start from this browser session.";
        status.className = "form-status bad";
      }
    } finally {
      button.disabled = false;
    }
  });
});

document.querySelectorAll("[data-mfa-verify]").forEach((button) => {
  button.addEventListener("click", async () => {
    const status = document.querySelector("[data-profile-status]");
    const code = document.querySelector("[data-mfa-code]")?.value || "";
    button.disabled = true;
    if (status) {
      status.textContent = "Verifying MFA code...";
      status.className = "form-status";
    }
    try {
      const data = await postMfaAction("verify", code);
      if (status) {
        status.textContent = data.message || (data.success ? "MFA enabled." : "MFA verification failed.");
        status.className = data.success ? "form-status ok" : "form-status bad";
      }
      if (data.success) {
        document.querySelector("[data-mfa-panel]")?.setAttribute("hidden", "");
        if (data.account) storeAccount(data.account, data.mode || data.account.access_mode || "view_only");
      }
    } catch {
      if (status) {
        status.textContent = "MFA code could not be verified from this browser session.";
        status.className = "form-status bad";
      }
    } finally {
      button.disabled = false;
    }
  });
});

document.querySelectorAll("[data-mfa-disable]").forEach((button) => {
  button.addEventListener("click", async () => {
    const code = window.prompt("Enter your current 6-digit MFA code to disable MFA.");
    if (!code) return;
    const status = document.querySelector("[data-profile-status]");
    button.disabled = true;
    try {
      const data = await postMfaAction("disable", code);
      if (status) {
        status.textContent = data.message || (data.success ? "MFA disabled." : "MFA could not be disabled.");
        status.className = data.success ? "form-status ok" : "form-status bad";
      }
      if (data.success && data.account) storeAccount(data.account, data.mode || data.account.access_mode || "view_only");
    } catch {
      if (status) {
        status.textContent = "MFA could not be disabled from this browser session.";
        status.className = "form-status bad";
      }
    } finally {
      button.disabled = false;
    }
  });
});

document.querySelectorAll("[data-subuser-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-subuser-status]");
    const submit = form.querySelector('button[type="submit"]');
    const permissions = Array.from(form.querySelectorAll("[data-subuser-permissions] input:checked")).map((input) => input.value);
    const body = new FormData(form);
    body.set("action", "save");
    body.set("permissions", JSON.stringify(permissions));
    body.set("mfa_required", form.elements.mfa_required?.checked ? "1" : "0");
    if (submit) submit.disabled = true;
    if (status) {
      status.textContent = "Inviting sub-user...";
      status.className = "form-status";
    }
    try {
      const response = await fetch("/api/account/users", {
        method: "POST",
        body,
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await response.json();
      if (status) {
        status.textContent = data.success ? "Sub-user saved. Invite email delivery is ready for the next mail pass." : (data.message || "Sub-user could not be saved.");
        status.className = data.success ? "form-status ok" : "form-status bad";
      }
      if (data.success) {
        form.reset();
        renderSubUsers(data);
        if (data.account) storeAccount(data.account, data.mode || data.account.access_mode || "view_only");
      }
    } catch {
      if (status) {
        status.textContent = "Sub-user could not be saved from this browser session.";
        status.className = "form-status bad";
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-subuser-delete]");
  if (!button) return;
  if (!window.confirm("Remove this sub-user from the workspace?")) return;
  const status = document.querySelector("[data-subuser-status]");
  const body = new FormData();
  body.set("action", "delete");
  body.set("user_id", button.dataset.subuserDelete || "");
  button.disabled = true;
  try {
    const response = await fetch("/api/account/users", {
      method: "POST",
      body,
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    if (status) {
      status.textContent = data.success ? "Sub-user removed." : (data.message || "Sub-user could not be removed.");
      status.className = data.success ? "form-status ok" : "form-status bad";
    }
    if (data.success) {
      renderSubUsers(data);
      if (data.account) storeAccount(data.account, data.mode || data.account.access_mode || "view_only");
    }
  } catch {
    if (status) {
      status.textContent = "Sub-user could not be removed from this browser session.";
      status.className = "form-status bad";
    }
  } finally {
    button.disabled = false;
  }
});

async function postStaffMfaAction(action, code = "") {
  const body = new FormData();
  body.set("action", action);
  if (code) body.set("code", code);
  const response = await fetch("/api/staff/mfa", {
    method: "POST",
    body,
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  });
  return response.json();
}

document.querySelectorAll("[data-staff-mfa-setup]").forEach((button) => {
  button.addEventListener("click", async () => {
    const status = document.querySelector("[data-staff-mfa-status]");
    button.disabled = true;
    if (status) {
      status.textContent = "Preparing staff MFA enrollment...";
      status.className = "form-status";
    }
    try {
      const data = await postStaffMfaAction("start");
      if (status) {
        status.textContent = data.message || (data.success ? "Scan the staff MFA QR code." : "Staff MFA setup failed.");
        status.className = data.success ? "form-status ok" : "form-status bad";
      }
      if (!data.success) return;
      document.querySelector("[data-staff-mfa-panel]")?.removeAttribute("hidden");
      const qr = document.querySelector("[data-staff-mfa-qr]");
      const secret = document.querySelector("[data-staff-mfa-secret]");
      if (qr) {
        qr.hidden = !data.qr_url;
        qr.src = data.qr_url || "";
      }
      if (secret) secret.textContent = data.secret || "";
      if (data.admin) {
        localStorage.setItem("visorcore-staff-admin", JSON.stringify(data.admin));
        renderStaffAdmin(data.admin);
      }
    } catch {
      if (status) {
        status.textContent = "Staff MFA setup could not start from this browser session.";
        status.className = "form-status bad";
      }
    } finally {
      button.disabled = false;
    }
  });
});

document.querySelectorAll("[data-staff-mfa-verify]").forEach((button) => {
  button.addEventListener("click", async () => {
    const status = document.querySelector("[data-staff-mfa-status]");
    const code = document.querySelector("[data-staff-mfa-code]")?.value || "";
    button.disabled = true;
    try {
      const data = await postStaffMfaAction("verify", code);
      if (status) {
        status.textContent = data.message || (data.success ? "Staff MFA enabled." : "Staff MFA verification failed.");
        status.className = data.success ? "form-status ok" : "form-status bad";
      }
      if (data.success) {
        document.querySelector("[data-staff-mfa-panel]")?.setAttribute("hidden", "");
        if (data.admin) {
          localStorage.setItem("visorcore-staff-admin", JSON.stringify(data.admin));
          renderStaffAdmin(data.admin);
        }
      }
    } catch {
      if (status) {
        status.textContent = "Staff MFA code could not be verified from this browser session.";
        status.className = "form-status bad";
      }
    } finally {
      button.disabled = false;
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
  const suspended = client.account_status === "suspended";
  return `<div class="client-actions">
    <button type="button" data-client-action="${suspended ? "unsuspend" : "suspend"}" data-client-id="${id}">${suspended ? "Unsuspend" : "Suspend"}</button>
    <button type="button" data-client-action="reset_mfa" data-client-id="${id}">Reset MFA</button>
    <button type="button" data-client-action="terminate" data-client-id="${id}">Terminate</button>
    <button type="button" data-client-action="delete" data-client-id="${id}">Delete</button>
  </div>`;
}

function staffHostActionButtons(host) {
  const id = escapeHtml(host.id || "");
  const deleting = ["deletion_requested", "delete_command_sent"].includes(host.status || "");
  return `<div class="client-actions">
    <button type="button" data-staff-host-action="${deleting ? "hard_delete" : "delete"}" data-host-id="${id}">${deleting ? "Hard Delete" : "Soft Delete"}</button>
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

  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  const adminInvoicesTable = document.querySelector("[data-admin-invoices-table]");
  const adminInvoicesEmpty = document.querySelector("[data-admin-invoices-empty]");
  if (adminInvoicesTable) {
    adminInvoicesTable.querySelectorAll("div:not(:first-child)").forEach((row) => row.remove());
    invoices.forEach((invoice) => {
      adminInvoicesTable.insertAdjacentHTML("beforeend", tableRow([
        escapeHtml(invoice.id || ""),
        escapeHtml(invoice.client || invoice.email || ""),
        escapeHtml(money(invoice.balance ?? invoice.amount_due)),
        pill(invoice.status || "Due", String(invoice.status || "").toLowerCase() === "paid" ? "good" : "warn"),
        escapeHtml(invoice.due_at ? new Date(invoice.due_at).toLocaleDateString() : "On receipt"),
      ]));
    });
  }
  if (adminInvoicesEmpty) adminInvoicesEmpty.hidden = invoices.length > 0;

  const hosts = Array.isArray(data.hosts) ? data.hosts : [];
  const adminHostsTable = document.querySelector("[data-admin-hosts-table]");
  const adminHostsEmpty = document.querySelector("[data-admin-hosts-empty]");
  if (adminHostsTable) {
    adminHostsTable.querySelectorAll("div:not(:first-child)").forEach((row) => row.remove());
    hosts.forEach((host) => {
      const deleting = ["deletion_requested", "delete_command_sent"].includes(host.status || "");
      adminHostsTable.insertAdjacentHTML("beforeend", tableRow([
        escapeHtml(host.computer_name || ""),
        escapeHtml(host.workspace || ""),
        pill(deleting ? "Removal Requested" : (host.agent_status || host.status || "Pending"), String(host.agent_status || "").toLowerCase() === "online" && !deleting ? "good" : "warn"),
        escapeHtml(host.last_checkin_at ? new Date(host.last_checkin_at).toLocaleString() : "Never"),
        staffHostActionButtons(host),
      ]));
    });
  }
  if (adminHostsEmpty) adminHostsEmpty.hidden = hosts.length > 0;

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
  const label = action.replace(/_/g, " ");
  if (!window.confirm(`Are you sure you want to ${label} for this client?`)) return;
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

document.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-staff-host-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.staffHostAction;
  const hostId = actionButton.dataset.hostId;
  if (!hostId || !["delete", "hard_delete"].includes(action)) return;
  if (action === "delete" && !window.confirm("Soft delete this host? VisorCore will ask the online agent to unregister its scheduled task before removing the portal record.")) return;
  if (action === "hard_delete" && !window.confirm("Hard delete this host record from VisorCore Admin? This removes only the portal record and does not remove the scheduled task.")) return;
  actionButton.disabled = true;
  try {
    const body = new FormData();
    body.set("host_id", hostId);
    body.set("action", action);
    const response = await fetch("/api/staff/host-action", {
      method: "POST",
      body,
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await parseJsonResponse(response);
    if (data.parse_failed) {
      await loadStaffDashboard();
      return;
    }
    if (!data.success && data.requires_hard_delete) {
      if (window.confirm(`${data.message || "Soft delete could not reach the agent."}\n\nHard delete the portal record anyway?`)) {
        body.set("action", "hard_delete");
        const hardResponse = await fetch("/api/staff/host-action", {
          method: "POST",
          body,
          credentials: "same-origin",
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        });
        const hardData = await parseJsonResponse(hardResponse);
        if (hardData.parse_failed) {
          await loadStaffDashboard();
          return;
        }
        if (!hardData.success) window.alert(hardData.message || "Hard delete failed.");
      }
    } else if (!data.success) {
      window.alert(data.message || "Host action failed.");
    }
    await loadStaffDashboard();
  } catch (error) {
    console.error("VisorCore staff host action failed", error);
    await loadStaffDashboard();
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
