function getLang() {
  return localStorage.getItem('appLang') || 'fr';
}

function t(key, vars) {
  const lang = getLang();
  let str = (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || key;
  if (vars) {
    Object.keys(vars).forEach(k => {
      str = str.split(`{${k}}`).join(vars[k]);
    });
  }
  return str;
}

function translateSpecialty(value) {
  const key = window.SPECIALTY_KEY_MAP && window.SPECIALTY_KEY_MAP[value];
  return key ? t(key) : value;
}

function translateStatus(status) {
  const map = { pending: 'statusPending', confirmed: 'statusConfirmed', cancelled: 'statusCancelled', completed: 'statusCompleted' };
  return t(map[status] || status);
}

function localeTag() {
  return getLang() === 'ar' ? 'ar-TN' : 'fr-FR';
}

function applyDirection(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  updateLangSwitcherUI();
}

function updateLangSwitcherUI() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}

function setLang(lang) {
  localStorage.setItem('appLang', lang);
  applyDirection(lang);
  applyTranslations();
  if (typeof renderIcons === 'function') renderIcons();
  if (typeof window.onLanguageChange === 'function') window.onLanguageChange();
}

function initLangSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyDirection(getLang());
  applyTranslations();
  initLangSwitcher();
});
