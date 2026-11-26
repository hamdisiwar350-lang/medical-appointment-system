(() => {
  const user = getUser();

  if (!getToken() || !user || user.role !== "doctor") {
    const destination = user?.role === "assistant"
      ? "assistant-dashboard.html"
      : user?.role === "patient"
        ? "dashboard.html"
        : "index.html";

    window.location.replace(destination);
    return;
  }


  function renderProfile() {
    const name = user.name || "";
    const nameEl = document.getElementById("docName");
    const avatar = document.getElementById("docAvatar");
    const greeting = document.getElementById("docGreeting");
    const specialtyEl = document.getElementById("docSpecialty");
    const dateEl = document.getElementById("todayDate");

    if (nameEl) nameEl.textContent = name;

    if (avatar) {
      avatar.textContent =
        name.replace(/^(د\.|dr\.?)\s*/i, "").trim().charAt(0) || "د";
    }

    if (greeting) greeting.textContent = t("doctorGreeting", { name });

    if (specialtyEl) specialtyEl.textContent = t("dentistRoleLabel");

    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString(localeTag(), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }
  }

  window.onLanguageChange = renderProfile;

  document.addEventListener("DOMContentLoaded", async () => {
    renderProfile();

    document.getElementById("docLogout")?.addEventListener("click", () => {
      clearSession();
      window.location.href = "index.html";
    });

  });
})();
