const userGreeting = document.getElementById('user-greeting');
const logoutBtn = document.getElementById('logout-btn');
const settingsLogoutBtn = document.getElementById('settings-logout-btn');
const newNoteBtn = document.getElementById('new-note-btn');
const notesGrid = document.getElementById('notes-grid');
const noteSearch = document.getElementById('note-search');
const sortTitleBtn = document.getElementById('sort-title-btn');
const sortUpdatedBtn = document.getElementById('sort-updated-btn');
const notesActions = document.getElementById('notes-actions');
const notesSearchWrap = document.getElementById('notes-search-wrap');
const viewTitle = document.getElementById('dashboard-view-title');
const navLinks = Array.from(document.querySelectorAll('.dashboard-nav-link'));
const viewNotes = document.getElementById('view-notes');
const viewSettings = document.getElementById('view-settings');
const settingsUsername = document.getElementById('settings-username');
const settingsThemeToggle = document.getElementById('settings-theme-toggle');
const importBtn = document.getElementById('import-btn');
const fileInput = document.getElementById('file-upload');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileOverlay = document.getElementById('mobile-overlay');
const dashboardSidebar = document.getElementById('dashboard-sidebar');

let allNotes = [];
let activeView = 'notes';
let searchTerm = '';
let sortConfig = {
    key: 'updatedAt',
    direction: 'desc'
};

const USER_TOKEN_KEY = 'user-token';
const USERNAME_KEY = 'user-username';

const token = localStorage.getItem(USER_TOKEN_KEY) || localStorage.getItem('token');
const username = localStorage.getItem(USERNAME_KEY) || localStorage.getItem('username') || 'User';

if (!token) {
    window.location.href = '/login.html';
} else {
    userGreeting.innerText = `Welcome, ${username}`;
    if (settingsUsername) settingsUsername.innerText = username;
}

const logout = () => {
    localStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
};

const openMobileSidebar = () => {
    dashboardSidebar?.classList.remove('-translate-x-full');
    mobileOverlay?.classList.remove('hidden');
};

const closeMobileSidebar = () => {
    dashboardSidebar?.classList.add('-translate-x-full');
    mobileOverlay?.classList.add('hidden');
};

const updateNavState = (view) => {
    navLinks.forEach((link) => {
        const isActive = link.dataset.view === view;
        link.classList.toggle('bg-gray-100', isActive);
        link.classList.toggle('text-gray-700', isActive);
        link.classList.toggle('dark:bg-gray-700', isActive);
        link.classList.toggle('dark:text-white', isActive);
        link.classList.toggle('text-gray-600', !isActive);
        link.classList.toggle('dark:text-gray-300', !isActive);
    });
};

const setActiveView = async (view) => {
    activeView = view;
    updateNavState(view);

    viewNotes?.classList.toggle('hidden', view !== 'notes');
    viewSettings?.classList.toggle('hidden', view !== 'settings');

    const showNotesControls = view === 'notes';
    notesActions?.classList.toggle('hidden', !showNotesControls);
    notesSearchWrap?.classList.toggle('hidden', !showNotesControls);

    if (viewTitle) {
        if (view === 'notes') viewTitle.innerText = 'My Notes';
        if (view === 'settings') viewTitle.innerText = 'Settings';
    }

    closeMobileSidebar();
};

const updateSortButtonState = () => {
    const titleActive = sortConfig.key === 'title';
    const updatedActive = sortConfig.key === 'updatedAt';

    sortTitleBtn?.classList.toggle('underline', titleActive);
    sortUpdatedBtn?.classList.toggle('underline', updatedActive);
};

const applyFiltersAndSort = () => {
    const filtered = allNotes.filter((note) => {
        if (!searchTerm) return true;
        return (note.title || '').toLowerCase().includes(searchTerm)
            || (note.content || '').toLowerCase().includes(searchTerm);
    });

    const sorted = [...filtered].sort((a, b) => {
        if (sortConfig.key === 'title') {
            const aTitle = (a.title || '').toLowerCase();
            const bTitle = (b.title || '').toLowerCase();
            return sortConfig.direction === 'asc'
                ? aTitle.localeCompare(bTitle)
                : bTitle.localeCompare(aTitle);
        }

        const aUpdated = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bUpdated = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return sortConfig.direction === 'asc' ? aUpdated - bUpdated : bUpdated - aUpdated;
    });

    updateSortButtonState();
    renderNotes(sorted);
};

