const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Thiết lập cổng: Ưu tiên cổng của hệ thống (khi deploy) hoặc cổng 3000 (chạy local)
const PORT = process.env.PORT || 3000;

// Cấu hình Middleware
// Cho phép nhận dữ liệu JSON với dung lượng lớn (lên tới 50MB)
app.use(express.json({ limit: '50mb' }));
// Cấu hình phục vụ các file tĩnh (html, js, css) trong thư mục hiện tại
app.use(express.static(path.join(__dirname)));

// Đường dẫn đến file cơ sở dữ liệu
const DB_FILE = path.join(__dirname, 'database.json');

/**
 * API 1: Lấy dữ liệu từ Server
 * Trình duyệt sẽ gọi máy chủ này khi vừa mở trang index.html
 */
app.get('/api/data', (req, res) => {
    try {
        // Kiểm tra nếu file chưa tồn tại thì tạo mới với cấu trúc rỗng
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { PL1: [], PL2: [] };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            return res.json(initialData);
        }
        
        // Đọc dữ liệu từ file và gửi về trình duyệt
        const rawData = fs.readFileSync(DB_FILE, 'utf8');
        res.json(JSON.parse(rawData));
    } catch (error) {
        console.error("Lỗi khi đọc file:", error);
        res.status(500).json({ message: "Không thể đọc dữ liệu từ Server" });
    }
});

/**
 * API 2: Lưu dữ liệu xuống Server
 * Trình duyệt sẽ gọi máy chủ này sau khi bạn Import file Excel thành công
 */
app.post('/api/data', (req, res) => {
    try {
        const data = req.body;
        // Ghi dữ liệu vào file database.json với định dạng dễ đọc (indent 2)
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        
        console.log(`[${new Date().toLocaleTimeString()}] Đã cập nhật database.json`);
        res.json({ message: "Dữ liệu đã được lưu an toàn trên Server!" });
    } catch (error) {
        console.error("Lỗi khi ghi file:", error);
        res.status(500).json({ message: "Lỗi hệ thống: Không thể lưu file" });
    }
});

/**
 * Điều hướng trang chính
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Khởi động máy chủ
app.listen(PORT, () => {
    console.log("==================================================");
    console.log("🚀 SERVER BV ĐK KHÁNH HÒA ĐANG VẬN HÀNH");
    console.log(`📡 Local: http://localhost:${PORT}`);
    console.log(`📁 File lưu trữ: ${DB_FILE}`);
    console.log("==================================================");
});