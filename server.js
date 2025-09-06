// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// Provide default values if environment variables are missing
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/attendance_system";
const JWT_SECRET = process.env.JWT_SECRET || "your_default_jwt_secret_key_here";

console.log("Server is trying to connect to:", MONGODB_URI);

// ===== MongoDB Connection =====
mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    console.log("Please make sure MongoDB is running on your system");
  });

// ===== Schemas =====
const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  employeeId: { type: String, default: "TCH2024001" },
  phone: { type: String, default: "+91 98765xxxx" },
  school: { type: String, default: "Government Primary School, Jaipur" },
  subjects: { type: [String], default: ["Mathematics", "Science"] },
  classes: { type: [String], default: ["Class 5-A", "Class 6-B"] },
  joinDate: { type: String, default: "15 July 2020" }
});

const studentSchema = new mongoose.Schema({
  roll: { type: Number, required: true },
  name: { type: String, required: true },
  className: { type: String, required: true },
  parentPhone: { type: String, default: "+91 98765xxxx" }
});

const attendanceSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  className: { type: String, required: true },
  entries: [
    {
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
      present: { type: Boolean, required: true },
      remarks: { type: String, default: "" },
    },
  ],
}, { timestamps: true });

// Create compound index to prevent duplicate attendance records
attendanceSchema.index({ date: 1, className: 1 }, { unique: true });

const Teacher = mongoose.model("Teacher", teacherSchema);
const Student = mongoose.model("Student", studentSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ===== Middleware =====
function auth(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "No authorization header provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.teacherId = decoded.id;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// ===== Routes =====

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "Attendance System API is running!", 
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /dev/seed - Seed demo data",
      "POST /auth/login - Login teacher",
      "GET /students - Get students by class",
      "POST /attendance/mark - Mark attendance",
      "GET /reports/summary - Get attendance reports"
    ]
  });
});

// Register teacher
app.post("/auth/register-teacher", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ message: "Teacher with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 12);
    const teacher = await Teacher.create({ name, email, password: hashed });
    
    // Remove password from response
    const { password: _, ...teacherResponse } = teacher.toObject();
    
    res.status(201).json({ 
      message: "Teacher registered successfully",
      teacher: teacherResponse 
    });
  } catch (err) {
    console.error("Register error:", err);
    if (err.code === 11000) {
      res.status(400).json({ message: "Teacher with this email already exists" });
    } else {
      res.status(500).json({ message: "Registration failed", error: err.message });
    }
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    console.log("Login attempt for:", email);

    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      console.log("Teacher not found with email:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    console.log("Teacher found, checking password...");
    
    const valid = await bcrypt.compare(password, teacher.password);
    if (!valid) {
      console.log("Password validation failed");
      return res.status(400).json({ message: "Invalid email or password" });
    }

    console.log("Password valid, generating token...");

    const token = jwt.sign({ id: teacher._id }, JWT_SECRET, { expiresIn: "24h" });
    
    // Remove password from response
    const { password: _, ...teacherData } = teacher.toObject();
    
    console.log("Login successful for:", email);
    
    res.json({ 
      message: "Login successful",
      token, 
      teacher: teacherData 
    });

  } catch (err) {
    console.error("🔥 LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// Add/Update students (bulk)
app.post("/students", auth, async (req, res) => {
  try {
    const { students } = req.body;
    
    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ message: "Students array is required" });
    }

    const ops = students.map((s) => ({
      updateOne: {
        filter: { className: s.className, roll: s.roll },
        update: { $set: s },
        upsert: true,
      },
    }));
    
    const result = await Student.bulkWrite(ops);
    res.json({ 
      message: "Students saved successfully",
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount
    });
  } catch (err) {
    console.error("Students save error:", err);
    res.status(500).json({ message: "Failed to save students", error: err.message });
  }
});

// Get students by class
app.get("/students", auth, async (req, res) => {
  try {
    const { className } = req.query;
    const query = className ? { className } : {};
    
    const students = await Student.find(query).sort({ roll: 1 });
    res.json(students);
  } catch (err) {
    console.error("Get students error:", err);
    res.status(500).json({ message: "Failed to get students", error: err.message });
  }
});

// Mark attendance
app.post("/attendance/mark", auth, async (req, res) => {
  try {
    const { date, className, entries } = req.body;
    
    if (!date || !className || !entries) {
      return res.status(400).json({ message: "Date, className and entries are required" });
    }

    console.log("Marking attendance for:", { date, className, entriesCount: entries.length });

    // Validate entries
    for (let entry of entries) {
      if (!entry.studentId || typeof entry.present !== 'boolean') {
        return res.status(400).json({ message: "Invalid entry format" });
      }
    }

    const result = await Attendance.findOneAndUpdate(
      { date, className },
      { date, className, entries },
      { upsert: true, new: true }
    );

    console.log("Attendance marked successfully");
    res.json({ 
      message: "Attendance saved successfully",
      attendanceId: result._id
    });
  } catch (err) {
    console.error("Mark attendance error:", err);
    res.status(500).json({ message: "Failed to mark attendance", error: err.message });
  }
});

