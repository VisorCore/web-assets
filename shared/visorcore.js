const root = document.documentElement;
const savedTheme = localStorage.getItem("visorcore-theme");
if (savedTheme) root.dataset.theme = savedTheme;

function hasCookie(name) {
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${name}=`));
}

function updateHyperPortalLinks() {
  const hasHyperSession = hasCookie("visorcore_hyper_session") || localStorage.getItem("visorcore-hyper-access");
  if (!hasHyperSession) return;
  document.querySelectorAll("[data-hyper-portal-link]").forEach((link) => {
    link.textContent = link.classList.contains("btn") ? "Return to Hyper Portal" : "Return";
    link.setAttribute("aria-label", "Return to Hyper Portal");
  });
}
updateHyperPortalLinks();

document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem("visorcore-theme", root.dataset.theme);
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("is-visible");
  });
}, { threshold: 0.16 });
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

document.querySelectorAll("[data-tilt]").forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 8;
    const y = ((event.clientY - rect.top) / rect.height - .5) * -8;
    card.style.transform = `perspective(1000px) rotateX(${y}deg) rotateY(${x}deg)`;
  });
  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
});

const modal = document.querySelector("[data-contact-modal]");
const openModal = () => {
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  window.requestAnimationFrame(() => mountTurnstile(modal));
};
const closeModal = () => {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};

document.querySelectorAll("[data-contact-open]").forEach((button) => button.addEventListener("click", openModal));
document.querySelectorAll("[data-contact-close]").forEach((button) => button.addEventListener("click", closeModal));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

async function mountTurnstile(scope = document) {
  const slots = Array.from(scope.querySelectorAll("[data-turnstile-slot]"));
  if (!slots.length) return;
  try {
    const response = await fetch("/contact-captcha", { headers: { Accept: "application/json" } });
    const captcha = await response.json();
    slots.forEach((slot) => {
      if (slot.querySelector("iframe") || slot.querySelector('.cf-turnstile[data-rendered="true"]')) return;
      if (!captcha.configured || !captcha.siteKey) {
        slot.innerHTML = '<p class="form-status">Security challenge will appear after Turnstile keys are configured.</p>';
        return;
      }
      slot.innerHTML = "";
      const challenge = document.createElement("div");
      challenge.className = "cf-turnstile";
      challenge.dataset.sitekey = captcha.siteKey;
      const feedback = document.createElement("div");
      feedback.className = "turnstile-feedback";
      feedback.setAttribute("aria-live", "polite");
      slot.appendChild(challenge);
      slot.appendChild(feedback);

      const setFeedback = (state, message) => {
        slot.dataset.turnstileState = state;
        feedback.className = `turnstile-feedback ${state}`;
        const icon = state === "success" ? "✓" : "×";
        const retry = state === "error" ? '<button type="button" data-turnstile-retry>Retry</button>' : "";
        feedback.innerHTML = `<span>${icon}</span><strong>${message}</strong>${retry}`;
        feedback.querySelector("[data-turnstile-retry]")?.addEventListener("click", () => {
          slot.innerHTML = "";
          delete slot.dataset.turnstileState;
          mountTurnstile(slot.parentElement || document);
        });
      };

      const render = () => {
        if (!window.turnstile || challenge.dataset.rendered === "true") return;
        window.turnstile.render(challenge, {
          sitekey: captcha.siteKey,
          callback: () => setFeedback("success", "Security check complete."),
          "error-callback": () => setFeedback("error", "Security check failed."),
          "expired-callback": () => setFeedback("error", "Security check expired."),
        });
        challenge.dataset.rendered = "true";
      };

      if (window.turnstile) {
        render();
        return;
      }

      let script = document.querySelector('script[data-turnstile-api]');
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.turnstileApi = "true";
        script.addEventListener("load", render);
        document.head.appendChild(script);
      } else {
        script.addEventListener("load", render);
      }
    });
  } catch {
    slots.forEach((slot) => {
      slot.innerHTML = '<p class="form-status bad">Security challenge configuration could not be loaded.</p>';
    });
  }
}
window.mountTurnstile = mountTurnstile;

document.querySelectorAll("[data-contact-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-form-status]");
    const submit = form.querySelector('button[type="submit"]');
    status.textContent = "Sending...";
    status.className = "form-status";
    submit.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await response.json();
      status.textContent = data.message || (response.ok ? "Message sent." : "Message not sent.");
      status.classList.add(data.success ? "ok" : "bad");
      if (data.success) form.reset();
    } catch {
      status.textContent = "Message could not be sent from this browser session.";
      status.classList.add("bad");
    } finally {
      submit.disabled = false;
    }
  });
});
