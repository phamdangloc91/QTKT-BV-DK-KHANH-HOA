window.moModalBatch = function() {
    if (selectedTechniques.length === 0) return alert("Vui lòng tick chọn ít nhất 1 kỹ thuật trong bảng!");
    document.getElementById('lblBatchCount').innerText = selectedTechniques.length;
    window.moModal('uploadBatchModal');
}

window.xuLyUploadBatch = async function() {
    const fQD = document.getElementById('fQuyetDinhBatch').files[0]; 
    const fBB = document.getElementById('fBienBanBatch').files[0];
    
    if (!fQD && !fBB) return alert("Bạn phải chọn ít nhất 1 file để tải lên!");
    
    window.showLoading(true);
    try {
        const formData = new FormData(); 
        formData.append('items', JSON.stringify(selectedTechniques));
        if (fQD) formData.append('fQuyetDinh', fQD); 
        if (fBB) formData.append('fBienBan', fBB);
        
        const res = await fetch('/api/upload/batch-qdbb', { method: 'POST', body: formData }); 
        const data = await res.json(); 
        alert(data.message);
        
        if (res.ok) { 
            window.dongModal('uploadBatchModal'); 
            document.getElementById('fQuyetDinhBatch').value = ''; 
            document.getElementById('fBienBanBatch').value = ''; 
            window.toggleMultiSelect(false); 
            window.layDuLieu(); 
        }
    } catch(e) { 
        alert("Lỗi tải file!"); 
    } 
    window.showLoading(false);
}

window.chuanBiNopKhoa = function(encodedMa) { 
    let ma = decodeURIComponent(encodedMa || "");
    targetUpload = { ma: ma, tenKhoa: currentUser.tenKhoa }; 
    document.getElementById('fileNopKhoa').click(); 
}

window.xuLyNopFileKhoa = async function() {
    const fileInput = document.getElementById('fileNopKhoa'); 
    if (!fileInput.files[0]) return; 
    
    try {
        let mapNames = JSON.parse(localStorage.getItem('fileNamesMap') || '{}');
        mapNames[targetUpload.ma] = fileInput.files[0].name;
        localStorage.setItem('fileNamesMap', JSON.stringify(mapNames));
    } catch(e) {}

    window.showLoading(true);
    try {
        const formData = new FormData(); 
        formData.append('fileQuyTrinh', fileInput.files[0]); 
        formData.append('tenKhoa', targetUpload.tenKhoa); 
        formData.append('maQuyTrinh', targetUpload.ma);
        formData.append('tenFileKhoa', fileInput.files[0].name); 
        
        const res = await fetch('/api/upload/khoa', { method: 'POST', body: formData }); 
        const data = await res.json(); 
        alert(data.message); 
        if (res.ok) window.layDuLieu();
    } catch(e) { 
        alert("Lỗi khi tải file lên!"); 
    } 
    fileInput.value = ''; 
    window.showLoading(false);
}

window.xoaFileKhoa = async function(encodedMa) {
    if(!confirm("Xác nhận GỠ file đính kèm này để nộp lại file khác?")) return;
    let ma = decodeURIComponent(encodedMa || "");
    
    window.showLoading(true);
    try {
        try {
            let mapNames = JSON.parse(localStorage.getItem('fileNamesMap') || '{}');
            delete mapNames[ma];
            localStorage.setItem('fileNamesMap', JSON.stringify(mapNames));
        } catch(e){}

        const res = await fetch('/api/dept-data/status', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ tenKhoa: currentUser.tenKhoa, maQuyTrinh: ma, action: 'RESUBMIT' }) 
        });
        
        if (res.ok) { 
            await window.layDuLieu(); 
        } else {
            alert("Có lỗi xảy ra khi gỡ file!");
        }
    } catch(e) { 
        console.error(e);
        alert("Lỗi kết nối khi thao tác!"); 
    } 
    window.showLoading(false);
}

window.chuanBiUpSinglePdf = function(encodedMa, tenKhoa, encodedTenQuyTrinh) {
    let ma = decodeURIComponent(encodedMa || "");
    let tenQuyTrinh = decodeURIComponent(encodedTenQuyTrinh || "");
    window.dongModal('detailModal'); 
    window.dongModal('detailDVModal');
    targetUpload = { ma: ma, tenKhoa: tenKhoa };
    document.getElementById('lblTenQuyTrinhUpload').innerText = tenQuyTrinh; 
    window.moModal('uploadSinglePdfModal');
}

