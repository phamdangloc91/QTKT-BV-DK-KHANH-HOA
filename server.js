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

mongoose.connect(MONGO_URI)
    .then(() => { console.log("✅ Đã kết nối MongoDB Atlas"); khoiTaoDuLieuGoc(); })
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

const DataSchema = new mongoose.Schema({ id: { type: String, default: "hospital_main_db" }, currentData: Object });
const DataModel = mongoose.model('HospitalData', DataSchema);

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'khoa'] },
    tenKhoa: { type: String, required: true }
});
const UserModel = mongoose.model('User', UserSchema);

// 🟢 NÂNG CẤP SCHEMA: Thêm daoTaoNganHan
const DeptDataSchema = new mongoose.Schema({
    tenKhoa: { type: String, required: true, unique: true }, 
    danhMucQTKT: { type: Array, default: [] },
    daoTaoNganHan: { type: Array, default: [] }
});
const DeptDataModel = mongoose.model('DeptData', DeptDataSchema);

async function khoiTaoDuLieuGoc() {
    try { await DeptDataModel.collection.dropIndex("username_1"); } catch(e) {}
    for (let ten of DANH_SACH_KHOA) {
        await DeptDataModel.findOneAndUpdate(
            { tenKhoa: ten }, 
            { $setOnInsert: { tenKhoa: ten, danhMucQTKT: [], daoTaoNganHan: [] } }, 
            { upsert: true, returnDocument: 'after' }
        );
    }
    const countAdmin = await UserModel.countDocuments({ role: 'admin' });
    if (countAdmin === 0) { await UserModel.create({ username: 'admin', password: '123', role: 'admin', tenKhoa: 'Phòng Kế hoạch tổng hợp' }); }
}

let driveService;
try {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    driveService = google.drive({ version: 'v3', auth: oauth2Client });
} catch (error) { console.error("❌ Lỗi Drive:", error.message); }

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

const upload = multer({ dest: 'uploads/', limits: { fieldSize: 100 * 1024 * 1024 }});
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/api/data', async (req, res) => {
    try { const result = await DataModel.findOne({ id: "hospital_main_db" }); res.json(result ? result.currentData : { PL1: [], PL2: [], GiaDV: [], MaDVBV: [] }); } 
    catch (error) { res.status(500).json({ message: "Lỗi tải dữ liệu" }); }
});

