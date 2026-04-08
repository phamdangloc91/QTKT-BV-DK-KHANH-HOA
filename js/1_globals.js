var currentTab = 'PL1';
var currentTabType = 'QTKT'; 
var database = { PL1: [], PL2: [], GiaDV: [], MaDVBV: [], depts: [] };
var currentFilteredData = [];
var currentUser = null;
var targetUpload = { ma: null, tenKhoa: null }; 
var isMultiSelectMode = false; 
var selectedTechniques = []; 
var plKeywords = [];
var selectedGiaDV = []; 

// 🟢 THÊM MỚI: QUẢN LÝ CỘT HIỂN THỊ TÙY CHỌN
var defaultColumns = ['col_stt', 'col_ma', 'col_chuong', 'col_ten', 'col_phanloai', 'col_quyetdinh', 'col_file', 'col_action'];
var currentSelectedColumns = [...defaultColumns];
var MAX_COLUMNS = 9;

var DANH_SACH_KHOA = [
    "Khoa Cấp cứu", "Khoa Hồi sức Tích cực và Chống độc", "Khoa Nội Tổng hợp Thần kinh",
    "Khoa Nội Cán bộ", "Khoa Nhi", "Khoa Ngoại Tổng quát", "Khoa Ngoại Thần kinh", "Khoa Ngoại Cột sống",
    "Khoa Phẫu thuật - Gây mê Hồi sức", "Khoa Phụ Sản", "Khoa Tai Mũi Họng", "Khoa Mắt", "Khoa Răng Hàm Mặt",
    "Khoa Vật lý Trị liệu - Phục hồi Chức năng", "Khoa Y học Cổ truyền", "Khoa Ngoại Tiết niệu", 
    "Khoa Đột quỵ", "Khoa Huyết học - Truyền máu", "Khoa Hóa sinh", "Khoa Vi sinh - Ký sinh trùng", 
    "Khoa Chẩn đoán Hình ảnh", "Khoa Giải phẫu bệnh", "Khoa Kiểm soát Nhiễm khuẩn", "Khoa Dược", 
    "Khoa Dinh dưỡng", "Khoa Nội Tim mạch Lão học", "Khoa Tim mạch Can thiệp", "Khoa Ngoại Lồng ngực",
    "Trung tâm Chấn thương Chỉnh hình và Bỏng", "Trung tâm Dịch vụ Y tế"
]; 

