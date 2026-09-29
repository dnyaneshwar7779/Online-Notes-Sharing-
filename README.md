# Online Notes Sharing System

A real-time collaborative notes sharing application built with Node.js, Express, MongoDB, and Socket.io.

## Features

- **User Authentication:** Secure registration and login using JWT and bcrypt.
- **Real-Time Collaboration:** Powered by Socket.io for live updates.
- **Note Management:** Create, read, update, and delete notes.
- **File Uploads:** Support for file attachments to notes, including PDF parsing.
- **Admin Dashboard:** Seed script provided for admin user setup.
- **Responsive Frontend:** Built with vanilla HTML/CSS/JS in the `public` folder.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Real-time:** Socket.io
- **Authentication:** JSON Web Tokens (JWT)
- **File Uploads:** Multer, pdf-parse

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- [MongoDB](https://www.mongodb.com/) running locally or a MongoDB Atlas URI

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dnyaneshwar7779/Online-Notes-Sharing-.git
   cd Online-Notes-Sharing-
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add the following values:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/online-notes
   JWT_SECRET=your_jwt_secret_here
   ADMIN_TOKEN=your_admin_token_here
   ```

4. **Seed the Admin User (Optional):**
   ```bash
   npm run seed:admin
   ```

5. **Start the Server:**
   ```bash
   npm run dev
   ```
   The server will start on `http://localhost:5000`.

## Scripts

- `npm start`: Starts the application using Node.
- `npm run dev`: Starts the application in development mode using Nodemon.
- `npm run seed:admin`: Runs the script to create an initial admin user in the database.

## License
MIT