const renderNotes = (notes) => {
    notesGrid.innerHTML = '';
    if (!notes.length) {
        notesGrid.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No notes found.</p>';
        return;
    }

    notes.forEach((note) => {
        const plainContent = (note.content || '').replace(/<[^>]*>/g, '');
        const noteEl = document.createElement('div');
        noteEl.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer';
        noteEl.innerHTML = `
            <div onclick="window.location.href='/?note=${note._id}'">
                <h3 class="text-xl font-bold mb-2 dark:text-white">${note.title || 'Untitled Note'}</h3>
                <p class="text-gray-600 dark:text-gray-300 truncate">${plainContent.substring(0, 100)}...</p>
                <div class="mt-4 text-xs text-gray-400">Updated: ${new Date(note.updatedAt).toLocaleDateString()}</div>
            </div>
            <div class="mt-4 flex justify-end space-x-2 border-t border-gray-200 dark:border-gray-700 pt-2">
                <button class="text-red-500 hover:underline text-sm" onclick="event.stopPropagation(); deleteNote('${note._id}')">Delete</button>
            </div>
        `;
        notesGrid.appendChild(noteEl);
    });
};

window.deleteNote = async (noteId) => {
    if (!confirm('Delete this note permanently?')) return;

    try {
        const res = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE',
            headers: { Authorization: token }
        });

        if (res.ok) {
            allNotes = allNotes.filter((note) => note._id !== noteId);
            applyFiltersAndSort();
            return;
        }

        const data = await res.json().catch(() => ({}));
        alert(data.msg || 'Failed to delete note');
    } catch (err) {
        console.error(err);
        alert('Error deleting note');
    }
};

const fetchNotes = async () => {
    try {
        const res = await fetch('/api/notes', {
            headers: { Authorization: token }
        });
        const notes = await res.json();
        if (res.ok) {
            allNotes = notes;
            applyFiltersAndSort();
        }
    } catch (err) {
        console.error(err);
    }
};

newNoteBtn?.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/notes', {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: 'New Note', content: '' })
        });

        const note = await res.json();
        if (res.ok) {
            window.location.href = `/?note=${note._id}`;
        } else {
            alert('Failed to create note');
        }
    } catch (err) {
        console.error(err);
    }
});

importBtn?.addEventListener('click', () => {
    fileInput?.click();
});

fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { Authorization: token },
            body: formData
        });

        const data = await res.json();
        if (res.ok) {
            alert('File imported successfully!');
            fetchNotes();
        } else {
            alert(data.msg || 'Upload failed');
        }
    } catch (err) {
        console.error(err);
        alert('Error uploading file');
    }
});

noteSearch?.addEventListener('input', (event) => {
    searchTerm = event.target.value.toLowerCase().trim();
    applyFiltersAndSort();
});

sortTitleBtn?.addEventListener('click', () => {
    if (sortConfig.key === 'title') {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig = { key: 'title', direction: 'asc' };
    }
    applyFiltersAndSort();
});

sortUpdatedBtn?.addEventListener('click', () => {
    if (sortConfig.key === 'updatedAt') {
        sortConfig.direction = sortConfig.direction === 'desc' ? 'asc' : 'desc';
    } else {
        sortConfig = { key: 'updatedAt', direction: 'desc' };
    }
    applyFiltersAndSort();
});

navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        setActiveView(link.dataset.view);
    });
});

mobileMenuBtn?.addEventListener('click', openMobileSidebar);
mobileOverlay?.addEventListener('click', closeMobileSidebar);

logoutBtn?.addEventListener('click', logout);
settingsLogoutBtn?.addEventListener('click', logout);

settingsThemeToggle?.addEventListener('click', () => {
    document.getElementById('theme-toggle')?.click();
});

fetchNotes();
setActiveView('notes');
