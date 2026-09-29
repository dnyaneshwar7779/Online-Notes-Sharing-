const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const multer = require('multer');
const fs = require('fs');
const pdfParseModule = require('pdf-parse');

// Multer Setup
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/online-notes', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));


const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('./middleware/auth');
const User = require('./models/User');
const Note = require('./models/Note');
const Review = require('./models/Review');
const adminAuth = require('./middleware/admin');

// --- API Routes ---

// Post Review (Any authenticated user)
app.post('/api/reviews', auth, async (req, res) => {
    try {
        const { noteId, rating, comment } = req.body;
        const review = new Review({
            note: noteId,
            user: req.user.id,
            rating,
            comment
        });
        await review.save();
        res.json(review);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get Reviews for Note (Only visible ones)
app.get('/api/reviews/:noteId', async (req, res) => {
    try {
        const reviews = await Review.find({ note: req.params.noteId, isVisible: true })
            .populate('user', 'username')
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Admin: Approve Review
app.put('/api/admin/reviews/:id/approve', [auth, adminAuth], async (req, res) => {
    try {
        const update = {
            isVisible: true,
            approvedAt: Date.now()
        };
        if (typeof req.body.reply === 'string') {
            update.adminReply = req.body.reply;
        }
        const review = await Review.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!review) return res.status(404).json({ msg: 'Review not found' });
        res.json({ msg: 'Review approved', review });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Register
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ msg: 'User already exists' });

        user = new User({ username, password });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({ token, username: user.username });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        if (user.isBlocked) return res.status(403).json({ msg: 'Account is blocked. Please contact admin.' });

        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: 360000 }, (err, token) => {
            if (err) throw err;
            res.json({ token, username: user.username });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get User Notes
app.get('/api/notes', auth, async (req, res) => {
    try {
        const notes = await Note.find({ owner: req.user.id }).sort({ updatedAt: -1 });
        res.json(notes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Create Note (Manual)
app.post('/api/notes', auth, async (req, res) => {
    try {
        const newNote = new Note({
            title: req.body.title || 'Untitled Note',
            content: req.body.content || '',
            owner: req.user.id,
            isPublic: typeof req.body.isPublic === 'boolean' ? req.body.isPublic : false
        });
        const note = await newNote.save();
        res.json(note);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Import Note (File Upload)
app.post('/api/upload', [auth, upload.single('file')], async (req, res) => {
    const uploadedPath = req.file ? req.file.path : null;

    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        let content = '';
        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(req.file.path);
            const parsePdf = typeof pdfParseModule === 'function'
                ? pdfParseModule
                : pdfParseModule.default;

            if (typeof parsePdf !== 'function') {
                return res.status(500).json({ msg: 'PDF parser is not available on this server.' });
            }

            const data = await parsePdf(dataBuffer);
            content = data.text;
        } else {
            content = fs.readFileSync(req.file.path, 'utf8');
        }

        const newNote = new Note({
            title: req.file.originalname,
            content: content.replace(/\n/g, '<br>'), // Simple line break to HTML
            owner: req.user.id
        });

        const note = await newNote.save();
        res.json(note);

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Failed to import file' });
    } finally {
        // Remove temp upload file regardless of success/failure.
        if (uploadedPath && fs.existsSync(uploadedPath)) {
            fs.unlinkSync(uploadedPath);
        }
    }
});

// Get Notes Shared With User
app.get('/api/notes/shared', auth, async (req, res) => {
    try {
        const notes = await Note.find({
            owner: { $ne: req.user.id },
            $or: [
                { collaborators: req.user.id },
                { isPublic: true }
            ]
        }).sort({ updatedAt: -1 });

        res.json(notes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get Single Note (Public or Owned)
app.get('/api/notes/:id', async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).json({ msg: 'Note not found' });

        // Basic check: if note is public OR if user is owner (needs token check for owner logic strictly, 
        // but for now allowing public read or guest edit on specific shared links if we implemented that)
        // For this MVP, we'll return it. Logic to restrict private notes needs the token.
        res.json(note);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Note not found' });
        res.status(500).send('Server Error');
    }
});

// Update User Note (Owned only)
app.put('/api/notes/:id', auth, async (req, res) => {
    try {
        const note = await Note.findOne({ _id: req.params.id, owner: req.user.id });
        if (!note) return res.status(404).json({ msg: 'Note not found' });

        if (typeof req.body.title === 'string') {
            note.title = req.body.title || 'Untitled Note';
        }

        if (typeof req.body.content === 'string') {
            note.content = req.body.content;
        }

        note.updatedAt = Date.now();
        await note.save();

        res.json(note);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Note not found' });
        res.status(500).send('Server Error');
    }
});

// Delete User Note (Owned only)
app.delete('/api/notes/:id', auth, async (req, res) => {
    try {
        const note = await Note.findOne({ _id: req.params.id, owner: req.user.id });
        if (!note) return res.status(404).json({ msg: 'Note not found' });

        await Note.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Note deleted' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Note not found' });
        res.status(500).send('Server Error');
    }
});

// Update User Note Visibility (Owned only)
app.put('/api/notes/:id/visibility', auth, async (req, res) => {
    try {
        if (typeof req.body.isPublic !== 'boolean') {
            return res.status(400).json({ msg: 'isPublic must be a boolean' });
        }

        const note = await Note.findOne({ _id: req.params.id, owner: req.user.id });
        if (!note) return res.status(404).json({ msg: 'Note not found' });

        note.isPublic = req.body.isPublic;
        note.updatedAt = Date.now();
        await note.save();

        res.json({ msg: `Note is now ${note.isPublic ? 'public' : 'private'}`, note });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Note not found' });
        res.status(500).send('Server Error');
    }
});

// --- Socket.io Logic ---
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join-note', (noteId) => {
        socket.join(noteId);
        console.log(`User joined note: ${noteId}`);
    });

    socket.on('edit-note', async (data) => {
        // Broadcast changes to other users in the same note room
        socket.to(data.noteId).emit('receive-changes', data.content);

        // Database Autosave logic (throttled typically, but direct for MVP)
        if (data.noteId && data.content) {
            try {
                // Determine if noteId is a valid MongoID or a Guest ID
                if (mongoose.Types.ObjectId.isValid(data.noteId)) {
                    await Note.findByIdAndUpdate(data.noteId, {
                        content: data.content,
                        updatedAt: Date.now()
                    });
                }
            } catch (err) {
                console.error("Autosave Error", err);
            }
        }
    });


    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// --- Admin Routes ---

const getAdminStatsData = async () => {
    const [userCount, noteCount, pendingReviews, activeSharingLinks] = await Promise.all([
        User.countDocuments(),
        Note.countDocuments(),
        Review.countDocuments({ isVisible: false }),
        Note.countDocuments({ isPublic: true, isArchived: { $ne: true } })
    ]);

    return {
        userCount,
        noteCount,
        pendingReviews,
        activeSharingLinks,
        premiumUpgradeCount: 0
    };
};

// Admin Stats
app.get('/api/admin/stats', [auth, adminAuth], async (req, res) => {
    try {
        const stats = await getAdminStatsData();
        res.json(stats);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/admin/stats', [auth, adminAuth], async (req, res) => {
    try {
        const stats = await getAdminStatsData();
        res.json(stats);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/admin/approve-review', [auth, adminAuth], async (req, res) => {
    try {
        const { reviewId, reply } = req.body;
        if (!reviewId) return res.status(400).json({ msg: 'reviewId is required' });

        const review = await Review.findByIdAndUpdate(
            reviewId,
            {
                isVisible: true,
                approvedAt: Date.now(),
                adminReply: typeof reply === 'string' ? reply : ''
            },
            { new: true }
        );

        if (!review) return res.status(404).json({ msg: 'Review not found' });
        res.json({ msg: 'Review approved', review });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Admin Users List
app.get('/api/admin/users', [auth, adminAuth], async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Admin Get Pending Reviews
app.get('/api/admin/reviews', [auth, adminAuth], async (req, res) => {
    try {
        const reviews = await Review.find({ isVisible: false })
            .populate('user', 'username')
            .populate('note', 'title')
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/api/admin/reviews/:id/reply', [auth, adminAuth], async (req, res) => {
    try {
        const { reply } = req.body;
        const review = await Review.findByIdAndUpdate(
            req.params.id,
            { adminReply: typeof reply === 'string' ? reply : '' },
            { new: true }
        );
        if (!review) return res.status(404).json({ msg: 'Review not found' });
        res.json({ msg: 'Reply saved', review });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Admin Get All Notes
app.get('/api/admin/notes', [auth, adminAuth], async (req, res) => {
    try {
        const notes = await Note.find().populate('owner', 'username').sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/api/admin/notes', [auth, adminAuth], async (req, res) => {
    try {
        const { title, content, isPublic, isFlagged } = req.body;
        const newNote = new Note({
            title: title || 'Untitled Note',
            content: content || '',
            owner: req.user.id,
            isPublic: Boolean(isPublic),
            isFlagged: Boolean(isFlagged)
        });
        const note = await newNote.save();
        res.json(note);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.put('/api/admin/notes/:id', [auth, adminAuth], async (req, res) => {
    try {
        const { title, content, isPublic, isFlagged } = req.body;
        const updateData = {
            updatedAt: Date.now()
        };

        if (typeof title === 'string') updateData.title = title;
        if (typeof content === 'string') updateData.content = content;
        if (typeof isPublic === 'boolean') updateData.isPublic = isPublic;
        if (typeof isFlagged === 'boolean') updateData.isFlagged = isFlagged;

        const note = await Note.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!note) return res.status(404).json({ msg: 'Note not found' });
        res.json(note);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.put('/api/admin/notes/:id/archive', [auth, adminAuth], async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).json({ msg: 'Note not found' });

        note.isArchived = !note.isArchived;
        note.updatedAt = Date.now();
        await note.save();

        res.json({ msg: `Note ${note.isArchived ? 'archived' : 'unarchived'}`, note });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Admin Delete Note
app.delete('/api/admin/notes/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Note.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Note deleted by admin' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Admin Toggle Block User
app.put('/api/admin/users/:id/toggle-block', [auth, adminAuth], async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        user.isBlocked = !user.isBlocked;
        await user.save();
        res.json({ msg: `User ${user.isBlocked ? 'blocked' : 'unblocked'}`, isBlocked: user.isBlocked });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Admin Reset Password
app.put('/api/admin/users/:id/reset-password', [auth, adminAuth], async (req, res) => {
    try {
        const { newPassword } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        res.json({ msg: 'Password reset successful' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Admin Delete Review
app.delete('/api/admin/reviews/:id', [auth, adminAuth], async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Review deleted by admin' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/api/admin/history', [auth, adminAuth], async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [recentNotes, recentReviews, recentUsers] = await Promise.all([
            Note.find().populate('owner', 'username').sort({ createdAt: -1 }).limit(15),
            Review.find().populate('user', 'username').sort({ createdAt: -1 }).limit(15),
            User.find().sort({ createdAt: -1 }).limit(15)
        ]);

        const history = [
            ...recentNotes.map((note) => ({
                event: `Note created: ${note.title || 'Untitled Note'}`,
                actor: note.owner ? note.owner.username : 'Unknown',
                type: 'Note',
                date: note.createdAt
            })),
            ...recentReviews.map((review) => ({
                event: `Review submitted (${review.rating}/5)` ,
                actor: review.user ? review.user.username : 'Unknown',
                type: 'Review',
                date: review.createdAt
            })),
            ...recentUsers.map((user) => ({
                event: `User registered: ${user.username}`,
                actor: user.username,
                type: 'User',
                date: user.createdAt
            }))
        ]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 25);

        const usageEventsLast7Days = history.filter((item) => new Date(item.date) >= sevenDaysAgo).length;

        res.json({
            premiumUpgradeCount: 0,
            usageEventsLast7Days,
            history
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
