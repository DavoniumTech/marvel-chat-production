// Keeps the legal-page return control inside the visitor's current navigation flow.
document.addEventListener("click", (event) => {
  const link = event.target.closest?.("[data-return-marvel]");
  if (!link) return;
  event.preventDefault();
  const referrer = document.referrer;
  const sameOriginReferrer = (() => { try { return referrer && new URL(referrer).origin === location.origin; } catch { return false; } })();
  if (sameOriginReferrer && history.length > 1) history.back();
  else location.replace("./");
});
