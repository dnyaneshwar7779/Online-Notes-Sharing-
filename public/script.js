const socket = io();

// Initialize Quill editor
// Initialize Quill editor with Custom Toolbar
var quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
        toolbar: '#toolbar',
        history: {
            delay: 1000,
            maxStack: 50,
            userOnly: true
        }
    },
    placeholder: 'Start typing to get started...'
});

// Stats Logic
const wordCountEl = document.getElementById('word-count');
const charCountEl = document.getElementById('char-count');
const createdAtEl = document.getElementById('created-at');
const updatedAtEl = document.getElementById('updated-at');
const statsPopup = document.getElementById('stats-popup');
const infoBtn = document.getElementById('info-btn');

// Toggle Stats Popup
if (infoBtn) {
    infoBtn.addEventListener('click', () => {
        statsPopup.classList.toggle('hidden');
    });
}

// Update Stats
const updateStats = () => {
    const text = quill.getText();
    const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
    const chars = text.length - 1; // Subtract 1 for trailing newline

    if (wordCountEl) wordCountEl.textContent = words;
    if (charCountEl) charCountEl.textContent = chars > 0 ? chars : 0;
};

quill.on('text-change', () => {
    updateStats();
    // Update timestamp (simulation)
    if (updatedAtEl) updatedAtEl.textContent = new Date().toLocaleString();
});

// Undo/Redo Handlers
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

if (undoBtn) undoBtn.addEventListener('click', () => quill.history.undo());
if (redoBtn) redoBtn.addEventListener('click', () => quill.history.redo());

// Save Key Button Logic (Maps to Generate Link)
const saveKeyBtn = document.getElementById('save-key-btn');
if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', () => {
        document.getElementById('share-btn').click();
        statsPopup.classList.add('hidden');
    });
}

// Set Initial Timestamps
if (createdAtEl) createdAtEl.textContent = new Date().toLocaleString();
if (updatedAtEl) updatedAtEl.textContent = new Date().toLocaleString();

const titleInput = document.getElementById('note-title');
const saveBtn = document.getElementById('save-btn');
const shareBtn = document.getElementById('share-btn');
const navLinks = document.getElementById('nav-links');
const visibilityToggleBtn = document.getElementById('visibility-toggle-btn');
const visibilityNoteHint = document.getElementById('visibility-note-hint');

const USER_TOKEN_KEY = 'user-token';

// Auth State
const token = localStorage.getItem(USER_TOKEN_KEY) || localStorage.getItem('token');
if (token) {
    navLinks.innerHTML = `
        <a href="/dashboard.html" class="text-gray-600 hover:text-blue-500 mr-4">Dashboard</a>
        <button onclick="localStorage.removeItem('${USER_TOKEN_KEY}'); localStorage.removeItem('user-username'); localStorage.removeItem('token'); localStorage.removeItem('username'); window.location.reload();" class="text-red-500 hover:text-red-600">Logout</button>
    `;
}

// Check for Note ID in URL
const urlParams = new URLSearchParams(window.location.search);
const noteId = urlParams.get('note');

let isCollaborating = false;
let isPublicNote = false;
let titleSaveTimeout = null;

const setVisibilityUi = () => {
    if (!visibilityToggleBtn || !visibilityNoteHint) return;

    if (!token) {
        visibilityToggleBtn.innerText = 'Public Note';
        visibilityToggleBtn.disabled = true;
        visibilityToggleBtn.classList.remove('hover:text-blue-800', 'dark:hover:text-blue-300');
        visibilityToggleBtn.classList.add('cursor-default', 'opacity-90');
        visibilityNoteHint.innerHTML = '(<a href="/register.html" class="text-blue-700 dark:text-blue-400 hover:underline">Register for private notes</a>)';
        return;
    }

    visibilityToggleBtn.disabled = false;
    visibilityToggleBtn.classList.remove('cursor-default', 'opacity-90');
    visibilityToggleBtn.classList.add('hover:text-blue-800', 'dark:hover:text-blue-300');
    visibilityToggleBtn.innerText = isPublicNote ? 'Public Note' : 'Private Note';
    visibilityNoteHint.innerText = isPublicNote ? '(Anyone with the link can view)' : '(Only you can access this note)';
};

setVisibilityUi();

const saveNoteMeta = async () => {
    if (!token || !noteId) return;

    try {
        saveBtn.innerText = 'Saving...';
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: titleInput.value,
                content: quill.root.innerHTML
            })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            alert(data.msg || 'Failed to save note changes');
            saveBtn.innerText = 'Saved';
            return;
        }

        saveBtn.innerText = 'Saved';
        document.title = `${titleInput.value || 'Untitled Note'} - Hyper Notepad`;
    } catch (err) {
        console.error(err);
        saveBtn.innerText = 'Saved';
    }
};

