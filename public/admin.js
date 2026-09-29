const ADMIN_TOKEN_KEY = 'admin-token';
const ADMIN_USERNAME_KEY = 'admin-username';

const token = localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem('token');
const hasToken = Boolean(token);
let isRedirectingToLogin = false;

if (!hasToken) {
    isRedirectingToLogin = true;
    window.location.replace('/admin-login.html');
}

let currentSection = 'dashboard';
let statsChart = null;
let allNotes = [];
let selectedUserId = null;

const sectionTitles = {
    dashboard: 'Dashboard Overview',
    notes: 'Note Management',
    users: 'User & Security Management',
    reviews: 'Review Moderation',
    settings: 'Settings'
};

const apiFetch = async (url, options = {}) => {
    if (!hasToken) {
        throw new Error('Missing auth token');
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: token,
            ...(options.headers || {})
        }
    });

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_USERNAME_KEY);
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        if (!isRedirectingToLogin) {
            isRedirectingToLogin = true;
            alert('Admin access required. Please login again.');
            window.location.replace('/admin-login.html');
        }
        throw new Error('Unauthorized');
    }

    return response;
};

const closeSidebarMobile = () => {
    document.getElementById('admin-sidebar')?.classList.add('-translate-x-full');
    document.getElementById('mobile-overlay')?.classList.add('hidden');
};

const openSidebarMobile = () => {
    document.getElementById('admin-sidebar')?.classList.remove('-translate-x-full');
    document.getElementById('mobile-overlay')?.classList.remove('hidden');
};

window.showSection = (sectionId) => {
    currentSection = sectionId;

    document.querySelectorAll('.sidebar-link').forEach((link) => {
        link.classList.toggle('active', link.dataset.section === sectionId);
    });

    document.querySelectorAll('.section').forEach((section) => {
        section.classList.toggle('active', section.id === sectionId);
    });

    document.getElementById('section-title').innerText = sectionTitles[sectionId] || 'Admin';
    closeSidebarMobile();

    if (sectionId === 'dashboard') fetchStats();
    if (sectionId === 'notes') fetchNotes();
    if (sectionId === 'users') fetchUsersDetailed();
    if (sectionId === 'reviews') fetchReviewsDetailed();
    if (sectionId === 'settings') fetchSystemHistory();
};

