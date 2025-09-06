# 🎯 Complete Setup Guide - Automated Attendance System

## Prerequisites
- **Node.js** (v14 or higher) - Download from [nodejs.org](https://nodejs.org/)
- **MongoDB** - Either local installation OR MongoDB Atlas (cloud)
- **Code Editor** (VS Code recommended)

## 📋 Step-by-Step Setup

### 1. Install MongoDB (Choose ONE option)

#### Option A: Local MongoDB Installation
- **Windows**: Download from [MongoDB Community Server](https://www.mongodb.com/try/download/community)
- **macOS**: `brew install mongodb/brew/mongodb-community`
- **Linux**: Follow [official instructions](https://docs.mongodb.com/manual/administration/install-on-linux/)

#### Option B: MongoDB Atlas (Cloud - Easier)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account
3. Create new cluster (free tier)
4. Get connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/attendance_system`)

### 2. Setup Project Files

Create a new folder for your project and save these files:

```
attendance-system/
├── server.js          (Backend server - use the fixed version I provided)
├── .env               (Environment variables)
├── package.json       (Node.js dependencies)
├── project.html       (Homepage)
├── teacherloginpage.html (Login page - use fixed version)
├── attendance.html    (Dashboard - use fixed version)
└── README.md
```

### 3. Create package.json

Create `package.json` with this content:

```json
{
  "name": "attendance-system",
  "version": "1.0.0",
  "description": "Automated attendance system for rural schools",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^7.0.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

### 4. Create .env File

Create `.env` file (use the template I provided above):

```bash
MONGODB_URI=mongodb://localhost:27017/attendance_system
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
PORT=4000
```

### 5. Install Dependencies

Open terminal/command prompt in your project folder and run:

```bash
npm install
```

This will install all required packages.

### 6. Start MongoDB

#### If using Local MongoDB:
- **Windows**: MongoDB should auto-start, or run `mongod` in terminal
- **macOS/Linux**: Run `sudo systemctl start mongod` or `brew services start mongodb/brew/mongodb-community`

#### If using MongoDB Atlas:
- No action needed, it's already running in the cloud

### 7. Start the Server

```bash
npm start
```

You should see:
```
🚀 Server running on http://localhost:4000
✅ MongoDB connected successfully
```

### 8. Seed Demo Data

Open another terminal and run:

```bash
curl -X POST http://localhost:4000/dev/seed
```

Or visit `http://localhost:4000/dev/seed` in your browser.

This creates:
- Demo teacher account: `teacher@demo.com` / `teacher@demo.com`
- Sample students in Class 5-A and Class 6-B

### 9. Test the System

1. Open `project.html` in your browser
2. Click "Teacher Login" 
3. Use credentials: `teacher@demo.com` / `teacher@demo.com`
4. You should be redirected to the attendance dashboard

## 🔧 Common Issues & Solutions

### MongoDB Connection Failed
```
❌ MongoDB connection error: connect ECONNREFUSED
```
**Solution**: Make sure MongoDB is running on your system

### Port Already in Use
```
Error: listen EADDRINUSE :::4000
```
**Solution**: Change PORT in `.env` file to 3000 or 5000

### Login Not Working
1. Make sure you've seeded demo data first
2. Check browser console for errors (F12)
3. Verify server is running on port 4000

### CORS Errors
**Solution**: Make sure your HTML files are served from the same domain or use a local server like Live Server extension in VS Code

## 📱 Usage Instructions

### For Teachers:
1. **Login**: Use demo credentials or register new teacher
2. **Mark Attendance**: 
   - Select class from dropdown
   - Choose date
   - Mark students present/absent
   - Add optional remarks
   - Submit attendance
3. **View Reports**:
   - Select class and date range
   - Generate summary reports
   - View attendance statistics

### For Administrators:
- Use the `/dev/seed` endpoint to reset demo data
- Check server logs for debugging
- Monitor MongoDB for data integrity

## 🚀 Production Deployment

### Environment Variables for Production:
```bash
MONGODB_URI=your_production_mongodb_url
JWT_SECRET=very_secure_random_string_here
PORT=80
NODE_ENV=production
```

### Security Considerations:
- Change default JWT_SECRET
- Use HTTPS in production
- Implement rate limiting
- Add input validation
- Use environment-specific MongoDB databases

## 📝 API Endpoints

- `POST /dev/seed` - Create demo data
- `POST /auth/login` - Teacher login
- `GET /students?className=Class%205-A` - Get students by class
- `POST /attendance/mark` - Submit attendance
- `GET /reports/summary` - Get attendance reports

## 🛠️ Development Tips

- Use `nodemon` for auto-restart during development: `npm install -g nodemon && nodemon server.js`
- Check browser console (F12) for JavaScript errors
- Use Postman or curl to test API endpoints directly
- MongoDB Compass is useful for viewing database contents

## 💡 Next Steps

1. Add student management (add/edit/delete students)
2. Implement parent SMS notifications
3. Add data export functionality
4. Create admin dashboard
5. Add offline capability with service workers
6. Implement proper user roles and permissions
