const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { sql, poolPromise } = require('./db');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for profile images
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// -------------------- REGISTER --------------------
app.post('/register', upload.single('profileImage'), async (req, res) => {
    const { firstname, lastname, rollno, password } = req.body;
    const profileImage = req.file ? req.file.filename : null;

    if (!profileImage) return res.send('Please upload a profile image!');

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('firstname', sql.NVarChar, firstname)
            .input('lastname', sql.NVarChar, lastname)
            .input('rollno', sql.NVarChar, rollno)
            .input('password', sql.NVarChar, password)
            .input('profile_image', sql.NVarChar, profileImage)
            .query(`INSERT INTO Stdsdata (firstname, lastname, rollno, password, profile_image)
                    VALUES (@firstname, @lastname, @rollno, @password, @profile_image)`);

        console.log('✅ Registration Successful:', firstname);

        res.redirect('/login.html'); // After register → login page
    } catch (err) {
        console.log('❌ Register Error:', err);
        res.send('Roll No already exists or some error occurred.');
    }
});

// -------------------- LOGIN --------------------
app.post('/login', async (req, res) => {
    const { rollno, password } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('rollno', sql.NVarChar, rollno)
            .input('password', sql.NVarChar, password)
            .query('SELECT * FROM Stdsdata WHERE rollno=@rollno AND password=@password');

        if (result.recordset.length > 0) {
            const student = result.recordset[0];
            res.redirect(`/dashboard.html?user_id=${student.id}`);
        } else {
            res.send('❌ Invalid Login');
        }
    } catch (err) {
        console.log('❌ Login Error:', err);
        res.send('Error during login');
    }
});

// -------------------- DASHBOARD --------------------
app.get('/dashboard.html', async (req, res) => {
    const user_id = req.query.user_id;
    if (!user_id) return res.send('User not found');

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('user_id', sql.Int, user_id)
            .query('SELECT firstname, lastname, rollno, profile_image FROM Stdsdata WHERE id=@user_id');

        if (result.recordset.length === 0) return res.send('User not found');

        const student = result.recordset[0];
        const showUploadForm = !student.profile_image;

        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <div class="portal-header">Student Service Portal</div>
            <div class="container dashboard-container">
                <h1>Welcome ${student.firstname} ${student.lastname}</h1>
                <p>Roll No: ${student.rollno}</p>

                <div style="margin:20px 0;">
                    <img src="${student.profile_image ? '/uploads/' + student.profile_image : '/uploads/default.png'}"
                        style="width:150px; height:150px; border-radius:50%; object-fit:cover; box-shadow:0 5px 15px rgba(0,0,0,0.3);">
                </div>

                ${showUploadForm ? `
                <form action="/upload-profile" method="POST" enctype="multipart/form-data">
                    <input type="hidden" name="user_id" value="${student.id}">
                    <input type="file" name="profileImage" accept="image/*" required><br><br>
                    <button type="submit">Upload Profile Image</button>
                </form>` : `
                <p style="color:green; font-weight:bold;">Profile Image uploaded successfully ✅</p>`}
            </div>
        </body>
        </html>
        `);
    } catch (err) {
        console.log('Dashboard Error:', err);
        res.send('Error loading dashboard');
    }
});

// -------------------- UPLOAD PROFILE IMAGE --------------------
app.post('/upload-profile', upload.single('profileImage'), async (req, res) => {
    const { user_id } = req.body;
    if (!req.file) return res.send('No file uploaded!');

    const imagePath = req.file.filename;

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('user_id', sql.Int, user_id)
            .input('image_path', sql.NVarChar, imagePath)
            .query('UPDATE Stdsdata SET profile_image=@image_path WHERE id=@user_id');

        console.log('✅ Profile Image Uploaded:', imagePath);
        res.redirect(`/dashboard.html?user_id=${user_id}`);
    } catch (err) {
        console.log('Image Upload Error:', err);
        res.send('Error uploading image');
    }
});

// API to get student data dynamically
app.get('/api/student/:id', async (req, res) => {
    const user_id = req.params.id;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('user_id', sql.Int, user_id)
            .query('SELECT id, firstname, lastname, rollno, profile_image FROM Stdsdata WHERE id=@user_id');

        if (result.recordset.length === 0) return res.status(404).json({ error: 'User not found' });

        res.json(result.recordset[0]);
    } catch (err) {
        console.log('API Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});
// -------------------- START SERVER --------------------
app.listen(3000, () => console.log('Server running on http://localhost:3000'));