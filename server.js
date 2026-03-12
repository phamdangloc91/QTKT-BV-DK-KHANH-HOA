require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGO_URI;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const CLIENT_ID = process.env.DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.DRIVE_REFRESH_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-du-phong';

if (!MONGO_URI) { console.error("❌ LỖI: Chưa cấu hình MONGO_URI!"); process.exit(1); }

// --- 1. KẾT NỐI MONGODB ---
mongoose.connect(MONGO_URI)
    .then(() => { console.log("✅ Đã kết nối MongoDB Atlas"); khoiTaoTaiKhoanMau(); })
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

const DataSchema = new mongoose.Schema({ id: { type: String, default: "hospital_main_db" }, currentData: Object });
const DataModel = mongoose.model('HospitalData', DataSchema);

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Lưu mật khẩu trực tiếp để Admin xem được theo yêu cầu
    role: { type: String, enum: ['admin', 'khoa'] },
    tenKhoa: { type: String }
});
const UserModel = mongoose.model('User', UserSchema);

async function khoiTaoTaiKhoanMau() {
    const count = await UserModel.countDocuments();
    if (count === 0) {
        await UserModel.insertMany([
            { username: 'admin', password: '123', role: 'admin', tenKhoa: 'Phòng Kế hoạch tổng hợp' },
            { username: 'khoamat', password: '123', role: 'khoa', tenKhoa: 'Khoa Mắt' }
        ]);
    }
}

// --- 2. GOOGLE DRIVE API ---
let driveService;
try {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    driveService = google.drive({ version: 'v3', auth: oauth2Client });
} catch (error) { console.error("❌ Lỗi Drive:", error.message); }

// --- 3. MIDDLEWARE ---
const upload = multer({ dest: 'uploads/', limits: { fieldSize: 100 * 1024 * 1024 }});
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// --- 4. API DỮ LIỆU QUY TRÌNH ---
app.get('/api/data', async (req, res) => {
    try {
        const result = await DataModel.findOne({ id: "hospital_main_db" });
        res.json(result ? result.currentData : { PL1: [], PL2: [] });
    } catch (error) { res.status(500).json({ message: "Lỗi tải dữ liệu" }); }
});

app.post('/api/upload-and-save', upload.single('fileExcel'), async (req, res) => {
    try {
        const processedData = JSON.parse(req.body.database);
        await DataModel.findOneAndUpdate({ id: "hospital_main_db" }, { currentData: processedData }, { upsert: true });

        if (req.file && driveService && DRIVE_FOLDER_ID) {
            const fileMetadata = { name: `[Backup] ${Date.now()}_${req.file.originalname}`, parents: [DRIVE_FOLDER_ID] };
            const media = { mimeType: req.file.mimetype, body: fs.createReadStream(req.file.path) };
            await driveService.files.create({ resource: fileMetadata, media: media, fields: 'id' });
            fs.unlinkSync(req.file.path);
        }
        res.json({ message: "Lưu dữ liệu và Backup Drive thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống: " + error.message }); }
});

// --- 5. API TÀI KHOẢN (MỚI) ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await UserModel.findOne({ username, password });
        if (!user) return res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu!" });
        const token = jwt.sign({ id: user._id, role: user.role, tenKhoa: user.tenKhoa, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: "Đăng nhập thành công", token, role: user.role, tenKhoa: user.tenKhoa, username: user.username });
    } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

// Admin lấy danh sách tất cả tài khoản
app.get('/api/users', async (req, res) => {
    try {
        const users = await UserModel.find({ role: 'khoa' }, 'username password tenKhoa');
        res.json(users);
    } catch (error) { res.status(500).json({ message: "Lỗi lấy danh sách" }); }
});

// Admin tạo tài khoản mới cho khoa
app.post('/api/users', async (req, res) => {
    try {
        const { username, password, tenKhoa } = req.body;
        const exists = await UserModel.findOne({ username });
        if(exists) return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
        await UserModel.create({ username, password, role: 'khoa', tenKhoa });
        res.json({ message: "Tạo tài khoản thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi tạo tài khoản" }); }
});

// Khoa (hoặc Admin) đổi mật khẩu
app.put('/api/users/password', async (req, res) => {
    try {
        const { username, newPassword } = req.body;
        await UserModel.findOneAndUpdate({ username }, { password: newPassword });
        res.json({ message: "Cập nhật mật khẩu thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi cập nhật" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`📡 Server chạy tại cổng: ${PORT}`));