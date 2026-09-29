const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/online-notes';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const username = 'admin';
        const plainPassword = 'Admin@123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const existing = await User.findOne({ username });
        if (existing) {
            existing.role = 'admin';
            existing.isBlocked = false;
            existing.password = hashedPassword;
            await existing.save();
            console.log('Updated existing admin account.');
        } else {
            await User.create({
                username,
                password: hashedPassword,
                role: 'admin',
                isBlocked: false
            });
            console.log('Created new admin account.');
        }

        console.log('Admin credentials:');
        console.log('username: admin');
        console.log('password: Admin@123');
        process.exit(0);
    } catch (error) {
        console.error('Failed to seed admin:', error.message);
        process.exit(1);
    }
})();
