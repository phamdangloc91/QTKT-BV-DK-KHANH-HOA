require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Lấy các biến môi trường
const MONGO_URI = process.env.MONGO_URI;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const CLIENT_ID = process.env.DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.DRIVE_REFRESH_TOKEN;

if (!MONGO_URI) {
    console.error("❌ LỖI: Chưa cấu hình MONGO_URI!");
    process.exit(1); 
}

// --- 1. KẾT NỐI MONGODB ATLAS ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB Atlas"))
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

const DataSchema = new mongoose.Schema({
    id: { type: String, default: "hospital_main_db" },
    currentData: Object
});
const DataModel = mongoose.model('HospitalData', DataSchema);

// --- 2. CẤU HÌNH GOOGLE DRIVE API (OAUTH2 TÀI KHOẢN THẬT) ---
let driveService;
try {
    const oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        "https://developers.google.com/oauthplayground" // Link chuyển hướng lúc setup
    );

    // Cấp thẻ bài Refresh Token để nó tự động lấy Access Token mới mỗi khi hết hạn
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    driveService = google.drive({ version: 'v3', auth: oauth2Client });
    console.log("✅ Đã kết nối Google Drive API (Bản OAuth2 15GB)");
} catch (error) {
    console.error("❌ Lỗi cấu hình Google Drive:", error.message);
}

// --- 3. CẤU HÌNH LƯU TRỮ TẠM THỜI ---
const upload = multer({ 
    dest: 'uploads/', 
    limits: { fieldSize: 100 * 1024 * 1024, fileSize: 50 * 1024 * 1024 }
});

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// --- 4. CÁC API ---
app.get('/api/data', async (req, res) => {
    try {
        const result = await DataModel.findOne({ id: "hospital_main_db" });
        res.json(result ? result.currentData : { PL1: [], PL2: [] });
    } catch (error) {
        res.status(500).json({ message: "Lỗi tải dữ liệu" });
    }
});

// API Nhập File Excel (Lưu Mongo + Drive)
app.post('/api/upload-and-save', upload.single('fileExcel'), async (req, res) => {
    try {
        // A. Lưu vào MongoDB
        const processedData = JSON.parse(req.body.database);
        await DataModel.findOneAndUpdate(
            { id: "hospital_main_db" }, 
            { currentData: processedData }, 
            { upsert: true }
        );

        // B. Đẩy file Excel lên Google Drive (Nếu có biến môi trường đầy đủ)
        if (req.file && driveService && DRIVE_FOLDER_ID) {
            const fileMetadata = { 
                name: `[Backup] ${Date.now()}_${req.file.originalname}`, 
                parents: [DRIVE_FOLDER_ID] 
            };
            const media = { 
                mimeType: req.file.mimetype, 
                body: fs.createReadStream(req.file.path) 
            };

            await driveService.files.create({
                resource: fileMetadata, 
                media: media, 
                fields: 'id'
            });

            // Xóa file tạm
            fs.unlinkSync(req.file.path);
        }

        console.log(`[${new Date().toLocaleTimeString()}] Đã lưu MongoDB và Backup Excel lên Drive.`);
        res.json({ message: "Dữ liệu đã lưu MongoDB và file gốc đã Backup lên Google Drive thành công!" });
    } catch (error) {
        console.error("Lỗi hệ thống:", error);
        res.status(500).json({ message: "Lỗi hệ thống: " + error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`📡 Server đang chạy tại cổng: ${PORT}`);
});