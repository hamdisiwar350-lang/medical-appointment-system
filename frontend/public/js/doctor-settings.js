document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('doctorSettingsForm');
    if (!form) return;

    const user = getUser();
    const message = document.getElementById('settingsMessage');
    const button = form.querySelector('button[type="submit"]');

    if (!getToken() || !user || user.role !== 'doctor') {
        window.location.href = 'index.html';
        return;
    }

    function showMessage(key, type) {
        message.textContent = t(key);
        message.className = `settings-message ${type}`;
    }

    // Charger les paramètres actuels
    try {
        const doctor = await apiRequest(
            `/doctors/${encodeURIComponent(user.id)}`
        );

        form.elements.phone.value = doctor.phone || '';
        form.elements.availableFrom.value =
            doctor.availableFrom || '09:00';
        form.elements.availableTo.value =
            doctor.availableTo || '17:00';

    } catch (error) {
        showMessage('settingsLoadingError', 'error');
    }

    // Enregistrer les paramètres
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const phone = form.elements.phone.value.trim();
        const availableFrom = form.elements.availableFrom.value;
        const availableTo = form.elements.availableTo.value;

        if (!availableFrom || !availableTo ||
            availableFrom >= availableTo) {
            showMessage('settingsSaveError', 'error');
            return;
        }

        button.disabled = true;

        try {
            await apiRequest(
                `/doctors/${encodeURIComponent(user.id)}`,
                'PUT',
                { phone, availableFrom, availableTo }
            );

            showMessage('settingsSavedMessage', 'success');

        } catch (error) {
            message.textContent =
                `${t('settingsSaveError')} ${error.message}`;
            message.className = 'settings-message error';

        } finally {
            button.disabled = false;
        }
    });
});
