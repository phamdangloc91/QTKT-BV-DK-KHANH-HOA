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

// 🟢 DANH SÁCH 30 KHOA/TRUNG TÂM CHUẨN
const DANH_SACH_KHOA = [
    "Khoa Cấp cứu", "Khoa Hồi sức Tích cực và Chống độc", "Khoa Nội Tổng hợp Thần kinh",
    "Khoa Nội Cán bộ", "Khoa Nhi", "Khoa Ngoại Tổng quát", "Khoa Ngoại Thần kinh", "Khoa Ngoại Cột sống",
    "Khoa Phẫu thuật - Gây mê Hồi sức", "Khoa Phụ Sản", "Khoa Tai Mũi Họng", "Khoa Mắt", "Khoa Răng Hàm Mặt",
    "Khoa Vật lý Trị liệu - Phục hồi Chức năng", "Khoa Y học Cổ truyền", "Khoa Ngoại Tiết niệu", 
    "Khoa Đột quỵ", "Khoa Huyết học - Truyền máu", "Khoa Hóa sinh", "Khoa Vi sinh - Ký sinh trùng", 
    "Khoa Chẩn đoán Hình ảnh", "Khoa Giải phẫu bệnh", "Khoa Kiểm soát Nhiễm khuẩn", "Khoa Dược", 
    "Khoa Dinh dưỡng", "Khoa Nội Tim mạch Lão học", "Khoa Tim mạch Can thiệp", "Khoa Ngoại Lồng ngực",
    "Trung tâm Chấn thương Chỉnh hình và Bỏng", "Trung tâm Dịch vụ Y tế"
];

// --- 1. KẾT NỐI MONGODB VÀ ĐỊNH NGHĨA CÁC BẢNG ---
mongoose.connect(MONGO_URI)
    .then(() => { console.log("✅ Đã kết nối MongoDB Atlas"); khoiTaoDuLieuGoc(); })
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

const DataSchema = new mongoose.Schema({ id: { type: String, default: "hospital_main_db" }, currentData: Object });
const DataModel = mongoose.model('HospitalData', DataSchema);

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'khoa', 'hdkhkt'] }, 
    tenKhoa: { type: String, required: true }
});
const UserModel = mongoose.model('User', UserSchema);

const DeptDataSchema = new mongoose.Schema({
    tenKhoa: { type: String, required: true, unique: true }, 
    danhMucQTKT: { type: Array, default: [] }
});
const DeptDataModel = mongoose.model('DeptData', DeptDataSchema);

// 🟢 HÀM KIỂM TRA VÀ TẠO BÙ DỮ LIỆU ĐÃ ĐƯỢC NÂNG CẤP
async function khoiTaoDuLieuGoc() {
    // Dọn dẹp tàn dư cấu trúc cũ (nếu có) để không bị kẹt lỗi Database
    try { await DeptDataModel.collection.dropIndex("username_1"); } catch(e) {}

    // 1. Điểm danh 30 khoa: Khoa nào chưa có giỏ thì tự động tạo mới
    for (let ten of DANH_SACH_KHOA) {
        await DeptDataModel.findOneAndUpdate(
            { tenKhoa: ten }, 
            { $setOnInsert: { tenKhoa: ten, danhMucQTKT: [] } }, 
            { upsert: true, new: true }
        );
    }
    console.log("✅ Đã điểm danh và tạo đủ 30 Giỏ hàng cho các Khoa.");

    // 2. Tạo tài khoản Admin
    const countAdmin = await UserModel.countDocuments({ role: 'admin' });
    if (countAdmin === 0) {
        await UserModel.create({ username: 'admin', password: '123', role: 'admin', tenKhoa: 'Phòng Kế hoạch tổng hợp' });
        console.log("✅ Đã tạo tài khoản quản trị: [admin]");
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

// --- 4. CÁC API HỆ THỐNG ---
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
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
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
        const { username, password, tenKhoa, role } = req.body; // 🟢 Nhận thêm 'role'
        const exists = await UserModel.findOne({ username });
        if(exists) return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
        
        await UserModel.create({ username, password, role: role, tenKhoa });
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
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

app.put('/api/users/admin-update', async (req, res) => {
    try {
        const { id, newUsername, newPassword } = req.body;
        const exists = await UserModel.findOne({ username: newUsername, _id: { $ne: id } });
        if (exists) return res.status(400).json({ message: "Tên đăng nhập này đã có người sử dụng!" });
        await UserModel.findByIdAndUpdate(id, { username: newUsername, password: newPassword });
        res.json({ message: "Đã cập nhật tài khoản thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await UserModel.findByIdAndDelete(req.params.id);
        res.json({ message: "Đã xóa tài khoản thành công! (Dữ liệu quy trình của khoa vẫn an toàn)" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

// --- API DỮ LIỆU KHOA ---
app.get('/api/dept-data', async (req, res) => {
    try {
        const allDepts = await DeptDataModel.find({});
        res.json(allDepts);
    } catch (error) { res.status(500).json({ message: "Lỗi tải dữ liệu" }); }
});

app.post('/api/dept-data/add', async (req, res) => {
    try {
        const { tenKhoa, quyTrinh } = req.body; 
        const dept = await DeptDataModel.findOne({ tenKhoa: tenKhoa });
        if(!dept) return res.status(404).json({ message: "Không tìm thấy dữ liệu khoa" });

        // 🟢 ĐÃ SỬA LỖI: Chỉ so sánh khi mã có dữ liệu, tránh lỗi "Trống = Trống", kết hợp so sánh Tên
        const daCo = dept.danhMucQTKT.find(qt => 
            (quyTrinh.ma && qt.ma === quyTrinh.ma) || 
            (quyTrinh.maLienKet && qt.maLienKet === quyTrinh.maLienKet) ||
            (quyTrinh.ten && qt.ten === quyTrinh.ten)
        );

        if (daCo) return res.status(400).json({ message: "Quy trình này đã có trong danh mục!" });

        dept.danhMucQTKT.push(quyTrinh);
        await dept.save();
        res.json({ message: "Đã bóc quy trình về khoa thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.post('/api/dept-data/remove', async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh } = req.body;
        const dept = await DeptDataModel.findOne({ tenKhoa: tenKhoa });
        if(!dept) return res.status(404).json({ message: "Không tìm thấy dữ liệu khoa" });

        dept.danhMucQTKT = dept.danhMucQTKT.filter(qt => qt.ma !== maQuyTrinh && qt.maLienKet !== maQuyTrinh);
        await dept.save();
        res.json({ message: "Đã xóa quy trình khỏi danh mục của khoa!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`📡 Server chạy tại cổng: ${PORT}`));