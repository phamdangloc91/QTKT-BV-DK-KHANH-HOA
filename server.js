const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const app = express();

const PORT = process.env.PORT || 3000;
// Lấy mã kết nối từ cấu hình Render
const MONGO_URI = process.env.MONGO_URI; 

// --- KẾT NỐI MONGODB ATLAS ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB Atlas vĩnh viễn"))
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// Định nghĩa cấu trúc lưu trữ trên Cloud
const DataSchema = new mongoose.Schema({
    id: { type: String, default: "hospital_main_db" },
    currentData: Object // Lưu toàn bộ mảng PL1 và PL2
});
const DataModel = mongoose.model('HospitalData', DataSchema);

// --- CẤU HÌNH LƯU FILE EXCEL GỐC (Tạm thời trên Server) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ 
    storage: storage, 
    limits: { fieldSize: 100 * 1024 * 1024 } 
});

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// 1. Lấy dữ liệu từ Cloud khi mở trang
app.get('/api/data', async (req, res) => {
    try {
        const result = await DataModel.findOne({ id: "hospital_main_db" });
        res.json(result ? result.currentData : { PL1: [], PL2: [] });
    } catch (error) {
        res.status(500).json({ message: "Lỗi tải dữ liệu" });
    }
});

// 2. Lưu file gốc và đẩy dữ liệu lên Cloud
app.post('/api/upload-and-save', upload.single('fileExcel'), async (req, res) => {
    try {
        const processedData = JSON.parse(req.body.database);
        
        // Lưu/Cập nhật vào MongoDB
        await DataModel.findOneAndUpdate(
            { id: "hospital_main_db" },
            { currentData: processedData },
            { upsert: true, new: true }
        );

        res.json({ message: "Dữ liệu đã được bảo vệ vĩnh viễn trên MongoDB Atlas!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi lưu trữ: " + error.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`🚀 Hệ thống đang chạy tại cổng: ${PORT}`));
