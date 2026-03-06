require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { google } = require('googleapis'); // Thư viện Google Drive

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGO_URI;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;

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

// --- 2. CẤU HÌNH GOOGLE DRIVE API ---
const KEYFILEPATH = fs.existsSync('/etc/secrets/drive-key.json') 
    ? '/etc/secrets/drive-key.json' 
    : path.join(__dirname, 'drive-key.json');

let driveService;
try {
    const auth = new google.auth.GoogleAuth({
        keyFile: KEYFILEPATH,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    driveService = google.drive({ version: 'v3', auth });
    console.log("✅ Đã kết nối Google Drive API");
} catch (error) {
    console.error("❌ Lỗi cấu hình Google Drive:", error.message);
}

// --- 3. CẤU HÌNH LƯU TRỮ TẠM THỜI (Multer) ---
const upload = multer({ 
    dest: 'uploads/', // File nhận về sẽ tạm nằm ở đây
    limits: { fieldSize: 100 * 1024 * 1024, fileSize: 50 * 1024 * 1024 }
});

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// --- 4. API TẢI DỮ LIỆU TỪ MONGODB VỀ TRANG WEB ---
app.get('/api/data', async (req, res) => {
    try {
        const result = await DataModel.findOne({ id: "hospital_main_db" });
        res.json(result ? result.currentData : { PL1: [], PL2: [] });
    } catch (error) {
        res.status(500).json({ message: "Lỗi tải dữ liệu" });
    }
});

// --- 5. API NHẬN FILE EXCEL & DỮ LIỆU (LƯU CẢ MONGO VÀ DRIVE) ---
app.post('/api/upload-and-save', upload.single('fileExcel'), async (req, res) => {
    try {
        // A. Lưu dữ liệu dạng bảng vào MongoDB
        const processedData = JSON.parse(req.body.database);
        await DataModel.findOneAndUpdate(
            { id: "hospital_main_db" }, 
            { currentData: processedData }, 
            { upsert: true }
        );

        // B. Gửi thẳng file Excel gốc lên Google Drive
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

            // Xóa file rác trong Server đi cho nhẹ máy
            fs.unlinkSync(req.file.path);
        }

        console.log(`[${new Date().toLocaleTimeString()}] Đã lưu MongoDB và Backup Excel lên Drive.`);
        res.json({ message: "Dữ liệu đã được lưu trên MongoDB và file gốc đã lưu lên Drive!" });
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