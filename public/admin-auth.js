const form = document.getElementById('admin-login-form');

const ADMIN_TOKEN_KEY = 'admin-token';
const ADMIN_USERNAME_KEY = 'admin-username';

form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const loginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const loginData = await loginResponse.json();
        if (!loginResponse.ok) {
            alert(loginData.msg || 'Invalid credentials');
            return;
        }

        const token = loginData.token;
        const statsResponse = await fetch('/admin/stats', {
            headers: { Authorization: token }
        });

        if (!statsResponse.ok) {
            alert('Access denied. Admin account required.');
            return;
        }

        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        localStorage.setItem(ADMIN_USERNAME_KEY, loginData.username || username);
        window.location.href = '/admin.html';
    } catch (error) {
        console.error(error);
        alert('Server error. Please try again.');
    }
});