window.xuLyUploadSinglePdf = async function() {
    const fPDF = document.getElementById('fPdfChinhThuc').files[0]; 
    if (!fPDF) return alert("Vui lòng chọn file PDF!"); 
    
    window.showLoading(true);
    try {
        const formData = new FormData(); 
        formData.append('tenKhoa', targetUpload.tenKhoa); 
        formData.append('maQuyTrinh', targetUpload.ma); 
        formData.append('fPdf', fPDF);
        
        const res = await fetch('/api/upload/final-pdf', { method: 'POST', body: formData }); 
        const data = await res.json(); 
        alert(data.message); 
        
        if (res.ok) { 
            window.dongModal('uploadSinglePdfModal'); 
            document.getElementById('fPdfChinhThuc').value = ''; 
            window.layDuLieu(); 
        }
    } catch(e) { 
        alert("Lỗi khi tải file lên!"); 
    } 
    window.showLoading(false);
}

window.thayDoiTrangThai = async function(tenKhoa, encodedMa, action) {
    let ma = decodeURIComponent(encodedMa || "");
    let msg = "Xác nhận thao tác này?";
    if (action === 'REJECT_KHOA') msg = "Xác nhận HỦY bài nộp này và trả về cho Khoa sửa lại?";
    if (action === 'REVERT_FINAL') msg = "Xác nhận HỦY PHÊ DUYỆT? File PDF chính thức sẽ bị gỡ bỏ khỏi hệ thống!";
    if (action === 'RESUBMIT') msg = "Xác nhận GỠ file hiện tại để nộp lại file khác?";
    
    if (!confirm(msg)) return; 
    window.showLoading(true);
    try {
        const res = await fetch('/api/dept-data/status', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ tenKhoa: tenKhoa, maQuyTrinh: ma, action: action }) 
        });
        if (res.ok) await window.layDuLieu(); 
        else alert("Có lỗi xảy ra!"); 
    } catch(e) { 
        alert("Lỗi mạng!"); 
    } 
    window.showLoading(false);
}

window.bocQuyTrinh = async function(encodedMa, encodedTen) {
    if(!currentUser || currentUser.role !== 'khoa') return;
    let ma = decodeURIComponent(encodedMa || "");
    let ten = decodeURIComponent(encodedTen || "");
    let qtInfo = null;
    
    if (ma) {
        if(Array.isArray(database.PL1)) { qtInfo = database.PL1.find(function(x) { return x && (window.isCodeMatch(x.ma, ma) || window.isCodeMatch(x.maLienKet, ma)); }); }
        if(!qtInfo && Array.isArray(database.PL2)) { qtInfo = database.PL2.find(function(x) { return x && (window.isCodeMatch(x.ma, ma) || window.isCodeMatch(x.maLienKet, ma)); }); }
    }
    
    if (!qtInfo && ten) {
        let normTen = window.robustNormalize(ten);
        if(Array.isArray(database.PL2)) { qtInfo = database.PL2.find(function(x) { return x && window.robustNormalize(x.ten) === normTen; }); }
        if(!qtInfo && Array.isArray(database.PL1)) { qtInfo = database.PL1.find(function(x) { return x && window.robustNormalize(x.ten) === normTen; }); }
    }

    if(!qtInfo) return alert("Không tìm thấy thông tin kỹ thuật!");
    
    let myDept = database.depts.find(function(d) { return d && d.tenKhoa === currentUser.tenKhoa; });
    if (myDept) {
        let newQt = JSON.parse(JSON.stringify(qtInfo)); newQt.trangThai = "CHUA_NOP";
        if (!Array.isArray(myDept.danhMucQTKT)) myDept.danhMucQTKT = [];
        myDept.danhMucQTKT.push(newQt);
    }
    window.apDungLoc(); 

    try { fetch('/api/dept-data/add', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ tenKhoa: currentUser.tenKhoa, quyTrinh: qtInfo }) }); } catch(e) { console.error(e); }
}

window.xoaQuyTrinh = async function(encodedMa, tenKhoa, encodedTen) {
    if(!confirm("Xác nhận xóa kỹ thuật này khỏi danh sách khoa?")) return;
    let ma = decodeURIComponent(encodedMa || "");
    let ten = decodeURIComponent(encodedTen || "");
    let targetDept = database.depts.find(function(d) { return d && d.tenKhoa === tenKhoa; });
    
    if (targetDept && Array.isArray(targetDept.danhMucQTKT)) {
        targetDept.danhMucQTKT = targetDept.danhMucQTKT.filter(function(qt) { 
            if (!qt) return false;
            if (ma) return !(window.isCodeMatch(qt.ma, ma) || window.isCodeMatch(qt.maLienKet, ma));
            if (ten) return window.robustNormalize(qt.ten) !== window.robustNormalize(ten);
            return true;
        });
    }
    window.apDungLoc(); 

    try { fetch('/api/dept-data/remove', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ tenKhoa: tenKhoa, maQuyTrinh: ma, tenQuyTrinh: ten }) }); } catch(e) { console.error(e); }
}

