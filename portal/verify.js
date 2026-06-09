(async () => {
  const title = document.querySelector("[data-verify-title]");
  const message = document.querySelector("[data-verify-message]");
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const markSession = () => {
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `visorcore_hyper_session=full_access; Path=/; Domain=.visorcore.com; Max-Age=${maxAge}; SameSite=Lax; Secure`;
  };
  if (!token) {
    title.textContent = "Confirmation link missing.";
    message.textContent = "Open the full confirmation link from your email or sign in to request a new account confirmation.";
    return;
  }
  try {
    const response = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json();
    title.textContent = data.success ? "Email confirmed." : "Confirmation failed.";
    message.textContent = data.message || "The confirmation request could not be completed.";
    if (data.success && data.account) {
      localStorage.setItem("visorcore-hyper-account", JSON.stringify(data.account));
      localStorage.setItem("visorcore-hyper-access", "full_access");
      markSession();
    }
  } catch {
    title.textContent = "Confirmation failed.";
    message.textContent = "The confirmation service could not be reached. Please try again shortly.";
  }
})();