app.post('/api/upload-and-save', upload.single('fileExcel'), async (req, res) => {
    try {
        const tabName = req.body.tabName;
        if (!tabName) return res.status(400).json({ message: "Không xác định được bảng dữ liệu!" });
        const tabData = JSON.parse(req.body.tabData);

        const updateQuery = {}; updateQuery[`currentData.${tabName}`] = tabData;
        await DataModel.findOneAndUpdate({ id: "hospital_main_db" }, { $set: updateQuery }, { upsert: true, returnDocument: 'after' });

        if (req.file && driveService && DRIVE_FOLDER_ID) {
            try {
                const fileMetadata = { name: `[Backup_${tabName}] ${Date.now()}_${req.file.originalname}`, parents: [DRIVE_FOLDER_ID] };
                const media = { mimeType: req.file.mimetype, body: fs.createReadStream(req.file.path) };
                await driveService.files.create({ resource: fileMetadata, media: media, fields: 'id' });
                fs.unlinkSync(req.file.path);
            } catch (e) { console.log("Lỗi up backup lên Drive."); }
        }
        res.json({ message: `Lưu dữ liệu cho bảng [${tabName}] thành công!` });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống khi lưu dữ liệu" }); }
});

// 🟢 API MỚI: XỬ LÝ NHẬP EXCEL KẾ HOẠCH ĐÀO TẠO
app.post('/api/upload-dtnh', async (req, res) => {
    try {
        const payload = req.body.payload; 
        const year = req.body.year;
        
        for (let khoa in payload) {
            const dept = await DeptDataModel.findOne({ tenKhoa: khoa });
            if (dept) {
                // Xóa dữ liệu cũ của NĂM ĐÓ trong khoa đó để cập nhật mới
                let filtered = dept.daoTaoNganHan.filter(item => String(item.nam) !== String(year));
                // Thêm dữ liệu mới
                filtered.push(...payload[khoa]);
                dept.daoTaoNganHan = filtered;
                dept.markModified('daoTaoNganHan');
                await dept.save();
            }
        }
        res.json({ message: `Đã cập nhật Kế hoạch Đào tạo ngắn hạn (Năm ${year}) thành công cho các khoa!` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi lưu dữ liệu đào tạo." });
    }
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
    try { const users = await UserModel.find({ role: { $ne: 'admin' } }, 'username password tenKhoa role'); res.json(users); } 
    catch (error) { res.status(500).json({ message: "Lỗi lấy danh sách" }); }
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
        user.password = newPassword; await user.save();
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
    try { await UserModel.findByIdAndDelete(req.params.id); res.json({ message: "Đã xóa tài khoản thành công!" }); } 
    catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.get('/api/dept-data', async (req, res) => {
    try { const allDepts = await DeptDataModel.find({}); res.json(allDepts); } 
    catch (error) { res.status(500).json({ message: "Lỗi tải dữ liệu" }); }
});

app.post('/api/dept-data/add', async (req, res) => {
    try {
        const { tenKhoa, quyTrinh } = req.body; 
        const dept = await DeptDataModel.findOne({ tenKhoa: tenKhoa });
        if(!dept) return res.status(404).json({ message: "Không tìm thấy dữ liệu khoa" });

        const daCo = dept.danhMucQTKT.find(qt => (quyTrinh.ma && String(qt.ma) === String(quyTrinh.ma)) || (quyTrinh.maLienKet && String(qt.maLienKet) === String(quyTrinh.maLienKet)));
        if (daCo) return res.status(400).json({ message: "Quy trình này đã có trong danh mục của Khoa!" });

        quyTrinh.trangThai = "CHUA_NOP";
        dept.danhMucQTKT.push(quyTrinh); await dept.save();
        res.json({ message: "Đã thêm quy trình về khoa thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

function extractDriveId(link) {
    if (!link) return null;
    const match = link.match(/\/d\/(.+?)\//);
    return match ? match[1] : null;
}

async function deleteFromDrive(link) {
    const fileId = extractDriveId(link);
    if (fileId && driveService) {
        try { await driveService.files.delete({ fileId: fileId }); console.log("🗑️ Đã dọn dẹp file: " + fileId); } 
        catch (e) { console.log("⚠️ Bỏ qua file lỗi/đã xóa: " + fileId); }
    }
}

app.post('/api/dept-data/remove', async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh } = req.body;
        const dept = await DeptDataModel.findOne({ tenKhoa: tenKhoa });
        const qtIndex = dept.danhMucQTKT.findIndex(qt => String(qt.ma) === String(maQuyTrinh) || String(qt.maLienKet) === String(maQuyTrinh));
        
        if (qtIndex !== -1) {
            const qt = dept.danhMucQTKT[qtIndex];
            await deleteFromDrive(qt.fileKhoa); await deleteFromDrive(qt.fileAdmin); await deleteFromDrive(qt.fileQuyetDinh); await deleteFromDrive(qt.fileBienBan); await deleteFromDrive(qt.filePdfChinhThuc);
            dept.danhMucQTKT.splice(qtIndex, 1); await dept.save();
            res.json({ message: "Đã xóa toàn bộ dữ liệu và file đính kèm của quy trình này khỏi hệ thống!" });
        } else {
            res.status(404).json({ message: "Không tìm thấy kỹ thuật này trong giỏ hàng." });
        }
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

async function uploadToDrive(fileObj, prefixName) {
    if (!fileObj) return null;
    const fileMetadata = { name: `${prefixName}_${fileObj.originalname}`, parents: [DRIVE_FOLDER_ID] };
    const media = { mimeType: fileObj.mimetype, body: fs.createReadStream(fileObj.path) };
    const driveRes = await driveService.files.create({ resource: fileMetadata, media: media, fields: 'id, webViewLink' });
    await driveService.permissions.create({ fileId: driveRes.data.id, requestBody: { role: 'reader', type: 'anyone' } });
    fs.unlinkSync(fileObj.path); return driveRes.data.webViewLink;
}

app.post('/api/upload/khoa', upload.single('fileQuyTrinh'), async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh } = req.body;
        if (!req.file) return res.status(400).json({ message: "Chưa chọn file!" });
        
        const dept = await DeptDataModel.findOne({ tenKhoa });
        if(!dept) return res.status(404).json({ message: "Không tìm thấy khoa!" });

        const qtIndex = dept.danhMucQTKT.findIndex(qt => (String(qt.ma) === String(maQuyTrinh) || String(qt.maLienKet) === String(maQuyTrinh)));
        if (qtIndex === -1) return res.status(404).json({ message: "Chưa Thêm kỹ thuật này vào giỏ hàng, nên không thể upload file!" });

        const link = await uploadToDrive(req.file, `[NHÁP]_${tenKhoa}_${maQuyTrinh}`);
        dept.danhMucQTKT[qtIndex].trangThai = 'CHO_DUYET'; 
        dept.danhMucQTKT[qtIndex].fileKhoa = link;
        dept.markModified('danhMucQTKT'); await dept.save();
        res.json({ message: "Nộp quy trình thành công! Đang chờ P.KHTH duyệt." });
    } catch (error) { 
        console.error(error); 
        res.status(500).json({ message: "Lỗi upload Google Drive: " + (error.message || "Unknown Error") }); 
    }
});

app.post('/api/upload/batch-qdbb', upload.fields([{ name: 'fQuyetDinh', maxCount: 1 }, { name: 'fBienBan', maxCount: 1 }]), async (req, res) => {
    try {
        const items = JSON.parse(req.body.items); const files = req.files || {};
        let linkQD = files['fQuyetDinh'] ? await uploadToDrive(files['fQuyetDinh'][0], `[QĐ]_${Date.now()}`) : null;
        let linkBB = files['fBienBan'] ? await uploadToDrive(files['fBienBan'][0], `[BB]_${Date.now()}`) : null;

        if (!linkQD && !linkBB) return res.status(400).json({ message: "Chưa chọn file nào!" });

        const deptsToSave = {};
        for (let item of items) {
            if (!deptsToSave[item.tenKhoa]) deptsToSave[item.tenKhoa] = await DeptDataModel.findOne({ tenKhoa: item.tenKhoa });
            const dept = deptsToSave[item.tenKhoa];
            if (dept) {
                const qtIndex = dept.danhMucQTKT.findIndex(qt => (String(qt.ma) === String(item.maQuyTrinh) || String(qt.maLienKet) === String(item.maQuyTrinh)));
                if (qtIndex !== -1) {
                    if (linkQD) dept.danhMucQTKT[qtIndex].fileQuyetDinh = linkQD;
                    if (linkBB) dept.danhMucQTKT[qtIndex].fileBienBan = linkBB;
                    dept.markModified('danhMucQTKT');
                }
            }
        }
        for (let k in deptsToSave) await deptsToSave[k].save();
        res.json({ message: "Đã đính kèm Quyết định & Biên bản thành công!" });
    } catch (error) { 
        res.status(500).json({ message: "Lỗi upload Google Drive: " + (error.message || "Unknown Error") }); 
    }
});

app.post('/api/upload/final-pdf', upload.single('fPdf'), async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh } = req.body;
        if (!req.file) return res.status(400).json({ message: "Chưa chọn file PDF!" });
        
        const dept = await DeptDataModel.findOne({ tenKhoa });
        const qtIndex = dept.danhMucQTKT.findIndex(qt => (String(qt.ma) === String(maQuyTrinh) || String(qt.maLienKet) === String(maQuyTrinh)));
        if (qtIndex === -1) return res.status(404).json({ message: "Không tìm thấy quy trình!" });

        const linkPDF = await uploadToDrive(req.file, `[FINAL]_${maQuyTrinh}`);
        dept.danhMucQTKT[qtIndex].trangThai = 'DA_PHE_DUYET';
        dept.danhMucQTKT[qtIndex].filePdfChinhThuc = linkPDF;
        dept.markModified('danhMucQTKT'); await dept.save();
        res.json({ message: "Đã tải file PDF chính thức thành công! Quy trình hoàn tất." });
    } catch (error) { 
        res.status(500).json({ message: "Lỗi upload Google Drive: " + (error.message || "Unknown Error") }); 
    }
});

app.post('/api/dept-data/status', async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh, action } = req.body;
        const dept = await DeptDataModel.findOne({ tenKhoa });
        const qtIndex = dept.danhMucQTKT.findIndex(qt => (String(qt.ma) === String(maQuyTrinh) || String(qt.maLienKet) === String(maQuyTrinh)));
        if (qtIndex === -1) return res.status(404).json({ message: "Lỗi trạng thái: Không tìm thấy dữ liệu!" });

        const qt = dept.danhMucQTKT[qtIndex];
        if (action === 'REJECT_KHOA') qt.trangThai = 'KHONG_DUYET';
        else if (action === 'RESUBMIT') qt.trangThai = 'CHUA_NOP'; 
        else if (action === 'REVERT_FINAL') {
            qt.trangThai = 'CHO_DUYET'; qt.filePdfChinhThuc = null; 
        }

        dept.markModified('danhMucQTKT'); await dept.save();
        res.json({ message: "Đã cập nhật trạng thái thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`📡 Server chạy tại cổng: ${PORT}`));