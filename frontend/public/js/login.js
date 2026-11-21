let selectedRole = 'patient';

document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedRole = btn.dataset.role;
    document.getElementById('specialtyField').style.display =
      selectedRole === 'doctor' ? 'block' : 'none';
  });
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab + 'Panel').classList.add('active');
  });
});

function translateApiError(message) {
  if (message === 'Invalid credentials') return t('errorInvalidCredentials');
  if (message === 'Email already exists') return t('errorEmailExists');
  return message || t('errorGeneric');
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorBox = document.getElementById('loginError');
  errorBox.textContent = '';
  try {
    const data = await apiRequest('/auth/login', 'POST', { email, password }, false);
    setSession(data.token, data.user);
    window.location.href = data.user.role === 'doctor' ? 'doctor-dashboard.html' : 'dashboard.html';
  } catch (err) {
    errorBox.textContent = translateApiError(err.message);
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const specialty = document.getElementById('regSpecialty').value;
  const errorBox = document.getElementById('registerError');
  const successBox = document.getElementById('registerSuccess');
  errorBox.textContent = '';
  successBox.textContent = '';

  const payload = { name, email, password, role: selectedRole };
  if (selectedRole === 'doctor') payload.specialty = specialty;

  try {
    await apiRequest('/auth/register', 'POST', payload, false);
    successBox.textContent = t('registerSuccess');
    document.getElementById('registerForm').reset();
  } catch (err) {
    errorBox.textContent = translateApiError(err.message);
  }
});

if (getToken()) {
  const user = getUser();
  window.location.href = user?.role === 'doctor' ? 'doctor-dashboard.html' : 'dashboard.html';
}
