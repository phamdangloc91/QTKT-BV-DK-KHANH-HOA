window.onerror = function(msg, url, lineNo, columnNo, error) {
    alert("⚠️ HỆ THỐNG PHÁT HIỆN LỖI TRÌNH DUYỆT:\n\n" + msg + "\n\nDòng lỗi: " + lineNo + "\nCột: " + columnNo + "\n\nXin vui lòng chụp màn hình này gửi cho đội ngũ kỹ thuật.");
    return false;
};

let currentTab = 'PL1';
let currentTabType = 'QTKT'; 
let database = { PL1: [], PL2: [], GiaDV: [], MaDVBV: [], depts: [] };
let currentFilteredData = [];
let currentUser = null;
let targetUpload = { ma: null, tenKhoa: null }; 
let isMultiSelectMode = false; 
let selectedTechniques = []; 
let plKeywords = [];
let selectedGiaDV = []; 

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

const encodeForJS = function(str) {
    if (!str) return '';
    return encodeURIComponent(String(str)).replace(/'/g, "%27").replace(/"/g, "%22");
};

const safeStr = function(val) { 
    if (val === null || val === undefined) return '';
    return String(val).toLowerCase().trim(); 
};

const robustNormalize = function(t) { 
    if (t === null || t === undefined) return '';
    let s = String(t).toLowerCase().replace(/\n/g," ").replace(/\r/g,"").replace(/\(.*\)/g,"").trim(); 
    return s.replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
            .replace(/[èéẹẻẽêềếệểễ]/g, "e")
            .replace(/[ìíịỉĩ]/g, "i")
            .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
            .replace(/[ùúụủũưừứựửữ]/g, "u")
            .replace(/[ỳýỵỷỹ]/g, "y")
            .replace(/đ/g, "d")
            .replace(/\s+/g, " ");
};

const robustNormalizeHeader = function(t) {
    if (t === null || t === undefined) return '';
    let s = String(t).toLowerCase().replace(/[\n\r]/g,"").trim();
    return s.replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
            .replace(/[èéẹẻẽêềếệểễ]/g, "e")
            .replace(/[ìíịỉĩ]/g, "i")
            .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
            .replace(/[ùúụủũưừứựửữ]/g, "u")
            .replace(/[ỳýỵỷỹ]/g, "y")
            .replace(/đ/g, "d");
};

function normalizeCodeFast(code) {
    if (!code) return ''; let strCode = String(code); let parts = strCode.split('.');
    if (parts.length >= 2) { let a = parseInt(parts[0], 10); let b = parseInt(parts[1], 10); if (!isNaN(a) && !isNaN(b)) return a + '.' + b; }
    return strCode.trim();
}

function isCodeMatch(maTuongDuong, targetMa) { return normalizeCodeFast(maTuongDuong) === normalizeCodeFast(targetMa); }

function timKhoaChinhXac(rawName) {
    if (!rawName) return null; let normRaw = robustNormalize(rawName);
    let directMatch = DANH_SACH_KHOA.find(function(k) { return robustNormalize(k) === normRaw || normRaw.includes(robustNormalize(k)) || robustNormalize(k).includes(normRaw); });
    if (directMatch) return directMatch;
    const tuDienKhoa = { "Trung tâm Chấn thương Chỉnh hình và Bỏng": ["chan thuong", "chinh hinh", "ctch", "bong", "ngoai chan thuong"], "Khoa Hồi sức Tích cực và Chống độc": ["hoi suc tich cuc", "chong doc", "hstc", "icu", "tich cuc"], "Khoa Phẫu thuật - Gây mê Hồi sức": ["phau thuat", "gay me", "gmhs", "ptgmhs", "phong mo"], "Khoa Vật lý Trị liệu - Phục hồi Chức năng": ["vat ly tri lieu", "phuc hoi chuc nang", "vltl", "phcn"], "Khoa Nội Tổng hợp Thần kinh": ["noi tong hop", "noi than kinh", "noi thtk"], "Khoa Nội Tim mạch Lão học": ["tim mach lao hoc", "noi tim mach"], "Khoa Vi sinh - Ký sinh trùng": ["vi sinh", "ky sinh trung"] };
    for (let dept in tuDienKhoa) { let keywords = tuDienKhoa[dept]; for (let i = 0; i < keywords.length; i++) { if (normRaw.includes(keywords[i])) return dept; } }
    let rawWords = normRaw.replace(/khoa|trung tam|phong|benh vien|bv/g, "").split(/\s+/).filter(function(w) { return w.length > 1; });
    let bestMatch = null; let maxScore = 0;
    DANH_SACH_KHOA.forEach(function(dept) {
        let deptWords = robustNormalize(dept).replace(/khoa|trung tam|phong/g, "").split(/\s+/); let score = 0;
        rawWords.forEach(function(w) { if (deptWords.includes(w)) score++; });
        let isRawNgoai = rawWords.includes("ngoai"); let isRawNoi = rawWords.includes("noi");
        let isDeptNgoai = deptWords.includes("ngoai"); let isDeptNoi = deptWords.includes("noi");
        if ((isRawNgoai && !isDeptNgoai) || (!isRawNgoai && isDeptNgoai)) score -= 2;
        if ((isRawNoi && !isDeptNoi) || (!isRawNoi && isDeptNoi)) score -= 2;
        if (score > maxScore && score >= 2) { maxScore = score; bestMatch = dept; }
    });
    return bestMatch;
}

function getOrderIndex(qt) {
    if(!qt) return 9999999;
    let qtMa = normalizeCodeFast(qt.ma || qt.maLienKet);
    let qtName = robustNormalize(qt.ten);

    if (qtMa) {
        for(let i=0; i<database.PL1.length; i++) {
            if (database.PL1[i] && (normalizeCodeFast(database.PL1[i].ma) === qtMa || normalizeCodeFast(database.PL1[i].maLienKet) === qtMa)) return i;
        }
        for(let i=0; i<database.PL2.length; i++) {
            if (database.PL2[i] && (normalizeCodeFast(database.PL2[i].ma) === qtMa || normalizeCodeFast(database.PL2[i].maLienKet) === qtMa)) return 100000 + i;
        }
    }
    if (qtName) {
        for(let i=0; i<database.PL1.length; i++) { if (database.PL1[i] && robustNormalize(database.PL1[i].ten) === qtName) return i; }
        for(let i=0; i<database.PL2.length; i++) { if (database.PL2[i] && robustNormalize(database.PL2[i].ten) === qtName) return 100000 + i; }
    }
    return 9999999;
}

function moModal(id) { let m = document.getElementById(id); if(m) m.style.display = 'flex'; }
function dongModal(id) { let m = document.getElementById(id); if(m) m.style.display = 'none'; }
function showLoading(status) { let ld = document.getElementById('loading'); if(ld) ld.style.display = status ? 'flex' : 'none'; }

function toggleQDDrodown(e) {
    e.stopPropagation(); let opts = document.getElementById('optionsQD');
    if(opts) opts.style.display = opts.style.display === 'block' ? 'none' : 'block';
}

window.addEventListener('click', function(e) {
    let multiSelect = document.getElementById('multiSelectQD'); let opts = document.getElementById('optionsQD');
    if (multiSelect && !multiSelect.contains(e.target) && opts) opts.style.display = 'none';
});

window.addEventListener('DOMContentLoaded', function() {
    const optGroupKhoa = document.getElementById('optGroupKhoa'); const menuCacKhoa = document.getElementById('menuCacKhoa');
    DANH_SACH_KHOA.forEach(function(khoa) {
        if (optGroupKhoa) { const opt = document.createElement('option'); opt.value = opt.textContent = khoa; optGroupKhoa.appendChild(opt); }
        if(menuCacKhoa) {
            const wrapper = document.createElement('div'); wrapper.className = 'dept-item';
            const title = document.createElement('div'); title.className = 'dept-title'; title.innerHTML = `${khoa} <span style="font-size:10px; color:#888;">▶</span>`;
            const submenu = document.createElement('div'); submenu.className = 'dept-submenu';
            const linkQTKT = document.createElement('a'); linkQTKT.href = "#"; linkQTKT.innerText = "Quy trình kỹ thuật"; linkQTKT.onclick = function(e) { e.preventDefault(); switchTab(khoa, 'QTKT'); };
            const linkNhanLuc = document.createElement('a'); linkNhanLuc.href = "#"; linkNhanLuc.innerText = "Nhân lực"; linkNhanLuc.onclick = function(e) { e.preventDefault(); alert("Chức năng [Nhân lực] đang được phát triển!"); };
            const linkVatTu = document.createElement('a'); linkVatTu.href = "#"; linkVatTu.innerText = "Vật tư - Trang thiết bị"; linkVatTu.onclick = function(e) { e.preventDefault(); alert("Chức năng [Vật tư - Trang thiết bị] đang được phát triển!"); };
            const trainWrapper = document.createElement('div'); trainWrapper.className = 'train-item';
            const trainTitle = document.createElement('div'); trainTitle.className = 'train-title'; trainTitle.innerHTML = `Kế hoạch đào tạo <span style="font-size:10px; color:#888;">▶</span>`;
            const trainSubmenu = document.createElement('div'); trainSubmenu.className = 'train-submenu';
            const linkDaiHan = document.createElement('a'); linkDaiHan.href = "#"; linkDaiHan.innerText = "Dài hạn"; linkDaiHan.onclick = function(e) { e.preventDefault(); alert("Chức năng [Đào tạo Dài hạn] đang được phát triển!"); };
            const linkNganHan = document.createElement('a'); linkNganHan.href = "#"; linkNganHan.innerText = "Ngắn hạn"; linkNganHan.onclick = function(e) { e.preventDefault(); switchTab(khoa, 'DTNH'); };
            trainSubmenu.appendChild(linkDaiHan); trainSubmenu.appendChild(linkNganHan); trainWrapper.appendChild(trainTitle); trainWrapper.appendChild(trainSubmenu);
            submenu.appendChild(linkQTKT); submenu.appendChild(linkNhanLuc); submenu.appendChild(linkVatTu); submenu.appendChild(trainWrapper);
            wrapper.appendChild(title); wrapper.appendChild(submenu); menuCacKhoa.appendChild(wrapper);
        }
    });
}); 

window.onload = function() {
    try {
        const savedUser = localStorage.getItem('hospital_user');
        if (savedUser && savedUser !== "null" && savedUser !== "undefined") { 
            let parsedUser = JSON.parse(savedUser); 
            if (parsedUser && parsedUser.tenKhoa) { currentUser = parsedUser; capNhatGiaoDienSauDangNhap(); } else { localStorage.removeItem('hospital_user'); }
        } else { localStorage.removeItem('hospital_user'); }
    } catch(e) { localStorage.removeItem('hospital_user'); } layDuLieu(); 
};