const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const USER_TOKEN_KEY = 'user-token';
const USERNAME_KEY = 'user-username';

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem(USER_TOKEN_KEY, data.token);
                localStorage.setItem(USERNAME_KEY, data.username);
                window.location.href = '/dashboard.html';
            } else {
                alert(data.msg || 'Login failed');
            }
        } catch (err) {
            console.error(err);
            alert('Server error');
        }
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (res.ok) {
                alert('Registration successful! Please login.');
                window.location.href = '/login.html';
            } else {
                alert(data.msg || 'Registration failed');
            }
        } catch (err) {
            console.error(err);
            alert('Server error');
        }
    });
}