const initChart = (stats) => {
    const canvas = document.getElementById('statsChart');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (statsChart) statsChart.destroy();

    statsChart = new Chart(context, {
        type: 'bar',
        data: {
            labels: ['Users', 'Notes', 'Sharing Links', 'Pending Reviews'],
            datasets: [{
                label: 'System Totals',
                data: [stats.userCount || 0, stats.noteCount || 0, stats.activeSharingLinks || 0, stats.pendingReviews || 0],
                backgroundColor: ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
};

const fetchStats = async () => {
    try {
        const response = await apiFetch('/admin/stats');
        const data = await response.json();
        document.getElementById('stats-users').innerText = data.userCount ?? 0;
        document.getElementById('stats-notes').innerText = data.noteCount ?? 0;
        document.getElementById('stats-pending').innerText = data.pendingReviews ?? 0;
        document.getElementById('stats-links').innerText = data.activeSharingLinks ?? 0;
        document.getElementById('stats-premium').innerText = data.premiumUpgradeCount ?? 0;
        initChart(data);
    } catch (error) {
        console.error(error);
    }
};

const noteStatusBadge = (note) => {
    if (note.isFlagged) {
        return '<span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Flagged</span>';
    }
    if (note.isArchived) {
        return '<span class="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs">Archived</span>';
    }
    if (note.isPublic) {
        return '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Public</span>';
    }
    return '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">Private</span>';
};

const renderNotes = (notes) => {
    const table = document.getElementById('notes-table');
    table.innerHTML = '';

    if (!notes.length) {
        table.innerHTML = '<tr><td class="p-4 text-gray-500" colspan="5">No notes found.</td></tr>';
        return;
    }

    notes.forEach((note) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-4 font-medium">${note.title || 'Untitled Note'}</td>
            <td class="p-4 text-gray-500">${note.owner?.username || 'Unknown'}</td>
            <td class="p-4 text-gray-500 text-sm">${new Date(note.createdAt || note.updatedAt).toLocaleDateString()}</td>
            <td class="p-4">${noteStatusBadge(note)}</td>
            <td class="p-4 text-right space-x-3">
                <button onclick="editNote('${note._id}')" class="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                <button onclick="archiveNote('${note._id}')" class="text-orange-600 hover:text-orange-800 font-medium">Archive</button>
                <button onclick="deleteNote('${note._id}')" class="text-red-600 hover:text-red-800 font-medium">Delete</button>
            </td>
        `;
        table.appendChild(row);
    });
};

const fetchNotes = async () => {
    try {
        const response = await apiFetch('/api/admin/notes');
        allNotes = await response.json();
        renderNotes(allNotes);
    } catch (error) {
        console.error(error);
    }
};

window.addNote = async () => {
    const title = prompt('Enter note title:');
    if (title === null) return;
    const content = prompt('Enter note content:') || '';

    try {
        const response = await apiFetch('/api/admin/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });

        if (response.ok) fetchNotes();
    } catch (error) {
        console.error(error);
    }
};

window.editNote = async (id) => {
    const note = allNotes.find((item) => item._id === id);
    if (!note) return;

    const title = prompt('Update note title:', note.title || '');
    if (title === null) return;
    const content = prompt('Update note content:', note.content || '');
    if (content === null) return;

    try {
        const response = await apiFetch(`/api/admin/notes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });

        if (response.ok) fetchNotes();
    } catch (error) {
        console.error(error);
    }
};

window.archiveNote = async (id) => {
    try {
        const response = await apiFetch(`/api/admin/notes/${id}/archive`, {
            method: 'PUT'
        });

        if (response.ok) fetchNotes();
    } catch (error) {
        console.error(error);
    }
};

window.deleteNote = async (id) => {
    if (!confirm('Delete this note permanently?')) return;
    try {
        const response = await apiFetch(`/api/admin/notes/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) fetchNotes();
    } catch (error) {
        console.error(error);
    }
};

document.getElementById('note-search')?.addEventListener('input', (event) => {
    const term = event.target.value.toLowerCase();
    const filtered = allNotes.filter((note) => {
        return (note.title || '').toLowerCase().includes(term) || (note.owner?.username || '').toLowerCase().includes(term);
    });
    renderNotes(filtered);
});

const fetchUsersDetailed = async () => {
    try {
        const response = await apiFetch('/api/admin/users');
        const users = await response.json();
        const table = document.getElementById('users-table-detailed');
        table.innerHTML = '';

        users.forEach((user) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-4 flex items-center">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}" class="w-8 h-8 rounded-full mr-3" alt="avatar">
                    <span class="font-medium">${user.username}</span>
                </td>
                <td class="p-4 text-gray-500">${user.role}</td>
                <td class="p-4">
                    <span class="px-2 py-1 ${user.isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} rounded-full text-xs">
                        ${user.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                </td>
                <td class="p-4 text-gray-400 text-sm">${new Date(user.createdAt).toLocaleDateString()}</td>
                <td class="p-4 text-right space-x-3">
                    <button onclick="openResetModal('${user._id}', '${user.username.replace(/'/g, "\\'")}')" class="text-blue-600 hover:text-blue-800">Reset</button>
                    <button onclick="toggleBlock('${user._id}')" class="${user.isBlocked ? 'text-green-600 hover:text-green-800' : 'text-orange-600 hover:text-orange-800'}">
                        ${user.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                </td>
            `;
            table.appendChild(row);
        });
    } catch (error) {
        console.error(error);
    }
};

window.toggleBlock = async (id) => {
    try {
        const response = await apiFetch(`/api/admin/users/${id}/toggle-block`, {
            method: 'PUT'
        });
        if (response.ok) fetchUsersDetailed();
    } catch (error) {
        console.error(error);
    }
};

window.openResetModal = (id, name) => {
    selectedUserId = id;
    document.getElementById('reset-user-name').innerText = `User: ${name}`;
    document.getElementById('password-modal').classList.remove('hidden');
};

window.closePasswordModal = () => {
    document.getElementById('password-modal').classList.add('hidden');
    document.getElementById('new-password').value = '';
};

window.saveNewPassword = async () => {
    const newPassword = document.getElementById('new-password').value;
    if (!newPassword) {
        alert('Enter a password');
        return;
    }

    try {
        const response = await apiFetch(`/api/admin/users/${selectedUserId}/reset-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword })
        });
        if (response.ok) {
            alert('Password reset successful');
            closePasswordModal();
        }
    } catch (error) {
        console.error(error);
    }
};

const renderStars = (rating) => {
    const fullStars = '★'.repeat(Math.max(0, Math.min(5, rating)));
    const emptyStars = '☆'.repeat(Math.max(0, 5 - rating));
    return `${fullStars}${emptyStars}`;
};

const fetchReviewsDetailed = async () => {
    try {
        const response = await apiFetch('/api/admin/reviews');
        const reviews = await response.json();
        const table = document.getElementById('reviews-table-admin');
        table.innerHTML = '';

        if (!reviews.length) {
            table.innerHTML = '<tr><td class="p-4 text-gray-500" colspan="6">No pending reviews.</td></tr>';
            return;
        }

        reviews.forEach((review) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-4 font-medium">${review.user?.username || 'Unknown'}</td>
                <td class="p-4 text-gray-500 text-sm">${review.note?.title || 'N/A'}</td>
                <td class="p-4 text-yellow-500">${renderStars(review.rating || 0)}</td>
                <td class="p-4 text-gray-600 max-w-[280px]">${review.comment || ''}</td>
                <td class="p-4">
                    <input id="reply-${review._id}" class="w-48 p-2 border rounded-lg" placeholder="Reply to user" value="${review.adminReply || ''}">
                </td>
                <td class="p-4 text-right space-x-2 whitespace-nowrap">
                    <button onclick="approveReview('${review._id}')" class="text-green-600 hover:text-green-800 font-medium">Approve</button>
                    <button onclick="replyReview('${review._id}')" class="text-blue-600 hover:text-blue-800 font-medium">Reply</button>
                    <button onclick="rejectReview('${review._id}')" class="text-red-600 hover:text-red-800 font-medium">Reject</button>
                </td>
            `;
            table.appendChild(row);
        });
    } catch (error) {
        console.error(error);
    }
};

window.approveReview = async (id) => {
    const replyValue = document.getElementById(`reply-${id}`)?.value || '';
    try {
        const response = await apiFetch('/admin/approve-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewId: id, reply: replyValue })
        });
        if (response.ok) fetchReviewsDetailed();
    } catch (error) {
        console.error(error);
    }
};

