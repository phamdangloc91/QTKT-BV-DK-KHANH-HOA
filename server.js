require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken'); // 🟢 MỚI: Thư viện cấp thẻ bài Token

const app = express();
const PORT = process.env.PORT || 3000;

// Lấy các biến môi trường
const MONGO_URI = process.env.MONGO_URI;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const CLIENT_ID = process.env.DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.DRIVE_REFRESH_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-du-phong'; // 🟢 MỚI: Khóa bảo mật

if (!MONGO_URI) {
    console.error("❌ LỖI: Chưa cấu hình MONGO_URI!");
    process.exit(1); 
}

// --- 1. KẾT NỐI MONGODB VÀ TẠO BẢNG DỮ LIỆU ---
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("✅ Đã kết nối MongoDB Atlas");
        khoiTaoTaiKhoanMau(); // 🟢 MỚI: Tự động tạo tài khoản khi khởi động
    })
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// Bảng chứa Quy trình kỹ thuật (Cũ)
const DataSchema = new mongoose.Schema({
    id: { type: String, default: "hospital_main_db" },
    currentData: Object
});
const DataModel = mongoose.model('HospitalData', DataSchema);

// 🟢 MỚI: Định nghĩa Bảng chứa Tài khoản (Users)
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // Tên đăng nhập
    password: { type: String, required: true },               // Mật khẩu
    role: { type: String, enum: ['admin', 'khoa'] },          // Quyền: admin hoặc khoa
    tenKhoa: { type: String }                                 // Tên khoa phòng cụ thể
});
const UserModel = mongoose.model('User', UserSchema);

// 🟢 MỚI: Hàm tự động tạo tài khoản mẫu nếu Database trống
async function khoiTaoTaiKhoanMau() {
    const count = await UserModel.countDocuments();
    if (count === 0) {
        await UserModel.insertMany([
            { username: 'admin', password: '123', role: 'admin', tenKhoa: 'Phòng Kế hoạch tổng hợp' },
            { username: 'khoamat', password: '123', role: 'khoa', tenKhoa: 'Khoa Mắt' }
        ]);
        console.log("✅ Đã tạo tài khoản mẫu: [admin] và [khoamat]. Mật khẩu là: 123");
    }
}

// --- 2. CẤU HÌNH GOOGLE DRIVE API ---
let driveService;
try {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    driveService = google.drive({ version: 'v3', auth: oauth2Client });
    console.log("✅ Đã kết nối Google Drive API");
} catch (error) {
    console.error("❌ Lỗi cấu hình Google Drive:", error.message);
}

// --- 3. CẤU HÌNH MIDDLEWARE ---
const upload = multer({ dest: 'uploads/', limits: { fieldSize: 100 * 1024 * 1024, fileSize: 50 * 1024 * 1024 }});
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// --- 4. CÁC ĐƯỜNG DẪN API ---

// 🟢 MỚI: API Xử lý Đăng nhập
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Tìm user trong Database
        const user = await UserModel.findOne({ username: username, password: password });
        
        if (!user) {
            return res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu!" });
        }

        // Nếu đúng, in Thẻ bài (Token) có thời hạn 8 tiếng
        const token = jwt.sign(
            { id: user._id, role: user.role, tenKhoa: user.tenKhoa }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );

        // Gửi thẻ bài và thông tin về cho trình duyệt
        res.json({ 
            message: "Đăng nhập thành công", 
            token: token, 
            role: user.role, 
            tenKhoa: user.tenKhoa 
        });

    } catch (error) {
        res.status(500).json({ message: "Lỗi Server" });
    }
});

// Các API cũ giữ nguyên
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
        res.json({ message: "Dữ liệu đã lưu MongoDB và Backup lên Drive thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống: " + error.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`📡 Server đang chạy tại cổng: ${PORT}`));