window.saveDTNH = async function() {
    let selectNamDT = document.getElementById('filterNamDT'); const selectedYear = selectNamDT ? selectNamDT.value : "";
    if (!selectedYear) return alert("Vui lòng chọn Năm đào tạo!");
    
    let savedData = []; let rows = document.getElementById('dataBody').rows; let currentGroupId = 0;
    let cNoiDung="", cThoiGian="", cCNS="", cNHS="", cKTV="", cDD="", cBS="", cDonVi="", cKinhPhi="";
    
    for (let i = 0; i < rows.length; i++) {
        let cells = rows[i].cells; if(!cells || cells.length === 0) continue; let kyThuat = "";
        if (cells.length > 2) {
            currentGroupId++;
            cNoiDung = cells[1].querySelector('.editable-cell') ? cells[1].querySelector('.editable-cell').innerText.trim() : "";
            kyThuat = cells[2].querySelector('.editable-cell') ? cells[2].querySelector('.editable-cell').innerText.trim() : "";
            cThoiGian = cells[3].querySelector('.editable-cell') ? cells[3].querySelector('.editable-cell').innerText.trim() : "";
            cCNS = cells[4].querySelector('.editable-cell') ? cells[4].querySelector('.editable-cell').innerText.trim() : "";
            cNHS = cells[5].querySelector('.editable-cell') ? cells[5].querySelector('.editable-cell').innerText.trim() : "";
            cKTV = cells[6].querySelector('.editable-cell') ? cells[6].querySelector('.editable-cell').innerText.trim() : "";
            cDD = cells[7].querySelector('.editable-cell') ? cells[7].querySelector('.editable-cell').innerText.trim() : "";
            cBS = cells[8].querySelector('.editable-cell') ? cells[8].querySelector('.editable-cell').innerText.trim() : "";
            cDonVi = cells[9].querySelector('.editable-cell') ? cells[9].querySelector('.editable-cell').innerText.trim() : "";
            cKinhPhi = cells[10].querySelector('.editable-cell') ? cells[10].querySelector('.editable-cell').innerText.trim() : "";
        } else { kyThuat = cells[0].querySelector('.editable-cell') ? cells[0].querySelector('.editable-cell').innerText.trim() : ""; }
        if (!cNoiDung && !kyThuat) continue;
        savedData.push({ groupId: currentGroupId, nam: selectedYear, noiDung: cNoiDung, kyThuat: kyThuat, thoiGian: cThoiGian, cns: cCNS, nhs: cNHS, ktv: cKTV, dd: cDD, bs: cBS, donVi: cDonVi, kinhPhi: cKinhPhi });
    }

    let payloadByKhoa = {}; payloadByKhoa[currentTab] = savedData;
    window.showLoading(true);
    try {
        const response = await fetch('/api/upload-dtnh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: payloadByKhoa, year: selectedYear }) }); 
        const result = await response.json(); alert("✅ Đã lưu chỉnh sửa thành công!"); await window.layDuLieu(); 
    } catch (error) { alert("Lỗi lưu dữ liệu."); console.error(error); } finally { window.showLoading(false); }
}

window.importFromExcel = async function() { 
    const fileInput = document.getElementById('fileExcel'); 
    const file = fileInput.files[0]; 
    if (!file) return; 

    if (currentTabType === 'DTNH') {
        const selectedYear = document.getElementById('filterNamDT').value;
        if (!selectedYear) {
            alert("⚠️ VUI LÒNG CHỌN [NĂM ĐÀO TẠO] Ở THANH TÌM KIẾM PHÍA TRÊN TRƯỚC KHI TẢI FILE LÊN!");
            fileInput.value = ''; return;
        }
    }

    window.showLoading(true); 
    
    setTimeout(() => {
        const reader = new FileReader(); 
        reader.onload = async function(e) { 
            try { 
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }); 
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                
                const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }); 
                
                if (currentTabType === 'DTNH') {
                    // Logic DTNH cũ
                    const selectedYear = document.getElementById('filterNamDT').value;
                    let headerRowIndex = -1;
                    
                    for (let i = 0; i < Math.min(1000, rawData.length); i++) {
                        let rowData = rawData[i]; 
                        if (!rowData || rowData.length === 0) continue;
                        let rowStr = rowData.map(function(c){ return window.safeStr(c); }).join(" ");
                        if (rowStr.includes("nội dung đào tạo") && (rowStr.includes("kĩ thuật") || rowStr.includes("kỹ thuật"))) {
                            headerRowIndex = i; 
                            break;
                        }
                    }

                    if (headerRowIndex === -1) { 
                        alert("Không tìm thấy dòng Tiêu đề chuẩn. Hãy đảm bảo file Excel theo đúng Mẫu đăng ký!"); 
                        window.showLoading(false); 
                        return; 
                    }

                    let colKhoa = -1, colNoiDung = -1, colKyThuat = -1, colThoiGian = -1, colDonVi = -1, colKinhPhi = -1;
                    let colCNSH = -1, colNHS = -1, colKTV = -1, colDD = -1, colBS = -1;

                    let headRow1 = rawData[headerRowIndex].map(window.robustNormalizeHeader);
                    let headRow2 = (headerRowIndex + 1 < rawData.length) ? rawData[headerRowIndex + 1].map(window.robustNormalizeHeader) : [];

                    headRow1.forEach(function(k, idx) {
                        if (!k) return;
                        if (k === "khoa") colKhoa = idx;
                        if (k.includes("nội dung đào tạo")) colNoiDung = idx;
                        if (k.includes("kĩ thuật cụ thể") || k.includes("kỹ thuật cụ thể")) colKyThuat = idx;
                        if (k.includes("thời gian")) colThoiGian = idx;
                        if (k.includes("đơn vị chủ trì")) colDonVi = idx;
                        if (k.includes("kinh phí")) colKinhPhi = idx;
                    });

                    headRow2.forEach(function(k, idx) {
                        if (!k) return;
                        if (k.includes("sinh học") || k.includes("cử nhân")) colCNSH = idx;
                        if (k.includes("hộ sinh") || k.includes("nhs")) colNHS = idx;
                        if (k === "ktv" || k.includes("kỹ thuật viên")) colKTV = idx;
                        if (k === "đd" || k.includes("điều dưỡng")) colDD = idx;
                        if (k === "bs" || k.includes("bác sĩ")) colBS = idx;
                    });

                    let parsedDataByKhoa = {};
                    let currentKhoaInFile = ""; 
                    
                    let currentNoiDung = "", currentThoiGian = "", currentDonVi = "", currentKinhPhi = "";
                    let currentCNSH = "", currentNHS = "", currentKTV = "", currentDD = "", currentBS = "";
                    let currentGroupId = 0;

                    for (let i = headerRowIndex + 2; i < rawData.length; i++) {
                        let rowData = rawData[i]; 
                        if (!rowData || rowData.length === 0) continue;
                        
                        let tenKhoaRaw = rowData[colKhoa];
                        if (tenKhoaRaw && String(tenKhoaRaw).trim() !== "") { 
                            currentKhoaInFile = window.robustNormalize(String(tenKhoaRaw)); 
                        }
                        if (!currentKhoaInFile) continue;

                        let matchedKhoa = window.timKhoaChinhXac(currentKhoaInFile);
                        if (!matchedKhoa) continue; 
                        
                        if (currentUser.role !== 'admin' && matchedKhoa !== currentTab) continue;

                        let noiDung = rowData[colNoiDung];
                        let kyThuat = rowData[colKyThuat];
                        
                        if (noiDung && String(noiDung).trim() !== "") {
                            currentGroupId++;
                            currentNoiDung = noiDung;
                            currentThoiGian = rowData[colThoiGian] || "";
                            currentDonVi = rowData[colDonVi] || "";
                            currentKinhPhi = rowData[colKinhPhi] || "";
                            currentCNSH = rowData[colCNSH] || "";
                            currentNHS = rowData[colNHS] || "";
                            currentKTV = rowData[colKTV] || "";
                            currentDD = rowData[colDD] || "";
                            currentBS = rowData[colBS] || "";
                        } else if (!kyThuat || String(kyThuat).trim() === "") {
                            continue; 
                        }

                        if (!parsedDataByKhoa[matchedKhoa]) {
                            parsedDataByKhoa[matchedKhoa] = [];
                        }
                        
                        parsedDataByKhoa[matchedKhoa].push({
                            groupId: currentGroupId,
                            nam: selectedYear,
                            noiDung: currentNoiDung,
                            kyThuat: kyThuat || "",
                            thoiGian: currentThoiGian,
                            donVi: currentDonVi,
                            kinhPhi: currentKinhPhi,
                            cns: currentCNSH,
                            nhs: currentNHS,
                            ktv: currentKTV,
                            dd: currentDD,
                            bs: currentBS
                        });
                    }

                    const response = await fetch('/api/upload-dtnh', { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ payload: parsedDataByKhoa, year: selectedYear }) 
                    }); 
                    const result = await response.json(); 
                    alert(result.message); 
                    await window.layDuLieu(); 
                } 
                else {
                    let headerRowIndex = -1; 
                    let headers = [];
                    for (let i = 0; i < Math.min(20, rawData.length); i++) {
                        let rowStr = rawData[i].map(function(c){ return window.robustNormalize(c); }).join(" ");
                        
                        // 🟢 CẬP NHẬT TRÍ THÔNG MINH NHẬN DIỆN CỘT TỰ ĐỘNG
                        if (rowStr.includes("ma dich vu") || rowStr.includes("ma ky thuat") || rowStr.includes("ma tuong duong") || 
                            rowStr.includes("ten ky thuat") || rowStr.includes("ma benh") || rowStr.includes("disease name") || 
                            rowStr.includes("ten benh") || rowStr.includes("ten chan doan") || rowStr.includes("ma icd") || 
                            rowStr.includes("stt chuong") || (rowStr.includes("ma") && rowStr.includes("ten"))) 
                        {
                            headerRowIndex = i; 
                            headers = rawData[i].map(window.robustNormalizeHeader); 
                            break;
                        }
                    }

                    if (headerRowIndex === -1) { 
                        alert("Không tìm thấy dòng Tiêu đề chuẩn. Hãy đảm bảo file Excel/CSV đúng định dạng có cột Mã và Tên!"); 
                        window.showLoading(false); 
                        return; 
                    }

                    let parsedData = [];
                    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                        let rowData = rawData[i]; 
                        if (!rowData || rowData.length === 0) continue; 
                        let item = {}; 
                        let hasData = false;

                        headers.forEach(function(k, colIndex) { 
                            if (!k) return; 
                            let v = rowData[colIndex]; 
                            if (v !== undefined && v !== null && v !== "") hasData = true;
                            
                            let kn = window.robustNormalizeHeader(k);
                            let formatCode = function(val) {
                                if (val === undefined || val === null || val === "") return val;
                                return String(val).replace(/,/g, '.').trim();
                            };

                            if (currentTab === 'GiaDV') {
                                if (kn.includes("ky thuat") || kn.includes("ki thuat") || kn.includes("ten ky thuat")) { item.tenKyThuat = v; }
                                else if (kn.includes("dich vu") || kn.includes("dv bhyt") || kn.includes("ten dich vu")) { item.tenDichVu = v; }
                                else if (kn.includes("ma tuong duong") || kn.includes("ma td")) { item.maTuongDuong = formatCode(v); }
                                else if (kn.includes("muc gia") || kn.includes("gia phe duyet") || kn.includes("gia")) { item.giaMax = v; }
                                else if (kn.includes("ghi chu")) { item.ghiChu = v; }
                            } else if (currentTab === 'MaDVBV') {
                                if (kn === "ma dich vu" || kn.includes("ma dich vu") || kn.includes("ma_dichvu")) item.maDichVu = formatCode(v);
                                if (kn === "ma tuong duong" || kn.includes("ma tuong duong") || kn.includes("ma_tuongduong")) item.maTuongDuong = formatCode(v);
                                if (kn === "ten dich vu" || kn.includes("ten dich vu") || kn.includes("ten_dichvu")) item.tenDichVu = v;
                                if (kn === "gia bhyt" || kn.includes("gia bhyt") || kn.includes("gia_bhyt")) item.giaBHYT = v;
                                if (kn === "gia vien phi" || kn.includes("gia vien phi") || kn.includes("gia_vienphi")) item.giaVienPhi = v;
                                if (kn === "gia yeu cau" || kn.includes("gia yeu cau") || kn.includes("gia_yeucau")) item.giaYeuCau = v;
                                if (kn === "gia nuoc ngoai" || kn.includes("gia nuoc ngoai") || kn.includes("gia_nuocngoai")) item.giaNuocNgoai = v;
                            } 
                            // 🟢 MAP CHÍNH XÁC 21 CỘT DỮ LIỆU ICD-10
                            else if (currentTab === 'ICD10') {
                                if (kn === "stt chuong" || kn.includes("stt chương")) item.sttChuong = v;
                                else if (kn === "ma chuong" || kn.includes("mã chương")) item.maChuong = v;
                                else if (kn === "chapter name") item.chapterName = v;
                                else if (kn === "ten chuong" || kn.includes("tên chương")) item.tenChuong = v;
                                else if (kn === "ma nhom chinh" || kn.includes("mã nhóm chính")) item.maNhomChinh = v;
                                else if (kn === "main group name i") item.mainGroupNameI = v;
                                else if (kn === "ten nhom chinh" || kn.includes("tên nhóm chính")) item.tenNhomChinh = v;
                                else if (kn === "ma nhom phu 1" || kn.includes("mã nhóm phụ 1")) item.maNhomPhu1 = v;
                                else if (kn === "sub group name i") item.subGroupNameI = v;
                                else if (kn === "ten nhom phu 1" || kn.includes("tên nhóm phụ 1")) item.tenNhomPhu1 = v;
                                else if (kn === "ma nhom phu 2" || kn.includes("mã nhóm phụ 2")) item.maNhomPhu2 = v;
                                else if (kn === "sub group name ii") item.subGroupNameII = v;
                                else if (kn === "ten nhom phu 2" || kn.includes("tên nhóm phụ 2")) item.tenNhomPhu2 = v;
                                else if (kn === "ma loai" || kn.includes("mã loại")) item.maLoai = v;
                                else if (kn === "type name") item.typeName = v;
                                else if (kn === "ten loai" || kn.includes("tên loại")) item.tenLoai = v;
                                else if (kn === "ma benh" || kn.includes("mã bệnh") || kn === "mã") item.maBenh = formatCode(v);
                                else if (kn === "ma benh khong dau" || kn.includes("không dấu")) item.maBenhKhongDau = formatCode(v);
                                else if (kn === "disease name") item.diseaseName = v;
                                else if (kn === "ten benh" || kn.includes("tên bệnh") || kn.includes("chẩn đoán") || kn.includes("tiếng việt") || kn === "ten") item.tenBenh = v;
                                else if (kn === "ghi chu" || kn.includes("ghi chú")) item.ghiChu = v;
                            }
                            else {
                                if (kn.includes("ma ky thuat") || kn.includes("ma ki thuat") || kn === "ma") item.ma = formatCode(v); 
                                if (kn.includes("stt cua chuong") || kn === "machuong") item.maChuong = v; 
                                if (kn.includes("ten chuong") || kn === "chuong") item.chuong = v; 
                                if (kn.includes("ma lien ket") || kn === "malienket") item.maLienKet = formatCode(v); 
                                if (kn.includes("ten ky thuat") || kn.includes("ten ki thuat") || kn === "ten") item.ten = v; 
                                if (kn.includes("phan loai") || kn === "phanloai") item.phanLoai = v; 
                                if (kn.includes("quyet dinh") || kn === "quyetdinh") item.quyetDinh = v; 
                            }
                        }); 
                        if (hasData) parsedData.push(item);
                    } 
                    
                    database[currentTab] = parsedData;
                    if (currentTab === 'GiaDV') window.enrichGiaDV(); 
                    
                    const formData = new FormData(); 
                    formData.append('fileExcel', file); 
                    formData.append('tabName', currentTab); 
                    formData.append('tabData', JSON.stringify(database[currentTab])); 
                    const response = await fetch('/api/upload-and-save', { method: 'POST', body: formData }); 
                    const result = await response.json(); 
                    alert(result.message); 
                    window.apDungLoc(); 
                }
            } catch (error) { 
                alert("Lỗi xử lý file! Vui lòng kiểm tra định dạng."); 
                console.error(error); 
            } finally { 
                fileInput.value = ''; 
                window.showLoading(false); 
            } 
        }; 
        reader.readAsArrayBuffer(file); 
    }, 50); 
}

