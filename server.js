// server.js
require("dotenv").config();
require("dotenv").config();
console.log("Server is trying to connect to:", process.env.MONGODB_URI);
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

// ===== MongoDB Connection =====
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ===== Schemas =====
const teacherSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});

const studentSchema = new mongoose.Schema({
  roll: Number,
  name: String,
  className: String,
});

const attendanceSchema = new mongoose.Schema({
  date: String, // YYYY-MM-DD
  className: String,
  entries: [
    {
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      present: Boolean,
      remarks: String,
    },
  ],
});

const Teacher = mongoose.model("Teacher", teacherSchema);
const Student = mongoose.model("Student", studentSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ===== Middleware =====
function auth(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.teacherId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// ===== Routes =====

// Register teacher
app.post("/auth/register-teacher", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const teacher = await Teacher.create({ name, email, password: hashed });
    res.json({ teacher });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Login

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const teacher = await Teacher.findOne({ email });

    if (!teacher) {
      // This helps confirm if the user even exists
      return res.status(400).json({ message: "Invalid credentials (email not found)" });
    }

    // The error is likely happening here if the password in the DB isn't a hash
    const valid = await bcrypt.compare(password, teacher.password);
    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials (password incorrect)" });
    }

    const token = jwt.sign({ id: teacher._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, teacher: { id: teacher._id, name: teacher.name, email: teacher.email } });

  } catch (err) {
    // This will print the REAL error to your server's terminal!
    console.error("💥 LOGIN FAILED:", err); 
    res.status(500).json({ message: "An internal server error occurred." });
  }
});

// Add/Update students (bulk)
app.post("/students", auth, async (req, res) => {
  const { students } = req.body;
  try {
    const ops = students.map((s) => ({
      updateOne: {
        filter: { className: s.className, roll: s.roll },
        update: { $set: s },
        upsert: true,
      },
    }));
    await Student.bulkWrite(ops);
    res.json({ message: "Students saved" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get students by class
app.get("/students", auth, async (req, res) => {
  const { className } = req.query;
  const students = await Student.find(className ? { className } : {});
  res.json(students);
});

// Mark attendance
app.post("/attendance/mark", auth, async (req, res) => {
  const { date, className, entries } = req.body;
  try {
    await Attendance.findOneAndUpdate(
      { date, className },
      { date, className, entries },
      { upsert: true }
    );
    res.json({ message: "Attendance saved" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get attendance summary (reports)
app.get("/reports/summary", auth, async (req, res) => {
  const { className, from, to } = req.query;
  try {
    const records = await Attendance.find({
      className,
      date: { $gte: from, $lte: to },
    }).populate("entries.studentId");

    const days = records.length;
    const studentStats = {};

    records.forEach((rec) => {
      rec.entries.forEach((e) => {
        if (!studentStats[e.studentId]) {
          studentStats[e.studentId] = { present: 0, total: 0 };
        }
        if (e.present) studentStats[e.studentId].present++;
        studentStats[e.studentId].total++;
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

    res.json({ average, perfectCount, below75Count, days });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Dev route: seed demo teacher + students
app.post("/dev/seed", async (req, res) => {
  try {
    await Teacher.deleteMany({});
    await Student.deleteMany({});
    await Attendance.deleteMany({});

    const hashed = await bcrypt.hash("teacher@demo.com", 10);
    const teacher = await Teacher.create({
      name: "Demo Teacher",
      email: "teacher@demo.com",
      password: hashed,
    });

    const students = [
      { roll: 1, name: "Aarav Kumar", className: "Class 5-A" },
      { roll: 2, name: "Ishita Sharma", className: "Class 5-A" },
      { roll: 3, name: "Vihaan Gupta", className: "Class 5-A" },
    ];
    await Student.insertMany(students);

    res.json({ message: "Seeded demo data", teacher });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== Start server =====
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