// Get attendance summary (reports)
app.get("/reports/summary", auth, async (req, res) => {
  try {
    const { className, from, to } = req.query;
    
    if (!className || !from || !to) {
      return res.status(400).json({ message: "className, from and to dates are required" });
    }

    console.log("Generating report for:", { className, from, to });

    const records = await Attendance.find({
      className,
      date: { $gte: from, $lte: to },
    }).populate("entries.studentId");

    const days = records.length;
    const studentStats = {};

    records.forEach((rec) => {
      rec.entries.forEach((e) => {
        const studentId = e.studentId._id.toString();
        if (!studentStats[studentId]) {
          studentStats[studentId] = { 
            name: e.studentId.name,
            present: 0, 
            total: 0 
          };
        }
        if (e.present) studentStats[studentId].present++;
        studentStats[studentId].total++;
      });
    });

    const totalPresent = Object.values(studentStats).reduce((a, s) => a + s.present, 0);
    const total = Object.values(studentStats).reduce((a, s) => a + s.total, 0);
    const average = total > 0 ? ((totalPresent / total) * 100).toFixed(1) : 0;

    const perfectCount = Object.values(studentStats).filter(
      (s) => s.present === s.total && s.total > 0
    ).length;

    const below75Count = Object.values(studentStats).filter(
      (s) => s.total > 0 && (s.present / s.total) * 100 < 75
    ).length;

    const chronicAbsenceCount = Object.values(studentStats).filter(
      (s) => s.total > 0 && (s.present / s.total) * 100 < 50
    ).length;

    console.log("Report generated successfully");
    res.json({ 
      average: parseFloat(average), 
      perfectCount, 
      below75Count, 
      chronicAbsenceCount,
      days,
      totalStudentsTracked: Object.keys(studentStats).length
    });
  } catch (err) {
    console.error("Report generation error:", err);
    res.status(500).json({ message: "Failed to generate report", error: err.message });
  }
});

// Dev route: seed demo teacher + students
app.post("/dev/seed", async (req, res) => {
  try {
    console.log("🌱 Seeding demo data...");
    
    // Clear existing data
    await Teacher.deleteMany({});
    await Student.deleteMany({});
    await Attendance.deleteMany({});

    // Create demo teacher with the SAME password as the email for simplicity
    const demoPassword = "teacher@demo.com";
    const hashed = await bcrypt.hash(demoPassword, 12);
    
    const teacher = await Teacher.create({
      name: "Demo Teacher",
      email: "teacher@demo.com",
      password: hashed,
      employeeId: "TCH2024001"
    });

    // Create demo students
    const students = [
      { roll: 1, name: "Aarav Kumar", className: "Class 5-A" },
      { roll: 2, name: "Diya Patel", className: "Class 5-A" },
      { roll: 3, name: "Arjun Singh", className: "Class 5-A" },
      { roll: 4, name: "Ananya Sharma", className: "Class 5-A" },
      { roll: 5, name: "Kabir Verma", className: "Class 5-A" },
      { roll: 6, name: "Zara Khan", className: "Class 5-A" },
      { roll: 7, name: "Vivaan Reddy", className: "Class 5-A" },
      { roll: 8, name: "Ishita Gupta", className: "Class 5-A" },
      { roll: 9, name: "Aditya Mehta", className: "Class 5-A" },
      { roll: 10, name: "Sara Ali", className: "Class 5-A" },
      
      { roll: 1, name: "Rohan Joshi", className: "Class 6-B" },
      { roll: 2, name: "Priya Nair", className: "Class 6-B" },
      { roll: 3, name: "Yash Pandey", className: "Class 6-B" },
      { roll: 4, name: "Kavya Rao", className: "Class 6-B" },
      { roll: 5, name: "Om Prakash", className: "Class 6-B" },
    ];
    
    await Student.insertMany(students);

    console.log("✅ Demo data seeded successfully!");
    console.log("📧 Demo login: teacher@demo.com");
    console.log("🔑 Demo password: teacher@demo.com");

    res.json({ 
      message: "Demo data seeded successfully",
      teacher: {
        name: teacher.name,
        email: teacher.email,
        id: teacher._id
      },
      studentsCreated: students.length,
      credentials: {
        email: "teacher@demo.com",
        password: "teacher@demo.com"
      }
    });
  } catch (err) {
    console.error("Seed error:", err);
    res.status(500).json({ message: "Failed to seed demo data", error: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Something went wrong!", error: err.message });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// ===== Start server =====
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Visit http://localhost:${PORT} for API info`);
  console.log(`🌱 POST to /dev/seed to create demo data`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});