window.exportToExcel = function() { 
    if (!currentFilteredData || currentFilteredData.length === 0) { alert("Không có dữ liệu để xuất!"); return; }

    window.showLoading(true);

    setTimeout(() => {
        const isDeptTab = DANH_SACH_KHOA.includes(currentTab);
        const isSuperTab = currentTab.startsWith('KHTH_');

        let wb = XLSX.utils.book_new();

        if (currentTab === 'KHTH_CHUA_AP_GIA') {
            let excelData = [
                ["DANH SÁCH QUY TRÌNH KỸ THUẬT CHƯA ÁP MÃ DỊCH VỤ BỆNH VIỆN"],
                ["(Trích xuất từ Hệ thống Quản lý QTKT - Bệnh viện Đa khoa Khánh Hòa)"],
                [],
                ["STT", "MÃ KỸ THUẬT", "TÊN CHƯƠNG", "TÊN KỸ THUẬT", "MÃ TƯƠNG ĐƯƠNG", "TÊN DỊCH VỤ BHYT"]
            ];
            
            currentFilteredData.forEach(function(item, index) {
                if(!item) return;
                excelData.push([
                    index + 1,
                    item.ma || item.maLienKet || "",
                    item.chuong || "",
                    item.ten || "",
                    item.tt23_ma || "",
                    item.tt23_ten || "Chưa có trong TT23"
                ]);
            });

            let wsChuaApGia = XLSX.utils.aoa_to_sheet(excelData);
            wsChuaApGia['!merges'] = [
                { s: {r:0, c:0}, e: {r:0, c:5} },
                { s: {r:1, c:0}, e: {r:1, c:5} }
            ];
            wsChuaApGia['!cols'] = [{wch: 5}, {wch: 15}, {wch: 30}, {wch: 50}, {wch: 15}, {wch: 50}];
            XLSX.utils.book_append_sheet(wb, wsChuaApGia, "ChuaApGia");
            XLSX.writeFile(wb, `QTKT_ChuaApGia_${new Date().getTime()}.xlsx`);
            window.showLoading(false);
            return;
        }
        
        if (currentTabType === 'DTNH') {
            let filterNamEl = document.getElementById('filterNamDT');
            const selectedYear = filterNamEl ? filterNamEl.value : "202X";
            let excelData = [
                [`KẾ HOẠCH ĐÀO TẠO PHÁT TRIỂN CHUYÊN MÔN KỸ THUẬT NĂM ${selectedYear}`],
                [`Khoa: ${currentTab.toUpperCase()}`],
                [],
                ["STT", "Nội dung đào tạo", "Kỹ thuật cụ thể", "Thời gian", "CN.SH", "NHS", "KTV", "ĐD", "BS", "Đơn vị chủ trì", "Kinh phí (Tr)"]
            ];

            let merges = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }
            ];

            let prevGroupId = null;
            let sttCounterExport = 1;
            let startRowIndex = -1;

            currentFilteredData.forEach(function(item, idx) {
                if(!item) return;
                let isFirst = item.groupId !== prevGroupId;
                let currentRowExcel = excelData.length;

                if (isFirst) {
                    if (prevGroupId !== null && (currentRowExcel - 1) > startRowIndex) {
                        [0, 1, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function(colIdx) {
                            merges.push({ s: { r: startRowIndex, c: colIdx }, e: { r: currentRowExcel - 1, c: colIdx } });
                        });
                    }
                    prevGroupId = item.groupId;
                    startRowIndex = currentRowExcel;

                    excelData.push([
                        sttCounterExport++,
                        item.noiDung || "",
                        item.kyThuat || "",
                        item.thoiGian || "",
                        item.cns || "",
                        item.nhs || "",
                        item.ktv || "",
                        item.dd || "",
                        item.bs || "",
                        item.donVi || "",
                        item.kinhPhi || ""
                    ]);
                } else {
                    excelData.push(["", "", item.kyThuat || "", "", "", "", "", "", "", "", ""]);
                }

                if (idx === currentFilteredData.length - 1) {
                    if (excelData.length - 1 > startRowIndex) {
                        [0, 1, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function(colIdx) {
                            merges.push({ s: { r: startRowIndex, c: colIdx }, e: { r: excelData.length - 1, c: colIdx } });
                        });
                    }
                }
            });

            let wsDtnh = XLSX.utils.aoa_to_sheet(excelData);
            wsDtnh['!merges'] = merges;
            wsDtnh['!cols'] = [{wch: 5}, {wch: 35}, {wch: 40}, {wch: 15}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 8}, {wch: 25}, {wch: 15}];
            XLSX.utils.book_append_sheet(wb, wsDtnh, "DaoTaoNganHan");
            XLSX.writeFile(wb, `KeHoachDaoTao_${currentTab.replace(/ /g, '_')}_${selectedYear}.xlsx`);
            window.showLoading(false);
            return;
        }

        const cleanData = [];
        let checkedBoxesGiaDV = [...selectedGiaDV]; 

        currentFilteredData.forEach(function(item, index) {
            if(!item) return;
            
            if (currentTab === 'GiaDV') {
                let uniqueId = String(item.maTuongDuong || item.tenKyThuat || index);
                if (checkedBoxesGiaDV.length > 0 && !checkedBoxesGiaDV.includes(uniqueId)) return;
                
                let row = { "STT": cleanData.length + 1 };
                row["TÊN KỸ THUẬT"] = item.qt_ten || item.tenKyThuat || "";
                row["TÊN DỊCH VỤ BHYT"] = item.tenDichVu || "";
                row["MÃ TƯƠNG ĐƯƠNG"] = item.maTuongDuong || "";
                row["QUYẾT ĐỊNH"] = item.qt_quyetDinh || "";
                row["MỨC GIÁ (VNĐ)"] = item.giaMax ? Number(item.giaMax) : ""; 
                row["GHI CHÚ"] = item.ghiChu || "";
                cleanData.push(row);
                
            } else if (currentTab === 'MaDVBV') {
                let row = { "STT": cleanData.length + 1 };
                row["MÃ DỊCH VỤ"] = item.maDichVu || "";
                row["MÃ TƯƠNG ĐƯƠNG"] = item.maTuongDuong || "";
                row["TÊN DỊCH VỤ"] = item.tenDichVu || "";
                row["GIÁ BHYT"] = item.giaBHYT ? Number(item.giaBHYT) : "";
                row["GIÁ VIỆN PHÍ"] = item.giaVienPhi ? Number(item.giaVienPhi) : "";
                row["GIÁ YÊU CẦU"] = item.giaYeuCau ? Number(item.giaYeuCau) : "";
                row["GIÁ NƯỚC NGOÀI"] = item.giaNuocNgoai ? Number(item.giaNuocNgoai) : "";
                cleanData.push(row);
            } 
            else if (currentTab === 'ICD10') {
                let row = { "STT": cleanData.length + 1 };
                row["MÃ BỆNH"] = item.maBenh || "";
                row["TÊN BỆNH (VN)"] = item.tenBenh || "";
                row["DISEASE NAME"] = item.diseaseName || "";
                cleanData.push(row);
            }
            else {
                let row = { "STT": cleanData.length + 1 };
                if (isSuperTab) {
                    row["TÊN KHOA"] = item.tenKhoaChuQuan || "";
                    row["MÃ KỸ THUẬT"] = item.ma || item.maLienKet || "";
                    row["TÊN KỸ THUẬT"] = item.ten || "";
                    row["PHÂN LOẠI"] = item.phanLoai || "";
                    row["QUYẾT ĐỊNH"] = item.quyetDinh || "";
                    
                    let ttRaw = item.trangThai || 'CHUA_NOP';
                    let tt = (ttRaw === 'DA_DUYET' || ttRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : ttRaw;
                    if(tt === 'CHO_DUYET') row["TRẠNG THÁI"] = "Chờ KHTH duyệt";
                    else if(tt === 'KHONG_DUYET') row["TRẠNG THÁI"] = "Bị KHTH từ chối";
                    else if(tt === 'DA_PHE_DUYET') row["TRẠNG THÁI"] = "Đã phê duyệt chính thức";
                    else row["TRẠNG THÁI"] = "Chưa nộp";

                } else if (currentTab === 'PL1' || isDeptTab) {
                    row["MÃ KỸ THUẬT"] = item.ma || item.maLienKet || "";
                    row["TÊN CHƯƠNG"] = item.chuong || "";
                    row["TÊN KỸ THUẬT"] = item.ten || "";
                    row["PHÂN LOẠI"] = item.phanLoai || "";
                    row["QUYẾT ĐỊNH"] = item.quyetDinh || "";
                } else { 
                    row["STT CỦA CHƯƠNG"] = item.maChuong || "";
                    row["TÊN CHƯƠNG"] = item.chuong || "";
                    row["MÃ LIÊN KẾT"] = item.maLienKet || "";
                    row["TÊN KỸ THUẬT"] = item.ten || "";
                    row["PHÂN LOẠI"] = item.phanLoai || "";
                    row["QUYẾT ĐỊNH"] = item.quyetDinh || "";
                }
                cleanData.push(row);
            }
        });

        if (cleanData.length === 0) { alert("Không có dữ liệu để xuất!"); window.showLoading(false); return; }

        let wsMain = XLSX.utils.json_to_sheet(cleanData); 
        const colWidths = [];
        const keys = Object.keys(cleanData[0] || {});
        keys.forEach(function(key) {
            let maxLen = key.length; 
            cleanData.forEach(function(row) {
                let val = row[key];
                if (val !== null && val !== undefined) {
                    let len = val.toString().length;
                    if (val.toString().includes('\n')) len = Math.max.apply(null, val.toString().split('\n').map(function(l){ return l.length; }));
                    if (typeof val === 'number') len += 4; 
                    if (len > maxLen) maxLen = len;
                }
            });
            colWidths.push({ wch: Math.min(maxLen + 2, 60) });
        });
        wsMain['!cols'] = colWidths; 

        XLSX.utils.book_append_sheet(wb, wsMain, "Danh_Muc"); 
        let fileName = isDeptTab ? `DanhMuc_${currentTab.replace(/ /g, '_')}.xlsx` : `DanhMuc_${currentTab}.xlsx`; 
        XLSX.writeFile(wb, fileName); 
        window.showLoading(false);
    }, 50);
}