window.encodeForJS = function(str) {
    if (!str) return '';
    return encodeURIComponent(String(str)).replace(/'/g, "%27").replace(/"/g, "%22");
};

window.safeStr = function(val) { 
    if (val === null || val === undefined) return '';
    return String(val).toLowerCase().trim(); 
};

window.robustNormalize = function(t) { 
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

window.robustNormalizeHeader = function(t) {
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

window.isValidForCrossLink = function(maTuongDuong) {
    if (!maTuongDuong) return false;
    let str = String(maTuongDuong).replace(/,/g, '.').trim();
    let parts = str.split('.');
    return parts.length > 2;
};

window.formatStrictCode = function(code) {
    if (code === undefined || code === null || code === '') return ''; 
    return String(code).replace(/,/g, '.').replace(/\s+/g, '').toLowerCase();
};

window.normalizeSingleCode = function(singleCode) {
    if (!singleCode) return '';
    let parts = singleCode.split('.');
    if (parts.length >= 2) {
        let part1 = parts[0];
        let part2 = parts[1];
        if (/^\d+$/.test(part1)) part1 = parseInt(part1, 10).toString();
        if (/^\d+$/.test(part2)) part2 = parseInt(part2, 10).toString();
        return part1 + '.' + part2;
    }
    if (/^\d+$/.test(singleCode)) return parseInt(singleCode, 10).toString();
    return singleCode;
};

window.normalizeCodeFast = function(code) {
    if (!code) return ''; 
    let strCode = window.formatStrictCode(code);
    let arr = strCode.split(/;|\/|\|/).filter(Boolean);
    let normArr = arr.map(c => window.normalizeSingleCode(c));
    return normArr.join(';');
};

window.isCodeMatch = function(maTuongDuong, targetMa) { 
    if (!maTuongDuong || !targetMa) return false;
    let m1 = window.normalizeCodeFast(maTuongDuong);
    let m2 = window.normalizeCodeFast(targetMa);
    if (m1 === m2) return true;
    
    let arr1 = m1.split(';').filter(Boolean);
    let arr2 = m2.split(';').filter(Boolean);
    for (let a of arr1) {
        for (let b of arr2) {
            if (a === b) return true;
        }
    }
    return false;
};

window.isStrictCodeMatch = function(ma1, ma2) {
    if (!ma1 || !ma2) return false;
    let m1 = window.formatStrictCode(ma1);
    let m2 = window.formatStrictCode(ma2);
    if (m1 === m2) return true;
    
    let arr1 = m1.split(/;|\/|\|/).filter(Boolean);
    let arr2 = m2.split(/;|\/|\|/).filter(Boolean);
    for (let a of arr1) {
        for (let b of arr2) {
            if (a === b) return true;
        }
    }
    return false;
};

// 🟢 THUẬT TOÁN TRUNG TÂM KIỂM TRA MÀU SẮC (Dùng chung cho cả Lọc và Hiển thị)
window.checkColorStatus = function(maHienThi, tenItem) {
    let isHasBHYT = false; let isHasBV = false;
    let arrSearch = window.normalizeCodeFast(maHienThi).split(';').filter(Boolean);
    
    if (arrSearch.length > 0) {
        if (Array.isArray(database.GiaDV)) {
            let normCheckTen = window.robustNormalize(tenItem || "");
            isHasBHYT = database.GiaDV.some(g => {
                if (!window.isValidForCrossLink(g.maTuongDuong)) return false;
                return arrSearch.some(m => window.isCodeMatch(g.maTuongDuong, m)) || (normCheckTen && window.robustNormalize(g.tenKyThuat) === normCheckTen);
            });
        }
        if (Array.isArray(database.MaDVBV)) {
            isHasBV = database.MaDVBV.some(b => {
                if (!window.isValidForCrossLink(b.maTuongDuong)) return false;
                return arrSearch.some(m => window.isCodeMatch(b.maTuongDuong, m));
            });
        }
    }
    
    if (isHasBHYT && isHasBV) return 'blue';    // Đã có cả hai
    if (isHasBHYT) return 'yellow';             // Chỉ có BHYT
    return 'white';                             // Trắng (Không có gì)
};

window.timKhoaChinhXac = function(rawName) {
    if (!rawName) return null; let normRaw = window.robustNormalize(rawName);
    let directMatch = DANH_SACH_KHOA.find(function(k) { return window.robustNormalize(k) === normRaw || normRaw.includes(window.robustNormalize(k)) || window.robustNormalize(k).includes(normRaw); });
    if (directMatch) return directMatch;
    const tuDienKhoa = { "Trung tâm Chấn thương Chỉnh hình và Bỏng": ["chan thuong", "chinh hinh", "ctch", "bong", "ngoai chan thuong"], "Khoa Hồi sức Tích cực và Chống độc": ["hoi suc tich cuc", "chong doc", "hstc", "icu", "tich cuc"], "Khoa Phẫu thuật - Gây mê Hồi sức": ["phau thuat", "gay me", "gmhs", "ptgmhs", "phong mo"], "Khoa Vật lý Trị liệu - Phục hồi Chức năng": ["vat ly tri lieu", "phuc hoi chuc nang", "vltl", "phcn"], "Khoa Nội Tổng hợp Thần kinh": ["noi tong hop", "noi than kinh", "noi thtk"], "Khoa Nội Tim mạch Lão học": ["tim mach lao hoc", "noi tim mach"], "Khoa Vi sinh - Ký sinh trùng": ["vi sinh", "ky sinh trung"] };
    for (let dept in tuDienKhoa) { let keywords = tuDienKhoa[dept]; for (let i = 0; i < keywords.length; i++) { if (normRaw.includes(keywords[i])) return dept; } }
    let rawWords = normRaw.replace(/khoa|trung tam|phong|benh vien|bv/g, "").split(/\s+/).filter(function(w) { return w.length > 1; });
    let bestMatch = null; let maxScore = 0;
    DANH_SACH_KHOA.forEach(function(dept) {
        let deptWords = window.robustNormalize(dept).replace(/khoa|trung tam|phong/g, "").split(/\s+/); let score = 0;
        rawWords.forEach(function(w) { if (deptWords.includes(w)) score++; });
        let isRawNgoai = rawWords.includes("ngoai"); let isRawNoi = rawWords.includes("noi");
        let isDeptNgoai = deptWords.includes("ngoai"); let isDeptNoi = deptWords.includes("noi");
        if ((isRawNgoai && !isDeptNgoai) || (!isRawNgoai && isDeptNgoai)) score -= 2;
        if ((isRawNoi && !isDeptNoi) || (!isRawNoi && isDeptNoi)) score -= 2;
        if (score > maxScore && score >= 2) { maxScore = score; bestMatch = dept; }
    });
    return bestMatch;
}

window.plOrderMap = new Map();

window.buildOrderMap = function() {
    window.plOrderMap.clear();
    if (Array.isArray(database.PL1)) {
        database.PL1.forEach(function(item, index) {
            if (!item) return;
            let maRaw = item.ma || item.maLienKet || "";
            if (maRaw) {
                let mArr = window.normalizeCodeFast(maRaw).split(';').filter(Boolean);
                mArr.forEach(m => { if (!window.plOrderMap.has('ma_' + m)) window.plOrderMap.set('ma_' + m, index); });
            }
            let ten = window.robustNormalize(item.ten);
            if (ten && !window.plOrderMap.has('ten_' + ten)) window.plOrderMap.set('ten_' + ten, index);
        });
    }
    if (Array.isArray(database.PL2)) {
        database.PL2.forEach(function(item, index) {
            if (!item) return;
            let base = 100000 + index;
            let maRaw = item.ma || item.maLienKet || "";
            if (maRaw) {
                let mArr = window.normalizeCodeFast(maRaw).split(';').filter(Boolean);
                mArr.forEach(m => { if (!window.plOrderMap.has('ma_' + m)) window.plOrderMap.set('ma_' + m, base); });
            }
            let ten = window.robustNormalize(item.ten);
            if (ten && !window.plOrderMap.has('ten_' + ten)) window.plOrderMap.set('ten_' + ten, base);
        });
    }
};

window.getOrderIndex = function(qt) {
    if (!qt) return 9999999;
    let qtMa = window.normalizeCodeFast(qt.ma || qt.maLienKet).split(';').filter(Boolean)[0];
    let qtName = window.robustNormalize(qt.ten);

    if (qtMa && window.plOrderMap.has('ma_' + qtMa)) return window.plOrderMap.get('ma_' + qtMa);
    if (qtName && window.plOrderMap.has('ten_' + qtName)) return window.plOrderMap.get('ten_' + qtName);
    return 9999999;
};

window.moModal = function(id) { let m = document.getElementById(id); if(m) m.style.display = 'flex'; }
window.dongModal = function(id) { let m = document.getElementById(id); if(m) m.style.display = 'none'; }
window.showLoading = function(status) { let ld = document.getElementById('loading'); if(ld) ld.style.display = status ? 'flex' : 'none'; }

window.toggleQDDrodown = function(e) {
    e.stopPropagation(); let opts = document.getElementById('optionsQD');
    if(opts) opts.style.display = opts.style.display === 'block' ? 'none' : 'block';
}

// 🟢 THÊM MỚI: Bật tắt Dropdown của Cột
window.toggleColDropdown = function(e) {
    e.stopPropagation(); let opts = document.getElementById('optionsCol');
    if(opts) opts.style.display = opts.style.display === 'block' ? 'none' : 'block';
}

window.addEventListener('click', function(e) {
    let msQD = document.getElementById('multiSelectQD'); let optQD = document.getElementById('optionsQD');
    if (msQD && !msQD.contains(e.target) && optQD) optQD.style.display = 'none';

    let msCol = document.getElementById('multiSelectCol'); let optCol = document.getElementById('optionsCol');
    if (msCol && !msCol.contains(e.target) && optCol) optCol.style.display = 'none';
});

window.addEventListener('DOMContentLoaded', function() {
    const optGroupKhoa = document.getElementById('optGroupKhoa'); const menuCacKhoa = document.getElementById('menuCacKhoa');
    DANH_SACH_KHOA.forEach(function(khoa) {
        if (optGroupKhoa) { const opt = document.createElement('option'); opt.value = opt.textContent = khoa; optGroupKhoa.appendChild(opt); }
        if(menuCacKhoa) {
            const wrapper = document.createElement('div'); wrapper.className = 'dept-item';
            const title = document.createElement('div'); title.className = 'dept-title'; title.innerHTML = `${khoa} <span style="font-size:10px; color:#888;">▶</span>`;
            const submenu = document.createElement('div'); submenu.className = 'dept-submenu';
            const linkQTKT = document.createElement('a'); linkQTKT.href = "#"; linkQTKT.innerText = "Quy trình kỹ thuật"; linkQTKT.onclick = function(e) { e.preventDefault(); window.switchTab(khoa, 'QTKT'); };
            const linkNhanLuc = document.createElement('a'); linkNhanLuc.href = "#"; linkNhanLuc.innerText = "Nhân lực"; linkNhanLuc.onclick = function(e) { e.preventDefault(); alert("Chức năng [Nhân lực] đang được phát triển!"); };
            const linkVatTu = document.createElement('a'); linkVatTu.href = "#"; linkVatTu.innerText = "Vật tư - Trang thiết bị"; linkVatTu.onclick = function(e) { e.preventDefault(); alert("Chức năng [Vật tư - Trang thiết bị] đang được phát triển!"); };
            const trainWrapper = document.createElement('div'); trainWrapper.className = 'train-item';
            const trainTitle = document.createElement('div'); trainTitle.className = 'train-title'; trainTitle.innerHTML = `Kế hoạch đào tạo <span style="font-size:10px; color:#888;">▶</span>`;
            const trainSubmenu = document.createElement('div'); trainSubmenu.className = 'train-submenu';
            const linkDaiHan = document.createElement('a'); linkDaiHan.href = "#"; linkDaiHan.innerText = "Dài hạn"; linkDaiHan.onclick = function(e) { e.preventDefault(); alert("Chức năng [Đào tạo Dài hạn] đang được phát triển!"); };
            const linkNganHan = document.createElement('a'); linkNganHan.href = "#"; linkNganHan.innerText = "Ngắn hạn"; linkNganHan.onclick = function(e) { e.preventDefault(); window.switchTab(khoa, 'DTNH'); };
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
            if (parsedUser && parsedUser.tenKhoa) { currentUser = parsedUser; window.capNhatGiaoDienSauDangNhap(); } else { localStorage.removeItem('hospital_user'); }
        } else { localStorage.removeItem('hospital_user'); }
    } catch(e) { localStorage.removeItem('hospital_user'); } 
    if (window.layDuLieu) window.layDuLieu(); 
};