window.replyReview = async (id) => {
    const reply = document.getElementById(`reply-${id}`)?.value || '';
    if (!reply.trim()) {
        alert('Enter a reply before saving.');
        return;
    }

    try {
        const response = await apiFetch(`/api/admin/reviews/${id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply })
        });
        if (response.ok) alert('Reply saved');
    } catch (error) {
        console.error(error);
    }
};

window.rejectReview = async (id) => {
    if (!confirm('Reject and delete this review?')) return;
    try {
        const response = await apiFetch(`/api/admin/reviews/${id}`, {
            method: 'DELETE'
        });
        if (response.ok) fetchReviewsDetailed();
    } catch (error) {
        console.error(error);
    }
};

const fetchSystemHistory = async () => {
    try {
        const response = await apiFetch('/api/admin/history');
        const data = await response.json();
        const historyTable = document.getElementById('history-table');
        historyTable.innerHTML = '';

        const historyItems = data.history || [];
        document.getElementById('stats-usage').innerText = data.usageEventsLast7Days ?? historyItems.length;
        document.getElementById('settings-last-sync').innerText = new Date().toLocaleString();

        if (!historyItems.length) {
            historyTable.innerHTML = '<tr><td class="p-4 text-gray-500" colspan="4">No activity found.</td></tr>';
            return;
        }

        historyItems.forEach((item) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-4 font-medium">${item.event}</td>
                <td class="p-4 text-gray-600">${item.actor}</td>
                <td class="p-4 text-gray-500">${item.type}</td>
                <td class="p-4 text-gray-500 text-sm">${new Date(item.date).toLocaleString()}</td>
            `;
            historyTable.appendChild(row);
        });
    } catch (error) {
        console.error(error);
    }
};

document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    openSidebarMobile();
});

document.getElementById('mobile-overlay')?.addEventListener('click', () => {
    closeSidebarMobile();
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USERNAME_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/admin-login.html';
});

document.getElementById('add-note-btn')?.addEventListener('click', () => {
    addNote();
});

const bootstrap = async () => {
    if (!hasToken) return;
    await fetchStats();
    document.getElementById('admin-name').innerText = localStorage.getItem(ADMIN_USERNAME_KEY) || localStorage.getItem('username') || 'Admin';
};

bootstrap();
