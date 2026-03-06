// Nạp cấu hình từ file .env (Chỉ dùng khi chạy ở máy tính local)
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const app = express();

// Thiết lập cổng: Ưu tiên cổng của Render hoặc cổng 3000
const PORT = process.env.PORT || 3000;

// Lấy chuỗi kết nối từ biến môi trường (Render) hoặc file .env (VS Code)
const MONGO_URI = process.env.MONGO_URI;

// Kiểm tra an toàn: Dừng server nếu quên cấu hình MONGO_URI
if (!MONGO_URI) {
    console.error("❌ LỖI NGHIÊM TRỌNG: Chưa tìm thấy chuỗi kết nối MONGO_URI!");
    console.error("👉 Hãy kiểm tra lại file .env (nếu chạy local) hoặc Environment (trên Render).");
    process.exit(1); 
}

// --- 1. KẾT NỐI MONGODB ATLAS ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB Atlas thành công!"))
    .catch(err => {
        console.error("❌ Lỗi kết nối MongoDB! Hãy kiểm tra mã kết nối hoặc IP Access List.");
        console.error(err);
    });

// Định nghĩa cấu trúc lưu trữ dữ liệu quy trình
const DataSchema = new mongoose.Schema({
    id: { type: String, default: "hospital_main_db" },
    currentData: Object // Chứa mảng PL1 và PL2
});
const DataModel = mongoose.model('HospitalData', DataSchema);

// --- 2. CẤU HÌNH LƯU TRỮ FILE EXCEL GỐC ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        // Tự động tạo thư mục uploads nếu chưa có
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Lưu file kèm mốc thời gian để không trùng lặp
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fieldSize: 100 * 1024 * 1024 } // Cho phép dữ liệu JSON lên tới 100MB
});

// --- 3. CẤU HÌNH MIDDLEWARE ---
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// --- 4. CÁC ĐƯỜNG DẪN API ---

// API: Lấy dữ liệu từ Cloud về trình duyệt
app.get('/api/data', async (req, res) => {
    try {
        const result = await DataModel.findOne({ id: "hospital_main_db" });
        res.json(result ? result.currentData : { PL1: [], PL2: [] });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi tải dữ liệu từ Cloud" });
    }
});

// API: Nhận file Excel gốc và lưu dữ liệu đã xử lý lên Cloud
app.post('/api/upload-and-save', upload.single('fileExcel'), async (req, res) => {
    try {
        const processedData = JSON.parse(req.body.database);
        
        // Lưu hoặc cập nhật dữ liệu trên MongoDB
        await DataModel.findOneAndUpdate(
            { id: "hospital_main_db" },
            { currentData: processedData },
            { upsert: true, new: true }
        );

        console.log(`[${new Date().toLocaleTimeString()}] Đã đồng bộ dữ liệu lên Cloud.`);
        res.json({ message: "Dữ liệu đã được bảo vệ vĩnh viễn trên MongoDB Atlas!" });
    } catch (error) {
        console.error("Lỗi lưu trữ:", error);
        res.status(500).json({ message: "Lỗi hệ thống: " + error.message });
    }
});

// Trang chính
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Khởi chạy Server
app.listen(PORT, () => {
    console.log("==================================================");
    console.log("🏥 HỆ THỐNG QUẢN LÝ QUY TRÌNH - BV ĐK KHÁNH HÒA");
    console.log(`📡 Server đang chạy tại: http://localhost:${PORT}`);
    console.log("==================================================");
});