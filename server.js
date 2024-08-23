const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken'); // Include jwt

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB with error handling
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1); // Exit process with failure
    });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Define Course Schema
const courseSchema = new mongoose.Schema({
    courseName: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    videoPreview: { type: String, required: true },
    fullVideo: { type: String, required: true },
});

const Course = mongoose.model('Course', courseSchema);

// Set up multer for file uploads with file type validation
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/mpeg'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 }, // Limit file size to 100MB
});

// Upload course route
app.post('/courses', upload.fields([
    { name: 'videoPreview', maxCount: 1 }, 
    { name: 'fullVideo', maxCount: 1 }
]), async (req, res) => {
    const { courseName, description, price } = req.body;
    const videoPreview = req.files['videoPreview'] ? req.files['videoPreview'][0] : null;
    const fullVideo = req.files['fullVideo'] ? req.files['fullVideo'][0] : null;

    if (!courseName || !description || !price || !videoPreview || !fullVideo) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const newCourse = new Course({
            courseName,
            description,
            price,
            videoPreview: `${req.protocol}://${req.get('host')}/uploads/${videoPreview.filename}`,
            fullVideo: `${req.protocol}://${req.get('host')}/uploads/${fullVideo.filename}`,
        });

        await newCourse.save();
        res.status(201).json({ message: 'Upload successful!', course: newCourse });
    } catch (error) {
        console.error('Error saving course:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all courses
app.get('/courses', async (req, res) => {
    try {
        const courses = await Course.find();
        res.status(200).json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a specific course by ID
app.get('/courses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        res.status(200).json(course);
    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// User schema and model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: {
        type: String,
        required: true,
        unique: true, // Ensures email addresses are unique
        lowercase: true, // Convert email to lowercase to ensure uniqueness
    },
    password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Register route
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const user = new User({ username, email, password });
        await user.save();
        res.status(201).send('User registered successfully');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Error registering user');
    }
});

// Login route
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email, password });

        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user._id }, 'yourSecretKey', { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});



// Define the admin schema
const adminSchema = new mongoose.Schema({
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    }
  });
  
  // Hash the password before saving the admin
  adminSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
    next();
  });
  
  adminSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
  };
  app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      const admin = await Admin.findOne({ username });
      if (!admin) {
        console.log('Admin not found');
        return res.status(400).json({ message: 'Invalid credentials' });
      }
  
      console.log('Admin found:', admin);
      const isMatch = await admin.comparePassword(password);
      console.log('Password match result:', isMatch);
  
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
  
      const token = jwt.sign({ id: admin._id, username: admin.username }, jwtSecret, { expiresIn: '1h' });
  
      admin.token = token;
      await admin.save();
  
      res.json({ token });
    } catch (err) {
      console.error('Server error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/admin/login', { username, password });
  
      alert('Admin login successful!');
    } catch (err) {
      setError('Invalid credentials');
    }
  };
  

  // Endpoint to get the token based on the username
app.get('/admin/login', async (req, res) => {
    const { username } = req.query;
  
    try {
      const admin = await Admin.findOne({ username });
      if (!admin || !admin.token) {
        return res.status(400).json({ message: 'Token not found' });
      }
  
      res.json({ token: admin.token });
    } catch (err) {
      console.error('Error fetching token:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
    
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
