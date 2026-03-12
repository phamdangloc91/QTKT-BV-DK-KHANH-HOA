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

async function khoiTaoDuLieuGoc() {
    try { await DeptDataModel.collection.dropIndex("username_1"); } catch(e) {}
    for (let ten of DANH_SACH_KHOA) {
        await DeptDataModel.findOneAndUpdate(
            { tenKhoa: ten }, 
            { $setOnInsert: { tenKhoa: ten, danhMucQTKT: [] } }, 
            { upsert: true, new: true }
        );
    }
    const countAdmin = await UserModel.countDocuments({ role: 'admin' });
    if (countAdmin === 0) {
        await UserModel.create({ username: 'admin', password: '123', role: 'admin', tenKhoa: 'Phòng Kế hoạch tổng hợp' });
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

// --- 4. API DỮ LIỆU GỐC & TÀI KHOẢN ---
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
        const users = await UserModel.find({ role: { $ne: 'admin' } }, 'username password tenKhoa role');
        res.json(users);
    } catch (error) { res.status(500).json({ message: "Lỗi lấy danh sách" }); }
});

app.post('/api/users', async (req, res) => {
    try {
        const { username, password, tenKhoa, role } = req.body;
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
        res.json({ message: "Đã xóa tài khoản thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

// --- 5. API DỮ LIỆU KHOA ---
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

        const daCo = dept.danhMucQTKT.find(qt => 
            (quyTrinh.ma && qt.ma === quyTrinh.ma) || 
            (quyTrinh.maLienKet && qt.maLienKet === quyTrinh.maLienKet) ||
            (quyTrinh.ten && qt.ten === quyTrinh.ten)
        );
        if (daCo) return res.status(400).json({ message: "Quy trình này đã có trong danh mục!" });

        // Khởi tạo thêm 3 biến trạng thái mặc định khi bóc về
        quyTrinh.trangThai = "CHUA_NOP";
        quyTrinh.fileKhoa = null;
        quyTrinh.fileAdmin = null;

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

// --- BỘ MÁY XỬ LÝ FILE VÀ TRẠNG THÁI (NÂNG CẤP) ---

// Hàm hỗ trợ Up file lên Drive cho gọn code
async function uploadToDrive(fileObj, prefixName) {
    if (!fileObj) return null;
    const fileMetadata = { name: `${prefixName}_${fileObj.originalname}`, parents: [DRIVE_FOLDER_ID] };
    const media = { mimeType: fileObj.mimetype, body: fs.createReadStream(fileObj.path) };
    const driveRes = await driveService.files.create({ resource: fileMetadata, media: media, fields: 'id, webViewLink' });
    await driveService.permissions.create({ fileId: driveRes.data.id, requestBody: { role: 'reader', type: 'anyone' } });
    fs.unlinkSync(fileObj.path);
    return driveRes.data.webViewLink;
}

// 1. Khoa nộp file nháp -> CHO_DUYET
app.post('/api/upload/khoa', upload.single('fileQuyTrinh'), async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh } = req.body;
        if (!req.file) return res.status(400).json({ message: "Chưa chọn file!" });
        const link = await uploadToDrive(req.file, `[NHÁP]_${tenKhoa}_${maQuyTrinh}`);
        
        const dept = await DeptDataModel.findOne({ tenKhoa });
        const qtIndex = dept.danhMucQTKT.findIndex(qt => (qt.ma === maQuyTrinh || qt.maLienKet === maQuyTrinh));
        dept.danhMucQTKT[qtIndex].trangThai = 'CHO_DUYET';
        dept.danhMucQTKT[qtIndex].fileKhoa = link;
        dept.markModified('danhMucQTKT'); await dept.save();
        res.json({ message: "Nộp quy trình thành công! Đang chờ P.KHTH duyệt." });
    } catch (error) { res.status(500).json({ message: "Lỗi upload" }); }
});

// 2. Admin duyệt và nộp HĐKHKT -> CHO_HDKHKT
app.post('/api/upload/admin', upload.single('fileDuyet'), async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh } = req.body;
        const dept = await DeptDataModel.findOne({ tenKhoa });
        const qtIndex = dept.danhMucQTKT.findIndex(qt => (qt.ma === maQuyTrinh || qt.maLienKet === maQuyTrinh));

        // Nếu Admin có chọn file mới thì up, không thì dùng lại file Khoa
        if (req.file) {
            const link = await uploadToDrive(req.file, `[TRÌNH_HĐ]_${tenKhoa}_${maQuyTrinh}`);
            dept.danhMucQTKT[qtIndex].fileAdmin = link;
        } else {
            dept.danhMucQTKT[qtIndex].fileAdmin = dept.danhMucQTKT[qtIndex].fileKhoa; 
        }
        
        dept.danhMucQTKT[qtIndex].trangThai = 'CHO_HDKHKT';
        dept.markModified('danhMucQTKT'); await dept.save();
        res.json({ message: "Đã duyệt và chuyển sang Tab Hội đồng KHKT!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

// 3. Admin up 3 File chính thức -> DA_PHE_DUYET
const multiUpload = upload.fields([{ name: 'fQuyetDinh', maxCount: 1 }, { name: 'fBienBan', maxCount: 1 }, { name: 'fPdf', maxCount: 1 }]);
app.post('/api/upload/final', multiUpload, async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh } = req.body;
        const files = req.files;
        
        let linkQD = files['fQuyetDinh'] ? await uploadToDrive(files['fQuyetDinh'][0], `[QĐ]_${maQuyTrinh}`) : null;
        let linkBB = files['fBienBan'] ? await uploadToDrive(files['fBienBan'][0], `[BB]_${maQuyTrinh}`) : null;
        let linkPDF = files['fPdf'] ? await uploadToDrive(files['fPdf'][0], `[FINAL]_${maQuyTrinh}`) : null;

        const dept = await DeptDataModel.findOne({ tenKhoa });
        const qtIndex = dept.danhMucQTKT.findIndex(qt => (qt.ma === maQuyTrinh || qt.maLienKet === maQuyTrinh));
        
        dept.danhMucQTKT[qtIndex].trangThai = 'DA_PHE_DUYET';
        if(linkQD) dept.danhMucQTKT[qtIndex].fileQuyetDinh = linkQD;
        if(linkBB) dept.danhMucQTKT[qtIndex].fileBienBan = linkBB;
        if(linkPDF) dept.danhMucQTKT[qtIndex].filePdfChinhThuc = linkPDF;

        dept.markModified('danhMucQTKT'); await dept.save();
        res.json({ message: "Đã nộp 3 file chính thức thành công! Quy trình hoàn tất." });
    } catch (error) { res.status(500).json({ message: "Lỗi upload file" }); }
});

// 4. Cập nhật Trạng thái (Hủy / Nộp lại)
app.post('/api/dept-data/status', async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh, action } = req.body;
        const dept = await DeptDataModel.findOne({ tenKhoa });
        const qtIndex = dept.danhMucQTKT.findIndex(qt => (qt.ma === maQuyTrinh || qt.maLienKet === maQuyTrinh));
        const qt = dept.danhMucQTKT[qtIndex];

        if (action === 'REJECT_KHOA') qt.trangThai = 'KHONG_DUYET'; // KHTH trả về Khoa
        else if (action === 'REVERT_HDKHKT') qt.trangThai = 'CHO_DUYET'; // Rút khỏi HĐKHKT
        else if (action === 'RESUBMIT') qt.trangThai = 'CHUA_NOP'; // Khoa tạo lại trạng thái để nộp mới

        dept.markModified('danhMucQTKT'); await dept.save();
        res.json({ message: "Đã cập nhật trạng thái!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`📡 Server chạy tại cổng: ${PORT}`));