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

// --- 1. KẾT NỐI MONGODB VÀ ĐỊNH NGHĨA CÁC BẢNG ---
mongoose.connect(MONGO_URI)
    .then(() => { console.log("✅ Đã kết nối MongoDB Atlas"); khoiTaoTaiKhoanMau(); })
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// Bảng 1: Dữ liệu gốc (PL1, PL2)
const DataSchema = new mongoose.Schema({ id: { type: String, default: "hospital_main_db" }, currentData: Object });
const DataModel = mongoose.model('HospitalData', DataSchema);

// Bảng 2: Tài khoản
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'khoa'] },
    tenKhoa: { type: String }
});
const UserModel = mongoose.model('User', UserSchema);

// 🟢 BẢNG 3 (MỚI): Giỏ chứa Quy trình và Dữ liệu riêng của từng Khoa
const DeptDataSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // Mã liên kết với tài khoản (VD: khoamat)
    tenKhoa: { type: String },
    danhMucQTKT: { type: Array, default: [] } // Mảng chứa các quy trình đã bóc về
});
const DeptDataModel = mongoose.model('DeptData', DeptDataSchema);

async function khoiTaoTaiKhoanMau() {
    const count = await UserModel.countDocuments();
    if (count === 0) {
        await UserModel.insertMany([
            { username: 'admin', password: '123', role: 'admin', tenKhoa: 'Phòng Kế hoạch tổng hợp' },
            { username: 'khoamat', password: '123', role: 'khoa', tenKhoa: 'Khoa Mắt' }
        ]);
        // Tự động tạo giỏ trống cho Khoa Mắt
        await DeptDataModel.create({ username: 'khoamat', tenKhoa: 'Khoa Mắt', danhMucQTKT: [] });
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

// --- 4. API DỮ LIỆU GỐC & TÀI KHOẢN (Giữ nguyên) ---
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

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await UserModel.findOne({ username, password });
        if (!user) return res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu!" });
        const token = jwt.sign({ id: user._id, role: user.role, tenKhoa: user.tenKhoa, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: "Đăng nhập thành công", token, role: user.role, tenKhoa: user.tenKhoa, username: user.username });
    } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await UserModel.find({ role: 'khoa' }, 'username password tenKhoa');
        res.json(users);
    } catch (error) { res.status(500).json({ message: "Lỗi lấy danh sách" }); }
});

app.post('/api/users', async (req, res) => {
    try {
        const { username, password, tenKhoa } = req.body;
        const exists = await UserModel.findOne({ username });
        if(exists) return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
        await UserModel.create({ username, password, role: 'khoa', tenKhoa });
        // 🟢 Tự động tạo "Giỏ dữ liệu" cho khoa mới
        await DeptDataModel.create({ username, tenKhoa, danhMucQTKT: [] });
        res.json({ message: "Tạo tài khoản thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi tạo tài khoản" }); }
});

app.put('/api/users/password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;
        const user = await UserModel.findOne({ username: username, password: oldPassword });
        if (!user) return res.status(400).json({ message: "Mật khẩu cũ không chính xác!" });
        user.password = newPassword;
        await user.save();
        res.json({ message: "Cập nhật mật khẩu thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi cập nhật hệ thống!" }); }
});

// --- 5. API DỮ LIỆU KHOA (MỚI TOANH) ---

// API: Lấy danh sách QTKT của TẤT CẢ các khoa (Dùng để hiển thị cho Khách xem)
app.get('/api/dept-data', async (req, res) => {
    try {
        const allDepts = await DeptDataModel.find({});
        res.json(allDepts);
    } catch (error) { res.status(500).json({ message: "Lỗi tải dữ liệu các khoa" }); }
});

// API: Bóc quy trình về khoa (Thêm vào mảng danhMucQTKT)
app.post('/api/dept-data/add', async (req, res) => {
    try {
        const { username, quyTrinh } = req.body; // quyTrinh là 1 object copy từ PL1
        
        // Tìm giỏ của khoa này
        const dept = await DeptDataModel.findOne({ username: username });
        if(!dept) return res.status(404).json({ message: "Không tìm thấy dữ liệu khoa" });

        // Kiểm tra xem quy trình này đã bóc chưa (chống trùng lặp mã)
        const daCo = dept.danhMucQTKT.find(qt => qt.ma === quyTrinh.ma || qt.maLienKet === quyTrinh.maLienKet);
        if (daCo) return res.status(400).json({ message: "Quy trình này đã có trong danh mục của khoa!" });

        // Thêm vào giỏ và lưu lại
        dept.danhMucQTKT.push(quyTrinh);
        await dept.save();

        res.json({ message: "Đã bóc quy trình về khoa thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

// API: Xóa quy trình khỏi khoa
app.post('/api/dept-data/remove', async (req, res) => {
    try {
        const { username, maQuyTrinh } = req.body;
        const dept = await DeptDataModel.findOne({ username: username });
        
        // Lọc bỏ quy trình có mã trùng khớp
        dept.danhMucQTKT = dept.danhMucQTKT.filter(qt => qt.ma !== maQuyTrinh && qt.maLienKet !== maQuyTrinh);
        await dept.save();

        res.json({ message: "Đã xóa quy trình khỏi danh mục của khoa!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`📡 Server chạy tại cổng: ${PORT}`));