if (noteId) {
    // Load Note from DB
    isCollaborating = true;
    saveBtn.innerText = 'Syncing...';

    // Join Socket Room
    socket.emit('join-note', noteId);

    // Fetch Note Content
    fetch(`/api/notes/${noteId}`)
        .then(res => res.json())
        .then(data => {
            if (data.msg) {
                alert(data.msg);
            } else {
                titleInput.value = data.title;
                quill.root.innerHTML = data.content;
                isPublicNote = Boolean(data.isPublic);
                setVisibilityUi();
                document.title = `${data.title} - Hyper Notepad`;
            }
        })
        .catch(err => console.error(err));

    // Listen for incoming changes
    socket.on('receive-changes', (delta) => {
        // Delta here is just HTML string for MVP simplicity, 
        // ideally should be Quill Delta objects for conflict resolution
        const range = quill.getSelection();
        quill.root.innerHTML = delta;
        if (range) quill.setSelection(range); // Try to restore cursor
    });

    // Share Button - Copy Link
    shareBtn.innerText = 'Copy Link';
    shareBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
    });

    // --- Review Logic ---
    const reviewsContainer = document.getElementById('reviews-container');
    const reviewsList = document.getElementById('reviews-list');
    const submitReviewBtn = document.getElementById('submit-review-btn');

    const escapeHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    reviewsContainer.classList.remove('hidden');

    const fetchReviews = async () => {
        try {
            const res = await fetch(`/api/reviews/${noteId}`);
            const reviews = await res.json();
            reviewsList.innerHTML = '';
            if (reviews.length === 0) {
                reviewsList.innerHTML = '<p class="text-gray-500">No reviews yet.</p>';
            }
            reviews.forEach(review => {
                const adminReply = (review.adminReply || '').trim();
                const div = document.createElement('div');
                div.className = 'border-b pb-2';
                div.innerHTML = `
                    <div class="flex justify-between">
                        <span class="font-bold">${escapeHtml(review.user ? review.user.username : 'Anonymous')}</span>
                        <span class="text-yellow-500">${'★'.repeat(review.rating)}</span>
                    </div>
                    <p class="text-gray-700">${escapeHtml(review.comment || '')}</p>
                    ${adminReply ? `
                        <div class="mt-2 rounded-md bg-blue-50 border border-blue-100 p-2">
                            <p class="text-xs font-semibold text-blue-700">Admin Reply</p>
                            <p class="text-sm text-blue-900">${escapeHtml(adminReply)}</p>
                        </div>
                    ` : ''}
                `;
                reviewsList.appendChild(div);
            });
        } catch (err) {
            console.error(err);
        }
    };

    fetchReviews();

    submitReviewBtn.addEventListener('click', async () => {
        const rating = document.getElementById('review-rating').value;
        const comment = document.getElementById('review-comment').value;

        if (!token) {
            alert('You must be logged in to review.');
            return;
        }

        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({ noteId, rating, comment })
            });

            if (res.ok) {
                alert('Review submitted! It will appear after approval.');
                document.getElementById('review-comment').value = '';
            } else {
                alert('Error submitting review');
            }
        } catch (err) {
            console.error(err);
        }
    });

} else {
    // GUEST MODE - LocalStorage
    const saveToLocal = () => {
        const noteData = {
            title: titleInput.value,
            content: quill.root.innerHTML
        };
        localStorage.setItem('guest-note', JSON.stringify(noteData));
        saveBtn.innerText = 'Saved (Local)';
    };

    const loadFromLocal = () => {
        const savedNote = JSON.parse(localStorage.getItem('guest-note'));
        if (savedNote) {
            titleInput.value = savedNote.title || '';
            quill.root.innerHTML = savedNote.content || '';
        }
    };

    loadFromLocal();

    quill.on('text-change', () => {
        saveBtn.innerText = 'Saving...';
        saveToLocal();
    });

    titleInput.addEventListener('input', saveToLocal);

    // Generate Link (Save Guest Note to DB as Public Note)
    shareBtn.addEventListener('click', async () => {
        if (!confirm('This will make your note public. Continue?')) return;

        try {
            const res = await fetch('/api/notes', { // This endpoint needs to handle public creation without auth if we want true guest sharing
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token || '' // Pass token if logged in
                },
                body: JSON.stringify({
                    title: titleInput.value,
                    content: quill.root.innerHTML,
                    isPublic: isPublicNote
                })
            });

            // Note: If /api/notes requires Auth (which it currently does in server.js), 
            // guests can't share unless we modify server.js to allow anonymous creation 
            // OR we force them to login first. 
            // Let's assume for MVP we might encounter an error here if not logged in.

            if (res.status === 401) {
                alert('Please login to save and share notes!');
                window.location.href = '/login.html';
                return;
            }

            const data = await res.json();
            if (res.ok) {
                window.location.href = `/?note=${data._id}`;
            }
        } catch (err) {
            console.error(err);
            alert('Error generating link');
        }
    });
}

visibilityToggleBtn?.addEventListener('click', async () => {
    if (!token) {
        window.location.href = '/register.html';
        return;
    }

    const nextVisibility = !isPublicNote;

    if (!noteId) {
        isPublicNote = nextVisibility;
        setVisibilityUi();
        return;
    }

    try {
        const res = await fetch(`/api/notes/${noteId}/visibility`, {
            method: 'PUT',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isPublic: nextVisibility })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            alert(errorData.msg || 'Failed to update note visibility');
            return;
        }

        isPublicNote = nextVisibility;
        setVisibilityUi();
    } catch (err) {
        console.error(err);
        alert('Error updating note visibility');
    }
});

// Socket Emit on Change (if collaborating)
if (isCollaborating) {
    quill.on('text-change', (delta, oldDelta, source) => {
        if (source === 'user') {
            socket.emit('edit-note', {
                noteId,
                content: quill.root.innerHTML
            });
            saveBtn.innerText = 'Syncing...';

            // Debounce Text Change for "Saved" state visual
            clearTimeout(window.saveTimeout);
            window.saveTimeout = setTimeout(() => {
                saveBtn.innerText = 'Saved';
            }, 1000);
        }
    });

    titleInput.addEventListener('input', () => {
        clearTimeout(titleSaveTimeout);
        titleSaveTimeout = setTimeout(() => {
            saveNoteMeta();
        }, 600);
    });

    saveBtn.addEventListener('click', () => {
        saveNoteMeta();
    });
}
