function jumpToPL1(maLienKet) { switchTab('PL1', 'QTKT'); let sBox = document.getElementById('searchBox'); if(sBox) { sBox.value = maLienKet; apDungLoc(); } }

function getAggregatedList(tabName) {
    let result = [];
    if(!database.depts || !Array.isArray(database.depts)) return result;
    database.depts.forEach(function(d) {
        if(!d || !d.danhMucQTKT || !Array.isArray(d.danhMucQTKT)) return;
        d.danhMucQTKT.forEach(function(qt) {
            if(!qt) return; let pushIt = false; let ttRaw = qt.trangThai || 'CHUA_NOP'; let tt = (ttRaw === 'DA_DUYET' || ttRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : ttRaw;
            if (tabName === 'KHTH_CHO_DUYET' && tt === 'CHO_DUYET') pushIt = true;
            if (pushIt) { result.push({ ...qt, tenKhoaChuQuan: d.tenKhoa || "", trangThaiFix: tt }); }
        });
    });
    result.sort(function(a, b) { 
        let deptCmp = String(a.tenKhoaChuQuan || "").localeCompare(String(b.tenKhoaChuQuan || ""));
        if (deptCmp !== 0) return deptCmp;
        return getOrderIndex(a) - getOrderIndex(b);
    }); 
    return result;
}

function prepareKeywords() {
    let validPL = [];
    if(Array.isArray(database.PL1)) validPL = validPL.concat(database.PL1);
    if(Array.isArray(database.PL2)) validPL = validPL.concat(database.PL2);
    validPL = validPL.filter(function(x) { return x && x.ten; });
    plKeywords = validPL.map(function(x) { return { ten: x.ten, words: new Set(robustNormalize(x.ten).split(" ").filter(Boolean)) }; });
}

function getSuggestion(kyThuat) {
    if (!kyThuat) return null; let wordsKT = new Set(robustNormalize(kyThuat).split(" ").filter(Boolean)); if (wordsKT.size === 0) return null;
    let bestMatch = null; let maxScore = 0;
    for (let pl of plKeywords) {
        let intersection = 0; for (let w of wordsKT) { if (pl.words.has(w)) intersection++; }
        let union = wordsKT.size + pl.words.size - intersection; let score = intersection / union;
        if (score > maxScore) { maxScore = score; bestMatch = pl.ten; }
    }
    return (maxScore >= 0.65) ? bestMatch : null; 
}

function acceptSuggestion(btn) {
    let suggestedText = btn.getAttribute('data-suggestion'); let td = btn.closest('td'); let cell = td.querySelector('.editable-cell');
    if(cell) cell.innerText = suggestedText; btn.closest('.suggestion-box').remove();
}

function enrichGiaDV() {
    let qtktMapByCode = new Map();
    let qtktMapByName = new Map();
    
    let addTolist = function(i) {
        if(!i) return;
        let m1 = normalizeCodeFast(i.ma); 
        let m2 = normalizeCodeFast(i.maLienKet);
        let n = robustNormalize(i.ten); 
        
        if (m1 && !qtktMapByCode.has(m1)) qtktMapByCode.set(m1, i);
        if (m2 && !qtktMapByCode.has(m2)) qtktMapByCode.set(m2, i);
        if (n && !qtktMapByName.has(n)) qtktMapByName.set(n, i);
    };
    if(Array.isArray(database.PL1)) database.PL1.forEach(addTolist); 
    if(Array.isArray(database.PL2)) database.PL2.forEach(addTolist);

    if(Array.isArray(database.GiaDV)) {
        database.GiaDV.forEach(function(item) {
            if(!item) return;
            let qtMa = normalizeCodeFast(item.maTuongDuong);
            let qtName = robustNormalize(item.tenKyThuat);
            
            let qtktInfo = null;
            if (qtName && qtktMapByName.has(qtName)) {
                qtktInfo = qtktMapByName.get(qtName);
            } 
            else if (qtMa && qtktMapByCode.has(qtMa)) {
                qtktInfo = qtktMapByCode.get(qtMa);
            }

            item.qt_ten = (qtktInfo && qtktInfo.ten) ? String(qtktInfo.ten) : (item.tenKyThuat ? String(item.tenKyThuat) : "");
            item.qt_phanLoai = (qtktInfo && qtktInfo.phanLoai) ? String(qtktInfo.phanLoai) : "KPL";
            item.qt_quyetDinh = (qtktInfo && qtktInfo.quyetDinh) ? String(qtktInfo.quyetDinh) : "Chưa phê duyệt";
            
            if (!item.maTuongDuong && qtktInfo && (qtktInfo.ma || qtktInfo.maLienKet)) {
                item.maTuongDuong = qtktInfo.ma || qtktInfo.maLienKet;
            }
        });
    }
}

async function layDuLieu() {
    showLoading(true);
    try {
        const resData = await fetch('/api/data'); const mainData = await resData.json(); 
        database.PL1 = (mainData && Array.isArray(mainData.PL1) ? mainData.PL1 : []).filter(Boolean); 
        database.PL2 = (mainData && Array.isArray(mainData.PL2) ? mainData.PL2 : []).filter(Boolean); 
        database.GiaDV = (mainData && Array.isArray(mainData.GiaDV) ? mainData.GiaDV : []).filter(Boolean); 
        database.MaDVBV = (mainData && Array.isArray(mainData.MaDVBV) ? mainData.MaDVBV : []).filter(Boolean); 
        
        const resDepts = await fetch('/api/dept-data'); let rawDepts = await resDepts.json();
        let arrDepts = Array.isArray(rawDepts) ? rawDepts : [];
        database.depts = arrDepts.filter(Boolean).map(function(d) {
            if(d) { d.danhMucQTKT = Array.isArray(d.danhMucQTKT) ? d.danhMucQTKT.filter(Boolean) : []; d.daoTaoNganHan = Array.isArray(d.daoTaoNganHan) ? d.daoTaoNganHan.filter(Boolean) : []; }
            return d;
        });
        
        enrichGiaDV(); 
        prepareKeywords(); apDungLoc(); 
    } catch (error) { console.log("Lỗi khi lấy dữ liệu:", error); }
    showLoading(false);
}

function toggleMultiSelect(state) {
    isMultiSelectMode = state; selectedTechniques = [];
    if (isMultiSelectMode) {
        document.getElementById('btnStartBatch').style.display = 'none'; document.getElementById('btnConfirmBatch').style.display = 'inline-block'; document.getElementById('btnCancelBatch').style.display = 'inline-block';
        document.getElementById('batchStatusText').innerHTML = `<b style="color:var(--danger)">Vui lòng TICK CHỌN các ô vuông trong bảng bên dưới.</b>`;
    } else {
        document.getElementById('btnStartBatch').style.display = 'inline-block'; document.getElementById('btnConfirmBatch').style.display = 'none'; document.getElementById('btnCancelBatch').style.display = 'none';
        document.getElementById('batchStatusText').innerHTML = `<b>Công cụ Admin:</b> Tick chọn các kỹ thuật bên dưới để tải Quyết định & Biên bản hàng loạt.`;
    }
    apDungLoc(); 
}

function toggleSelectRow(checkbox, tenKhoa, ma) {
    if (checkbox.checked) { selectedTechniques.push({ tenKhoa: tenKhoa, maQuyTrinh: ma }); } 
    else { selectedTechniques = selectedTechniques.filter(function(item) { return item && !(item.tenKhoa === tenKhoa && item.maQuyTrinh === ma); }); }
}

function toggleAllGiaDV(source) {
    let checkboxes = document.querySelectorAll('.row-checkbox-giadv');
    checkboxes.forEach(function(cb) { 
        cb.checked = source.checked; 
        let strVal = String(cb.value);
        if (source.checked) { if (!selectedGiaDV.includes(strVal)) selectedGiaDV.push(strVal); } 
        else { selectedGiaDV = selectedGiaDV.filter(function(x) { return x !== strVal; }); }
    });
}

function toggleRowGiaDV(checkbox, val) {
    let strVal = String(val);
    if (checkbox.checked) { if (!selectedGiaDV.includes(strVal)) selectedGiaDV.push(strVal); } 
    else { selectedGiaDV = selectedGiaDV.filter(function(x) { return x !== strVal; }); }
    updateSelectAllGiaDVUI();
}

function updateSelectAllGiaDVUI() {
    let selectAllCb = document.getElementById('selectAllGiaDV'); if (!selectAllCb) return;
    let visibleCheckboxes = document.querySelectorAll('.row-checkbox-giadv');
    if (visibleCheckboxes.length === 0) { selectAllCb.checked = false; return; }
    let allChecked = true;
    for (let i = 0; i < visibleCheckboxes.length; i++) { if (!visibleCheckboxes[i].checked) { allChecked = false; break; } }
    selectAllCb.checked = allChecked;
}

function toggleAllQD(source) {
    let qdCheckboxes = document.querySelectorAll('.qd-checkbox');
    qdCheckboxes.forEach(function(cb) { cb.checked = source.checked; });
    apDungLoc();
}

function renderTable(data = null) {
    try {
        const isDeptTab = DANH_SACH_KHOA.includes(currentTab); const isSuperTab = currentTab.startsWith('KHTH_'); let list = [];
        let canEdit = false;
        if (currentUser && currentUser.role === 'admin') canEdit = true;
        if (currentUser && currentUser.role === 'khoa' && currentUser.tenKhoa === currentTab) canEdit = true;

        if (currentTabType === 'DTNH') {
            if (data) { list = data; } else { 
                let deptObj = null; if(Array.isArray(database.depts)) { deptObj = database.depts.find(function(d) { return d && d.tenKhoa === currentTab; }); }
                list = (deptObj && Array.isArray(deptObj.daoTaoNganHan)) ? deptObj.daoTaoNganHan : []; 
            }
            currentFilteredData = list;
            
            const thead = document.getElementById('tableHead'); const tbody = document.getElementById('dataBody'); let tbodyHtml = '';
            
            let htmlHead = `<tr>
                <th style="width:40px; text-align:center;">STT</th><th style="width:25%">Nội dung đào tạo</th><th style="width:25%">Kỹ thuật cụ thể (Click xem liên kết QTKT)</th><th>Thời gian</th><th style="text-align:center;" title="Cử nhân Sinh học">CN.SH</th><th style="text-align:center;" title="Nữ hộ sinh">NHS</th><th style="text-align:center;" title="Kỹ thuật viên">KTV</th><th style="text-align:center;" title="Điều dưỡng">ĐD</th><th style="text-align:center;" title="Bác sĩ">BS</th><th>Đơn vị chủ trì</th><th style="text-align:right;">Kinh phí (Tr)</th>
            </tr>`;
            thead.innerHTML = htmlHead; 
            
            let sttCounter = 1;
            list.forEach(function(item, index) {
                if(!item) return; let isFirst = false; let rowspan = 1; let prevItem = list[index - 1];
                if (index === 0 || !prevItem || item.groupId !== prevItem.groupId) {
                    isFirst = true;
                    for (let j = index + 1; j < list.length; j++) { if (list[j] && list[j].groupId === item.groupId) rowspan++; else break; }
                }

                let kyThuatHtml = ''; let suggestionHtml = ''; let rawKT = item.kyThuat || '';
                if (rawKT.trim() !== '') {
                    let normName = robustNormalize(rawKT); let matchedQT = null;
                    if(Array.isArray(database.PL1)) { let found = database.PL1.find(function(x) { return x && robustNormalize(x.ten) === normName; }); if(found) matchedQT = found; }
                    if(!matchedQT && Array.isArray(database.PL2)) { let found = database.PL2.find(function(x) { return x && robustNormalize(x.ten) === normName; }); if(found) matchedQT = found; }
                    
                    if (matchedQT) {
                        let safeTen = matchedQT.ten ? String(matchedQT.ten) : ""; 
                        let safePL = matchedQT.phanLoai ? String(matchedQT.phanLoai) : ""; 
                        let safeQD = matchedQT.quyetDinh ? String(matchedQT.quyetDinh) : ""; 
                        let maHienThi = matchedQT.ma || matchedQT.maLienKet || '';
                        
                        kyThuatHtml = `<a href="#" onclick="moChiTiet('${maHienThi}', '${encodeForJS(safeTen)}', '${encodeForJS(safePL)}', '${encodeForJS(safeQD)}')" style="color:var(--info); font-weight:bold; text-decoration:none; border-bottom: 1px dashed var(--info);" title="Bấm để xem chi tiết QTKT liên kết">${rawKT}</a>`;
                    } else {
                        kyThuatHtml = `<span style="color:var(--primary); font-weight:bold;">${rawKT}</span>`;
                        if (canEdit) { let suggested = getSuggestion(rawKT); if (suggested) { let safeSug = String(suggested).replace(/"/g, '&quot;'); suggestionHtml = `<div class="suggestion-box">💡 Ý bạn là: <button class="suggestion-btn" data-suggestion="${safeSug}" onclick="acceptSuggestion(this)">${suggested}</button>?</div>`; } }
                    }
                }

                if (isFirst) {
                    tbodyHtml += `<tr>
                        <td rowspan="${rowspan}" style="text-align:center; font-weight:bold; background-color: white; border-right: 1px solid #eee;">${sttCounter++}</td>
                        <td rowspan="${rowspan}" style="background-color: white; border-right: 1px solid #eee;"><div class="editable-cell" contenteditable="${canEdit}">${item.noiDung || ''}</div></td>
                        <td><div class="editable-cell" contenteditable="${canEdit}">${kyThuatHtml}</div>${suggestionHtml}</td>
                        <td rowspan="${rowspan}" style="background-color: white; text-align:center; border-left: 1px solid #eee; border-right: 1px solid #eee;"><div class="editable-cell" contenteditable="${canEdit}">${item.thoiGian || ''}</div></td>
                        <td rowspan="${rowspan}" style="text-align:center; color:#555; background-color: white; border-right: 1px solid #eee;"><div class="editable-cell" contenteditable="${canEdit}">${item.cns || ''}</div></td>
                        <td rowspan="${rowspan}" style="text-align:center; color:#555; background-color: white; border-right: 1px solid #eee;"><div class="editable-cell" contenteditable="${canEdit}">${item.nhs || ''}</div></td>
                        <td rowspan="${rowspan}" style="text-align:center; color:#555; background-color: white; border-right: 1px solid #eee;"><div class="editable-cell" contenteditable="${canEdit}">${item.ktv || ''}</div></td>
                        <td rowspan="${rowspan}" style="text-align:center; color:#555; background-color: white; border-right: 1px solid #eee;"><div class="editable-cell" contenteditable="${canEdit}">${item.dd || ''}</div></td>
                        <td rowspan="${rowspan}" style="text-align:center; color:red; font-weight:bold; background-color: white; border-right: 1px solid #eee;"><div class="editable-cell" contenteditable="${canEdit}">${item.bs || ''}</div></td>
                        <td rowspan="${rowspan}" style="background-color: white; border-right: 1px solid #eee;"><div class="editable-cell" contenteditable="${canEdit}">${item.donVi || ''}</div></td>
                        <td rowspan="${rowspan}" style="text-align:right; font-weight:bold; color:var(--success); background-color: white;"><div class="editable-cell" contenteditable="${canEdit}">${item.kinhPhi || ''}</div></td>
                    </tr>`;
                } else { tbodyHtml += `<tr><td><div class="editable-cell" contenteditable="${canEdit}">${kyThuatHtml}</div>${suggestionHtml}</td></tr>`; }
            });
            tbody.innerHTML = tbodyHtml; return;
        }

        if (currentTab === 'KHTH_CHUA_AP_GIA') {
            if (!data) return apDungLoc(); currentFilteredData = data; list = data;
            const thead = document.getElementById('tableHead'); const tbody = document.getElementById('dataBody'); let tbodyHtml = '';
            
            let htmlHead = `<tr><th>STT</th><th style="width:10%">Mã kỹ thuật</th><th style="width:15%">Tên chương</th><th>Tên kỹ thuật (Click xem chi tiết)</th><th style="width:10%; text-align:center;">Mã tương đương</th><th style="width:25%">Tên Dịch vụ BHYT</th></tr>`;
            thead.innerHTML = htmlHead; 
            
            list.forEach(function(item, index) {
                if(!item) return;
                let safeTen = item.ten ? String(item.ten) : ""; 
                let safePL = item.phanLoai ? String(item.phanLoai) : ""; 
                let safeQD = item.quyetDinh ? String(item.quyetDinh) : "";
                
                let tenClickable = `<a href="#" onclick="moChiTiet('${item.ma || item.maLienKet || ''}', '${encodeForJS(safeTen)}', '${encodeForJS(safePL)}', '${encodeForJS(safeQD)}')" style="color:var(--info); font-weight:bold; text-decoration:none;">${safeTen}</a>`;
                let td_ma = item.matchedGia && item.matchedGia.length > 0 ? item.matchedGia.map(function(g){ return `<b style="color:#dc3545;">${g.maTuongDuong||''}</b>`; }).join('<br><br>') : '';
                let td_ten = item.matchedGia && item.matchedGia.length > 0 ? item.matchedGia.map(function(g){ return g.tenDichVu || g.tenKyThuat || ''; }).join('<hr style="border:0; border-top:1px dashed #ccc; margin: 4px 0;">') : '<span style="color:#888;">Chưa có trong TT23</span>';
                tbodyHtml += `<tr><td>${index + 1}</td><td><b>${item.ma || item.maLienKet || ''}</b></td><td>${item.chuong || ''}</td><td>${tenClickable}</td><td style="text-align:center; background:#fff3cd;">${td_ma}</td><td style="background:#fff3cd;">${td_ten}</td></tr>`;
            });
            tbody.innerHTML = tbodyHtml; return;
        }

        if (data) { list = data; } else if (isSuperTab) { list = getAggregatedList(currentTab); } else if (isDeptTab) { 
            let deptObj = null; if(Array.isArray(database.depts)) { deptObj = database.depts.find(function(d){ return d && d.tenKhoa === currentTab; }); }
            let rawList = deptObj && Array.isArray(deptObj.danhMucQTKT) ? deptObj.danhMucQTKT : []; 
            list = [...rawList];
            // SẮP XẾP GIỎ HÀNG THEO THỨ TỰ PHỤ LỤC
            list.sort(function(a, b) { return getOrderIndex(a) - getOrderIndex(b); });
        } else { list = Array.isArray(database[currentTab]) ? database[currentTab] : []; }
        currentFilteredData = list;

        const thead = document.getElementById('tableHead'); const tbody = document.getElementById('dataBody');
        let htmlHead = `<tr>`; let tbodyHtml = '';
        
        if (currentTab === 'GiaDV') {
            htmlHead += `<th style="width:40px; text-align:center;"><input type="checkbox" id="selectAllGiaDV" onchange="toggleAllGiaDV(this)"></th>
                         <th>STT</th>
                         <th>Tên kỹ thuật (Click xem chi tiết)</th>
                         <th>Tên dịch vụ BHYT</th>
                         <th style="text-align:center;">Mã tương đương</th>
                         <th style="text-align:center;">Quyết định</th>
                         <th style="text-align:right;">Mức giá</th>
                         <th>Ghi chú</th></tr>`;
            thead.innerHTML = htmlHead; 

            list.forEach(function(item, index) {
                if(!item) return;
                let formattedPrice = item.giaMax ? Number(item.giaMax).toLocaleString('vi-VN') + ' đ' : '';
                let safeTenKT = item.qt_ten || item.tenKyThuat || "";
                let safePL = item.qt_phanLoai || "KPL";
                let safeQD = item.qt_quyetDinh || "Chưa phê duyệt";
                let maPass = item.maTuongDuong || item.tenKyThuat || "";

                let tenClickable = `<a href="#" onclick="moChiTiet('${maPass}', '${encodeForJS(safeTenKT)}', '${encodeForJS(safePL)}', '${encodeForJS(safeQD)}')" style="color:var(--info); font-weight:bold; text-decoration:none;">${safeTenKT}</a>`;
                
                let uniqueId = String(item.maTuongDuong || item.tenKyThuat || index);
                let isChecked = selectedGiaDV.includes(uniqueId) ? "checked" : "";

                tbodyHtml += `<tr>
                    <td style="text-align:center;"><input type="checkbox" class="row-checkbox-giadv" value="${uniqueId}" onchange="toggleRowGiaDV(this, '${uniqueId}')" ${isChecked}></td>
                    <td>${index + 1}</td>
                    <td>${tenClickable}</td>
                    <td>${item.tenDichVu || ''}</td>
                    <td style="text-align:center;"><b>${item.maTuongDuong || ''}</b></td>
                    <td style="text-align:center;"><span class="badge badge-type">${safeQD}</span></td>
                    <td style="color:red; font-weight:bold; text-align:right;">${formattedPrice}</td>
                    <td>${item.ghiChu || ''}</td>
                </tr>`;
            });
            tbody.innerHTML = tbodyHtml;
            updateSelectAllGiaDVUI();
            return;
        }

        if (currentTab === 'MaDVBV') {
            htmlHead += `<th>STT</th><th>Mã dịch vụ</th><th>Mã tương đương</th><th>Tên dịch vụ (Click xem liên kết)</th><th>Giá BHYT</th><th>Giá Viện Phí</th><th>Giá Yêu Cầu</th><th>Giá Nước Ngoài</th></tr>`;
            thead.innerHTML = htmlHead; 
            
            list.forEach(function(item, index) {
                if(!item) return;
                let gBHYT = item.giaBHYT ? Number(item.giaBHYT).toLocaleString('vi-VN') + ' đ' : ''; let gVP = item.giaVienPhi ? Number(item.giaVienPhi).toLocaleString('vi-VN') + ' đ' : ''; let gYC = item.giaYeuCau ? Number(item.giaYeuCau).toLocaleString('vi-VN') + ' đ' : ''; let gNN = item.giaNuocNgoai ? Number(item.giaNuocNgoai).toLocaleString('vi-VN') + ' đ' : '';
                let safeTenDV = item.tenDichVu ? String(item.tenDichVu) : ""; 
                let safeMaTD = item.maTuongDuong ? String(item.maTuongDuong) : ""; 
                let safeMaDV = item.maDichVu ? String(item.maDichVu) : "";
                
                let tenClickable = `<a href="#" onclick="moChiTietDV('${safeMaDV}', '${safeMaTD}', '${encodeForJS(safeTenDV)}')" style="color:var(--info); font-weight:bold; text-decoration:none;">${safeTenDV}</a>`;
                tbodyHtml += `<tr><td>${index + 1}</td><td><b>${item.maDichVu || ''}</b></td><td>${item.maTuongDuong || ''}</td><td>${tenClickable}</td><td style="color:green; text-align:right; font-weight:bold;">${gBHYT}</td><td style="color:blue; text-align:right; font-weight:bold;">${gVP}</td><td style="color:purple; text-align:right; font-weight:bold;">${gYC}</td><td style="color:red; text-align:right; font-weight:bold;">${gNN}</td></tr>`;
            });
            tbody.innerHTML = tbodyHtml; return;
        }

        if (isMultiSelectMode) { htmlHead += `<th style="width:40px; text-align:center;">Chọn</th>`; }
        htmlHead += `<th>STT</th>`;
        
        if (isSuperTab) { htmlHead += `<th>Mã kỹ thuật</th><th>Tên kỹ thuật (Click để xem)</th><th>Phân loại</th><th>Quyết định</th>`; } 
        else if (currentTab === 'PL1' || isDeptTab) { htmlHead += `<th>Mã kỹ thuật</th><th>Tên chương</th><th>Tên kỹ thuật (Click để xem)</th><th>Phân loại</th><th>Quyết định</th>`; } 
        else { htmlHead += `<th>Mã chương</th><th>Tên chương</th><th>Mã liên kết</th><th>Tên kỹ thuật (Click để xem)</th><th>Phân loại</th><th>Quyết định</th>`; }

        let canAddPL = false; let canRemovePL = false; let showFileCol = false;
        if (currentUser && currentUser.role === 'khoa') { if (!isDeptTab && !isSuperTab) canAddPL = true; if (isDeptTab && currentUser.tenKhoa === currentTab) canRemovePL = true; }
        if (currentUser && currentUser.role === 'admin' && isDeptTab) canRemovePL = true; 
        if (isDeptTab || isSuperTab) showFileCol = true; 

        if (showFileCol) { htmlHead += `<th style="width:220px;">Trạng thái & Thao tác</th>`; }
        if (canAddPL || canRemovePL) { htmlHead += `<th style="text-align:center;">Khoa Thêm / Xóa</th>`; }
        htmlHead += `</tr>`; thead.innerHTML = htmlHead;

        let currentKhoaGroup = ""; 
        let myDeptCart = [];
        if (currentUser && currentUser.role === 'khoa') {
            let myDept = null; if(Array.isArray(database.depts)) { myDept = database.depts.find(function(d){ return d && d.tenKhoa === currentUser.tenKhoa; }); }
            if (myDept && Array.isArray(myDept.danhMucQTKT)) myDeptCart = myDept.danhMucQTKT;
        }

        list.forEach(function(item, index) {
            if(!item) return;
            let realTenKhoa = item.tenKhoaChuQuan || currentTab; 
            if (isSuperTab && realTenKhoa !== currentKhoaGroup) {
                currentKhoaGroup = realTenKhoa; let colSpan = isMultiSelectMode ? 10 : 9;
                tbodyHtml += `<tr><td colspan="${colSpan}" style="background-color: #cce5ff; color: #004085; font-weight: bold; padding: 10px 15px; font-size: 14px;">🏥 ${currentKhoaGroup.toUpperCase()}</td></tr>`;
            }

            let maHienThi = item.ma || item.maLienKet || ''; 
            let html = "<tr>";
            if (isMultiSelectMode) {
                let isChecked = selectedTechniques.find(function(x) { return x && x.tenKhoa === realTenKhoa && x.maQuyTrinh === maHienThi; }) ? "checked" : "";
                html += `<td style="text-align:center;"><input type="checkbox" style="width:18px; height:18px; cursor:pointer;" onchange="toggleSelectRow(this, '${realTenKhoa}', '${maHienThi}')" ${isChecked}></td>`;
            }

            let safeTen = item.ten ? String(item.ten) : ""; 
            let safePL = item.phanLoai ? String(item.phanLoai) : ""; 
            let safeQD = item.quyetDinh ? String(item.quyetDinh) : ""; 
            let safeMaLienKet = item.maLienKet ? String(item.maLienKet) : "";
            
            let tenClickable = `<a href="#" onclick="moChiTiet('${maHienThi}', '${encodeForJS(safeTen)}', '${encodeForJS(safePL)}', '${encodeForJS(safeQD)}')" style="color:#0056b3; font-weight:bold; text-decoration:none;">${safeTen}</a>`;

            html += `<td>${index + 1}</td>`;
            if (isSuperTab) { html += `<td><b>${maHienThi}</b></td><td>${tenClickable}</td><td><span class="badge badge-type">${safePL}</span></td><td>${safeQD}</td>`; } 
            else if (currentTab === 'PL1' || isDeptTab) { let textMa = item.ma ? `<b>${item.ma}</b>` : `<span style="color:blue">${item.maLienKet}</span>`; html += `<td>${textMa}</td><td>${item.chuong || ''}</td><td>${tenClickable}</td><td><span class="badge badge-type">${safePL}</span></td><td>${safeQD}</td>`; } 
            else { html += `<td>${item.maChuong || ''}</td><td>${item.chuong || ''}</td><td style="color:blue;cursor:pointer;font-weight:bold" onclick="jumpToPL1('${safeMaLienKet}')">${item.maLienKet || ''}</td><td>${tenClickable}</td><td><span class="badge badge-type">${safePL}</span></td><td>${safeQD}</td>`; }
            
            let ttRaw = item.trangThai || 'CHUA_NOP'; let tt = (ttRaw === 'DA_DUYET' || ttRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : ttRaw; 

            if (showFileCol) {
                let fileHtml = '';
                if(tt === 'DA_PHE_DUYET') {
                    fileHtml += `<span class="badge badge-success" style="font-size:12px; padding:6px 10px;">Final (Đã phê duyệt)</span><br><span style="font-size:12px; color:#555;">(Xem file trong chi tiết)</span>`;
                    if (currentUser && currentUser.role === 'admin' && !isMultiSelectMode) { fileHtml += `<br><button class="btn" style="background:var(--danger); margin-top:5px;" onclick="thayDoiTrangThai('${realTenKhoa}', '${maHienThi}', 'REVERT_FINAL')">🔙 Hủy Phê Duyệt</button>`; }
                } else {
                    if(tt === 'CHUA_NOP') fileHtml += `<span class="badge badge-gray">Chưa nộp</span><br>`; else if(tt === 'CHO_DUYET') fileHtml += `<span class="badge badge-warning">Chờ KHTH duyệt</span><br>`; else if(tt === 'KHONG_DUYET') fileHtml += `<span class="badge badge-danger">Bị KHTH từ chối</span><br>`;

                    if (currentUser && currentUser.role === 'khoa' && currentUser.tenKhoa === currentTab) {
                        if(item.fileKhoa) fileHtml += `<a href="${item.fileKhoa}" target="_blank" style="font-size:12px; color:blue;">📄 Bản nháp đã nộp</a><br>`;
                        if(tt === 'CHUA_NOP') fileHtml += `<button class="btn" style="background:var(--info);" onclick="chuanBiNopKhoa('${maHienThi}')">📤 Nộp file Word</button>`;
                        if(tt === 'KHONG_DUYET') fileHtml += `<button class="btn" style="background:var(--danger);" onclick="thayDoiTrangThai('${realTenKhoa}', '${maHienThi}', 'RESUBMIT')">🔄 Nộp lại</button>`;
                    } 
                    else if (currentUser && currentUser.role === 'admin') {
                        if(item.fileKhoa) fileHtml += `<a href="${item.fileKhoa}" target="_blank" style="font-size:12px; color:blue; margin-right:10px;">📄 Bản Khoa nộp</a>`;
                        if(tt === 'CHO_DUYET' && !isMultiSelectMode) { fileHtml += `<button class="btn" style="background:var(--success);" onclick="chuanBiUpSinglePdf('${maHienThi}', '${realTenKhoa}', '${encodeForJS(safeTen)}')">📥 Tải File Chính Thức (PDF)</button> `; fileHtml += `<button class="btn" style="background:var(--danger);" onclick="thayDoiTrangThai('${realTenKhoa}', '${maHienThi}', 'REJECT_KHOA')">❌ Từ chối</button>`; }
                    }
                }
                html += `<td>${fileHtml}</td>`;
            }
            
            if (canAddPL) { 
                let itemInCart = null;
                if(Array.isArray(myDeptCart)) { itemInCart = myDeptCart.find(function(x) { return x && (isCodeMatch(x.ma, maHienThi) || isCodeMatch(x.maLienKet, maHienThi)); }); }
                if (itemInCart) {
                    let cartStatusRaw = itemInCart.trangThai || 'CHUA_NOP'; let cartStatus = (cartStatusRaw === 'DA_DUYET' || cartStatusRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : cartStatusRaw;
                    if (cartStatus === 'DA_PHE_DUYET') { html += `<td style="text-align:center;"><span class="badge badge-locked">🔒 Đã chốt</span></td>`; } 
                    else { html += `<td style="text-align:center;"><button class="btn btn-remove" onclick="xoaQuyTrinh('${maHienThi}', '${currentUser.tenKhoa}')">🗑️ Xóa</button></td>`; }
                } else {
                    html += `<td style="text-align:center;"><button class="btn btn-add" onclick="bocQuyTrinh('${maHienThi}')">+ Thêm</button></td>`;
                }
            }
            else if (canRemovePL) { 
                if (currentUser.role === 'khoa' && tt === 'DA_PHE_DUYET') { html += `<td style="text-align:center;"><span class="badge badge-locked">🔒 Đã chốt</span></td>`; } 
                else { html += `<td style="text-align:center;"><button class="btn btn-remove" onclick="xoaQuyTrinh('${maHienThi}', '${realTenKhoa}')">🗑️ Xóa</button></td>`; }
            }
            
            html += "</tr>"; tbodyHtml += html;
        });
        
        tbody.innerHTML = tbodyHtml;
        capNhatDanhSachQuyetDinh();
        
    } catch(e) { console.error(e); alert("Lỗi khi tải bảng dữ liệu: " + e.message); }
}

function capNhatTieuDe() {
    const isDeptTab = DANH_SACH_KHOA.includes(currentTab); let textRole = "";
    if(!currentUser) textRole = "(Chế độ Khách - Chỉ Xem)"; else if (currentUser.role === 'admin') textRole = "(Quyền Quản Trị Viên)"; else textRole = `(Quyền: ${currentUser.tenKhoa})`;
    
    const batchToolbar = document.getElementById('batchToolbar');
    if (currentUser && currentUser.role === 'admin' && (currentTab === 'KHTH_CHO_DUYET' || isDeptTab) && currentTabType !== 'DTNH') { 
        if(batchToolbar) batchToolbar.style.display = 'flex'; 
    } else { 
        if(batchToolbar) batchToolbar.style.display = 'none'; 
        isMultiSelectMode = false; 
    } 

    let grpPhanLoai = document.getElementById('groupPhanLoai');
    let grpQuyetDinh = document.getElementById('groupQuyetDinh');
    let grpNamDT = document.getElementById('groupNamDT');

    if(grpPhanLoai) grpPhanLoai.style.display = (currentTabType === 'DTNH' || currentTab === 'GiaDV' || currentTab === 'MaDVBV' || currentTab === 'KHTH_CHUA_AP_GIA') ? 'none' : 'flex';
    if(grpQuyetDinh) grpQuyetDinh.style.display = (currentTabType === 'DTNH' || currentTab === 'MaDVBV' || currentTab === 'KHTH_CHUA_AP_GIA') ? 'none' : 'flex';
    if(grpNamDT) grpNamDT.style.display = currentTabType === 'DTNH' ? 'flex' : 'none';

    if (currentTabType === 'DTNH') {
        document.getElementById('tabTitle').innerText = `KẾ HOẠCH ĐÀO TẠO NGẮN HẠN - ${currentTab.toUpperCase()}`;
        document.getElementById('tabDesc').innerText = `Quản lý kế hoạch cử nhân sự đi học tập nâng cao chuyên môn ${textRole}`;
        document.getElementById('lblSearch').innerText = 'TÌM KIẾM NỘI DUNG HOẶC KỸ THUẬT';
    }
    else if (currentTab === 'KHTH_CHUA_AP_GIA') { document.getElementById('tabTitle').innerText = "QTKT BỆNH VIỆN CHƯA ÁP GIÁ"; document.getElementById('tabDesc').innerText = `Danh sách các Kỹ thuật đã có Quyết định nhưng chưa được gán Mã Dịch vụ BV ${textRole}`; document.getElementById('lblSearch').innerText = 'TÌM KIẾM MÃ KT, TÊN KT, MÃ TĐ, TÊN DV'; }
    else if (currentTab === 'PL1') { document.getElementById('tabTitle').innerText = "DANH MỤC PHỤ LỤC 1"; document.getElementById('tabDesc').innerText = `Hệ thống tra cứu quy trình gốc ${textRole}`; document.getElementById('lblSearch').innerText = 'TÌM KIẾM CHUNG';} 
    else if (currentTab === 'PL2') { document.getElementById('tabTitle').innerText = "DANH MỤC PHỤ LỤC 2"; document.getElementById('tabDesc').innerText = `Hệ thống tra cứu quy trình gốc ${textRole}`; document.getElementById('lblSearch').innerText = 'TÌM KIẾM CHUNG';} 
    else if (currentTab === 'GiaDV') { document.getElementById('tabTitle').innerText = "BẢNG GIÁ DỊCH VỤ"; document.getElementById('tabDesc').innerText = `Thông tư 23/2024 ${textRole}`; document.getElementById('lblSearch').innerText = 'TÌM KIẾM MÃ HOẶC TÊN DỊCH VỤ';} 
    else if (currentTab === 'MaDVBV') { document.getElementById('tabTitle').innerText = "MÃ DỊCH VỤ BỆNH VIỆN"; document.getElementById('tabDesc').innerText = `Bảng giá dịch vụ áp dụng tại Bệnh viện ${textRole}`; document.getElementById('lblSearch').innerText = 'TÌM KIẾM MÃ DV, MÃ TĐ HOẶC TÊN DV';} 
    else if (currentTab === 'KHTH_CHO_DUYET') { document.getElementById('tabTitle').innerText = "DANH MỤC CHỜ DUYỆT - P.KHTH"; document.getElementById('tabDesc').innerText = `Các quy trình khoa đã nộp bản nháp, chờ Admin duyệt ${textRole}`; document.getElementById('lblSearch').innerText = 'TÌM KIẾM CHUNG';}
    else if (currentTab === 'KHTH_NOP_BO') { document.getElementById('tabTitle').innerText = "QTKT CHỜ NỘP BỘ Y TẾ"; document.getElementById('tabDesc').innerText = `Dành cho Quyết định tuyến Trung ương (Đang cập nhật) ${textRole}`; document.getElementById('lblSearch').innerText = 'TÌM KIẾM CHUNG';}
    else if (currentTab === 'KHTH_NOP_SO') { document.getElementById('tabTitle').innerText = "QTKT CHỜ NỘP SỞ Y TẾ"; document.getElementById('tabDesc').innerText = `Dành cho Quyết định tuyến Tỉnh (Đang cập nhật) ${textRole}`; document.getElementById('lblSearch').innerText = 'TÌM KIẾM CHUNG';}
    else { document.getElementById('tabTitle').innerText = `DANH MỤC QTKT - ${currentTab.toUpperCase()}`; if(currentUser && currentUser.role === 'khoa' && currentUser.tenKhoa === currentTab) document.getElementById('tabDesc').innerHTML = `<span style="color:var(--success); font-weight:bold">Không gian làm việc riêng của khoa bạn</span>`; else document.getElementById('tabDesc').innerText = `Bạn đang xem dữ liệu của khoa khác ${textRole}`; document.getElementById('lblSearch').innerText = 'TÌM KIẾM CHUNG';} 
}

function switchTab(tab, type) { 
    if (!type) type = 'QTKT';
    currentTab = tab; currentTabType = type; capNhatTieuDe(); 
    
    let sBox = document.getElementById('searchBox'); if(sBox) sBox.value = ''; 
    let fLoai = document.getElementById('filterLoai'); if(fLoai) fLoai.value = ""; 
    
    let optionsQD = document.getElementById('optionsQD');
    if(optionsQD) {
        let checkboxes = optionsQD.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function(cb) { cb.checked = false; });
        let textSpan = document.getElementById('selectedQDText');
        if(textSpan) textSpan.innerText = "-- Tất cả --";
    }
    
    let fNam = document.getElementById('filterNamDT'); if(fNam) fNam.value = "";
    apDungLoc(); 
}

function apDungLoc() { 
    try {
        const searchEl = document.getElementById('searchBox');
        const search = searchEl ? safeStr(searchEl.value) : '';
        
        let checkedQDs = [];
        let qdCheckboxes = document.querySelectorAll('.qd-checkbox:checked');
        if(qdCheckboxes) {
            for(let i=0; i<qdCheckboxes.length; i++) checkedQDs.push(qdCheckboxes[i].value);
        }
        
        let textSpan = document.getElementById('selectedQDText');
        if(textSpan) {
            if(checkedQDs.length === 0) textSpan.innerText = "-- Tất cả --";
            else if(checkedQDs.length === 1) textSpan.innerText = "1 QĐ được chọn";
            else textSpan.innerText = checkedQDs.length + " QĐ được chọn";
        }
        
        if (currentTabType === 'DTNH') {
            let filterNamEl = document.getElementById('filterNamDT');
            const filterNam = filterNamEl ? filterNamEl.value : "";
            
            let deptObj = null;
            if(Array.isArray(database.depts)) {
                deptObj = database.depts.find(function(d){ return d && d.tenKhoa === currentTab; });
            }
            let sourceList = deptObj && Array.isArray(deptObj.daoTaoNganHan) ? deptObj.daoTaoNganHan : [];
            
            const filtered = sourceList.filter(function(item) {
                if(!item) return false;
                let matchSearch = (safeStr(item.noiDung).includes(search) || safeStr(item.kyThuat).includes(search));
                let matchYear = filterNam === "" || String(item.nam) === String(filterNam);
                return matchSearch && matchYear;
            });
            renderTable(filtered);
            
            let btnSave = document.getElementById('btnSaveDTNH');
            if (btnSave) {
                if (currentUser && (currentUser.role === 'admin' || currentUser.tenKhoa === currentTab)) {
                    btnSave.style.display = 'inline-block';
                } else { 
                    btnSave.style.display = 'none'; 
                }
            }
            return;
        } else { 
            let btnSave = document.getElementById('btnSaveDTNH');
            if(btnSave) btnSave.style.display = 'none'; 
        }

        if (currentTab === 'KHTH_CHUA_AP_GIA') {
            document.getElementById('lblSearch').innerText = 'TÌM KIẾM MÃ KT, TÊN KT, MÃ TĐ, TÊN DV BHYT';
            
            const maDvbvSet = new Set();
            if(Array.isArray(database.MaDVBV)) {
                database.MaDVBV.forEach(function(dv) { 
                    if (dv && dv.maTuongDuong) maDvbvSet.add(normalizeCodeFast(dv.maTuongDuong)); 
                });
            }

            const giaDvByCode = new Map();
            const giaDvByName = new Map();
            
            if(Array.isArray(database.GiaDV)) {
                database.GiaDV.forEach(function(g) {
                    if(!g) return;
                    if (g.maTuongDuong) {
                        let code = normalizeCodeFast(g.maTuongDuong);
                        if (!giaDvByCode.has(code)) giaDvByCode.set(code, []);
                        giaDvByCode.get(code).push(g);
                    }
                    if (g.tenKyThuat) {
                        let name = robustNormalize(g.tenKyThuat);
                        if (!giaDvByName.has(name)) giaDvByName.set(name, []);
                        giaDvByName.get(name).push(g);
                    }
                });
            }

            let sourceList = [];
            if(Array.isArray(database.PL1)) {
                database.PL1.forEach(function(qt) {
                    if(!qt) return;
                    let qdVal = qt.quyetDinh ? safeStr(qt.quyetDinh) : '';
                    if (!qdVal || qdVal.includes('chưa phê duyệt') || qdVal.includes('chua phe duyet')) return; 
                    
                    let normCode = normalizeCodeFast(qt.ma);
                    if (maDvbvSet.has(normCode)) return;

                    let matchedGiaMap = new Map(); 
                    if (giaDvByCode.has(normCode)) { 
                        giaDvByCode.get(normCode).forEach(function(g) { matchedGiaMap.set(g, g); }); 
                    }
                    if (qt.ten) {
                        let normName = robustNormalize(qt.ten);
                        if (giaDvByName.has(normName)) { 
                            giaDvByName.get(normName).forEach(function(g) { matchedGiaMap.set(g, g); }); 
                        }
                    }

                    let matchedGia = Array.from(matchedGiaMap.values());
                    sourceList.push({
                        ...qt,
                        tt23_ma: matchedGia.map(function(g){ return g.maTuongDuong; }).join('\n'),
                        tt23_ten: matchedGia.map(function(g){ return g.tenDichVu || g.tenKyThuat; }).join('\n'),
                        matchedGia: matchedGia
                    });
                });
            }
            
            const filtered = sourceList.filter(function(item) {
                if(!item) return false;
                return (safeStr(item.ma).includes(search) || safeStr(item.ten).includes(search) || safeStr(item.tt23_ma).includes(search) || safeStr(item.tt23_ten).includes(search));
            });
            renderTable(filtered); 
            return;
        }

        if (currentTab === 'MaDVBV') {
            document.getElementById('lblSearch').innerText = 'TÌM KIẾM MÃ DV, MÃ TĐ HOẶC TÊN DV';
            let sourceList = database.MaDVBV;
            if(!Array.isArray(sourceList)) sourceList = [];
            
            const filtered = sourceList.filter(function(item) {
                if(!item) return false;
                let m1 = item.maTuongDuong ? String(item.maTuongDuong).toLowerCase() : "";
                let m3 = item.tenDichVu ? String(item.tenDichVu).toLowerCase() : "";
                let m4 = item.maDichVu ? String(item.maDichVu).toLowerCase() : "";
                return (m4.includes(search) || m1.includes(search) || m3.includes(search));
            });
            renderTable(filtered); 
            return;
        }

        if (currentTab === 'GiaDV') {
            document.getElementById('lblSearch').innerText = 'TÌM KIẾM MÃ HOẶC TÊN DỊCH VỤ';
            let sourceList = database.GiaDV;
            if(!Array.isArray(sourceList)) sourceList = [];
            
            const filtered = sourceList.filter(function(item) {
                if(!item) return false;
                let m1 = item.maTuongDuong ? String(item.maTuongDuong).toLowerCase() : "";
                let m2 = item.qt_ten ? String(item.qt_ten).toLowerCase() : (item.tenKyThuat ? String(item.tenKyThuat).toLowerCase() : "");
                let m3 = item.tenDichVu ? String(item.tenDichVu).toLowerCase() : "";
                
                let matchSearch = (m1.includes(search) || m2.includes(search) || m3.includes(search));
                let matchQD = checkedQDs.length === 0 || checkedQDs.includes(item.qt_quyetDinh);
                
                return matchSearch && matchQD;
            });
            renderTable(filtered); 
            return;
        }

        document.getElementById('lblSearch').innerText = 'TÌM KIẾM CHUNG'; 

        let filterLoaiEl = document.getElementById('filterLoai');
        const loaiSelect = filterLoaiEl ? filterLoaiEl.value : "";
        
        const isDeptTab = DANH_SACH_KHOA.includes(currentTab); 
        const isSuperTab = currentTab.startsWith('KHTH_'); 
        let sourceList = []; 
        
        if (isSuperTab) { 
            sourceList = getAggregatedList(currentTab); 
        } else if (isDeptTab) { 
            let deptObj = null;
            if(Array.isArray(database.depts)) {
                deptObj = database.depts.find(function(d){ return d && d.tenKhoa === currentTab; }); 
            }
            let rawList = deptObj && Array.isArray(deptObj.danhMucQTKT) ? deptObj.danhMucQTKT : []; 
            sourceList = [...rawList];
            sourceList.sort(function(a, b) { return getOrderIndex(a) - getOrderIndex(b); });
        } else { 
            sourceList = Array.isArray(database[currentTab]) ? database[currentTab] : []; 
        } 
        
        const filtered = sourceList.filter(function(item) { 
            if(!item) return false;
            const matchSearch = (safeStr(item.ma).includes(search) || safeStr(item.ten).includes(search) || safeStr(item.tenKhoaChuQuan).includes(search)); 
            
            let qd = item.quyetDinh || "Chưa phê duyệt";
            const matchQD = checkedQDs.length === 0 || checkedQDs.includes(qd);
            
            let matchLoai = true; 
            if (loaiSelect !== "") { 
                const val = item.phanLoai ? String(item.phanLoai).toUpperCase().trim() : ""; 
                if (loaiSelect === "L1") matchLoai = (val === "P1" || val === "T1"); 
                else if (loaiSelect === "L2") matchLoai = (val === "P2" || val === "T2"); 
                else if (loaiSelect === "L3") matchLoai = (val === "P3" || val === "T3"); 
                else if (loaiSelect === "LDB") matchLoai = (val === "PĐB" || val === "TĐB"); 
                else if (loaiSelect === "KPL") matchLoai = (val === "KPL"); 
            } 
            return matchSearch && matchLoai && matchQD; 
        }); 
        
        renderTable(filtered); 
    } catch(e) {
        console.error(e);
        alert("Lỗi khi Lọc Dữ liệu: " + e.message);
    }
}

function capNhatDanhSachQuyetDinh() { 
    if (currentTabType === 'DTNH' || currentTab === 'MaDVBV' || currentTab === 'KHTH_CHUA_AP_GIA') return;
    const optionsContainer = document.getElementById('optionsQD'); 
    if(!optionsContainer) return;
    
    let currentlyChecked = [];
    let qdCheckboxes = document.querySelectorAll('.qd-checkbox:checked');
    if(qdCheckboxes) {
        for(let i=0; i<qdCheckboxes.length; i++) currentlyChecked.push(qdCheckboxes[i].value);
    }

    const isDeptTab = DANH_SACH_KHOA.includes(currentTab); 
    const isSuperTab = currentTab.startsWith('KHTH_'); 
    let sourceList = []; 
    
    if (isSuperTab) {
        sourceList = getAggregatedList(currentTab); 
    } else if (isDeptTab) {
        let foundDept = null;
        if(Array.isArray(database.depts)) {
            foundDept = database.depts.find(function(d){ return d && d.tenKhoa === currentTab; });
        }
        sourceList = foundDept && Array.isArray(foundDept.danhMucQTKT) ? foundDept.danhMucQTKT : []; 
    } else {
        sourceList = Array.isArray(database[currentTab]) ? database[currentTab] : []; 
    }
    
    let fieldName = currentTab === 'GiaDV' ? 'qt_quyetDinh' : 'quyetDinh';

    let validList = sourceList.filter(function(i){ return i && i[fieldName]; });
    const dsQD = [];
    validList.forEach(function(item) {
        let qd = item[fieldName] || "Chưa phê duyệt";
        if(dsQD.indexOf(qd) === -1) dsQD.push(qd);
    });
    
    optionsContainer.innerHTML = ''; 
    
    let lblAll = document.createElement('label');
    lblAll.style.fontWeight = 'bold';
    lblAll.style.borderBottom = '2px solid #ccc';
    lblAll.style.backgroundColor = '#f8f9fa';
    let chkAll = document.createElement('input');
    chkAll.type = 'checkbox';
    chkAll.id = 'selectAllQD';
    chkAll.onchange = function() { toggleAllQD(this); };
    lblAll.appendChild(chkAll);
    lblAll.appendChild(document.createTextNode(" Chọn tất cả"));
    optionsContainer.appendChild(lblAll);

    dsQD.sort().forEach(function(qd) { 
        let lbl = document.createElement('label');
        let chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = qd;
        chk.className = 'qd-checkbox';
        if(currentlyChecked.includes(qd)) chk.checked = true;
        chk.onchange = apDungLoc;
        lbl.appendChild(chk);
        lbl.appendChild(document.createTextNode(" " + qd));
        optionsContainer.appendChild(lbl);
    }); 
    
    let qdBoxes = document.querySelectorAll('.qd-checkbox');
    let allChecked = qdBoxes.length > 0;
    qdBoxes.forEach(function(cb) { if(!cb.checked) allChecked = false; });
    if (chkAll) chkAll.checked = allChecked;

    let textSpan = document.getElementById('selectedQDText');
    if(textSpan) {
        let checkedBoxes = document.querySelectorAll('.qd-checkbox:checked');
        if(checkedBoxes.length === 0) textSpan.innerText = "-- Tất cả --";
        else if(checkedBoxes.length === 1) textSpan.innerText = "1 QĐ được chọn";
        else textSpan.innerText = checkedBoxes.length + " QĐ được chọn";
    }
}

function moChiTietDV(maDichVu, maTuongDuong, encodedTenDichVu) {
    let tenDichVu = decodeURIComponent(encodedTenDichVu || "");
    document.getElementById('dvTenDV').innerText = tenDichVu || ''; 
    document.getElementById('dvMaDV').innerText = maDichVu || '';
    
    let qtMa = normalizeCodeFast(maTuongDuong);
    let qtktInfo = null;
    if(Array.isArray(database.PL1)) { let found = database.PL1.find(function(x){ return x && (isCodeMatch(x.ma, qtMa) || isCodeMatch(x.maLienKet, qtMa)); }); if(found) qtktInfo = found; }
    if(!qtktInfo && Array.isArray(database.PL2)) { let found = database.PL2.find(function(x){ return x && (isCodeMatch(x.ma, qtMa) || isCodeMatch(x.maLienKet, qtMa)); }); if(found) qtktInfo = found; }
                   
    if (!qtktInfo && Array.isArray(database.depts)) { 
        for (let d of database.depts) { 
            if(!d || !Array.isArray(d.danhMucQTKT)) continue;
            let found = d.danhMucQTKT.find(function(x){ return x && (isCodeMatch(x.ma, qtMa) || isCodeMatch(x.maLienKet, qtMa)); }); 
            if (found) { qtktInfo = found; break; } 
        } 
    }

    let qtHtml = '';
    if (qtktInfo) {
        qtHtml = `<table class="user-table" style="width:100%;">
            <tr><td style="background:#f2f2f2; width:30%;"><b>Mã kỹ thuật:</b></td><td>${qtktInfo.ma || qtktInfo.maLienKet || ''}</td></tr>
            <tr><td style="background:#f2f2f2;"><b>Tên QTKT:</b></td><td>${qtktInfo.ten || ''}</td></tr>
            <tr><td style="background:#f2f2f2;"><b>Phân loại:</b></td><td><span class="badge badge-type">${qtktInfo.phanLoai || 'KPL'}</span></td></tr>
            <tr><td style="background:#f2f2f2;"><b>Quyết định:</b></td><td>${qtktInfo.quyetDinh || 'Chưa phê duyệt'}</td></tr>
        </table>`;
    } else { qtHtml = `<span style="color:#856404;">Không tìm thấy Quy trình Kỹ thuật gốc cho mã tương đương này (${maTuongDuong} -> QT: ${qtMa}).</span>`; }
    document.getElementById('dvQTKTArea').innerHTML = qtHtml;

    let giaDVInfo = null;
    if(Array.isArray(database.GiaDV)){ giaDVInfo = database.GiaDV.find(function(x){ return x && isCodeMatch(x.maTuongDuong, maTuongDuong); }); }
    
    let bhytHtml = '';
    if (giaDVInfo) {
        let formattedPrice = giaDVInfo.giaMax ? Number(giaDVInfo.giaMax).toLocaleString('vi-VN') + ' đ' : 'Chưa có giá';
        bhytHtml = `<table class="user-table" style="width:100%;"><tr><td style="background:#f2f2f2; width:30%;"><b>Mã tương đương:</b></td><td>${giaDVInfo.maTuongDuong || ''}</td></tr><tr><td style="background:#f2f2f2;"><b>Tên Dịch vụ BHYT:</b></td><td>${giaDVInfo.tenDichVu || giaDVInfo.tenKyThuat || ''}</td></tr><tr><td style="background:#f2f2f2;"><b>Giá phê duyệt:</b></td><td style="color:red; font-weight:bold;">${formattedPrice}</td></tr></table>`;
    } else { bhytHtml = `<span style="color:#856404;">Không tìm thấy Dịch vụ BHYT (TT23) khớp với mã tương đương này.</span>`; }
    document.getElementById('dvBHYTArea').innerHTML = bhytHtml;

    const tbody = document.getElementById('dvKhoaBody'); tbody.innerHTML = ''; let fileHtml = ''; let coBaoCao = false;
    
    if (qtMa && Array.isArray(database.depts)) {
        database.depts.forEach(function(d) {
            if(!d || !Array.isArray(d.danhMucQTKT)) return;
            const qt = d.danhMucQTKT.find(function(x) { return x && (isCodeMatch(x.ma, qtMa) || isCodeMatch(x.maLienKet, qtMa)); });
            if(qt) {
                coBaoCao = true;
                let ttRaw = qt.trangThai || 'CHUA_NOP'; let tt = (ttRaw === 'DA_DUYET' || ttRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : ttRaw; let ttStr = "Chưa nộp"; let col = "gray";
                if(tt === 'CHO_DUYET') { ttStr = "Chờ KHTH duyệt"; col = "var(--warning)"; } else if(tt === 'KHONG_DUYET') { ttStr = "Bị KHTH từ chối"; col = "var(--danger)"; } else if(tt === 'DA_PHE_DUYET') { ttStr = "Đã phê duyệt"; col = "var(--success)"; }
                tbody.innerHTML += `<tr><td><b>${d.tenKhoa}</b></td><td style="color:${col}; font-weight:bold;">${ttStr}</td></tr>`;
                if(qt.fileQuyetDinh || qt.fileBienBan || qt.filePdfChinhThuc) {
                    fileHtml += `<div style="margin-bottom:15px; padding-bottom:10px; border-bottom: 1px dashed #ccc;"><b>Tài liệu của ${d.tenKhoa}:</b><br>`;
                    if(qt.fileQuyetDinh) fileHtml += `<a class="file-online-link" href="${qt.fileQuyetDinh}" target="_blank">📄 Xem Quyết định Phê duyệt</a>`;
                    if(qt.fileBienBan) fileHtml += `<a class="file-online-link" href="${qt.fileBienBan}" target="_blank">📄 Xem Biên bản HĐKHKT</a>`;
                    if(qt.filePdfChinhThuc) {
                        fileHtml += `<div style="display:flex; align-items:center; gap:10px; margin-top:5px; margin-bottom:5px;"><a class="file-online-link" href="${qt.filePdfChinhThuc}" target="_blank" style="background:#28a745; color:white; border:none; width:auto; margin:0;">📄 Quy trình PDF Chính thức</a>`;
                        let safeQtTen = qt.ten ? String(qt.ten) : "";
                        let safeQtMa = qt.ma || qt.maLienKet || qtMa;
                        if (currentUser && currentUser.role === 'admin') { fileHtml += `<button class="btn" style="background:var(--warning); color:black; margin:0;" onclick="chuanBiUpSinglePdf('${safeQtMa}', '${d.tenKhoa}', '${encodeForJS(safeQtTen)}')">🔄 Cập nhật PDF</button>`; }
                        fileHtml += `</div>`;
                    }
                    fileHtml += `</div>`;
                }
            }
        });
    }
    if(!coBaoCao) tbody.innerHTML = `<tr><td colspan="2">Chưa có khoa nào đăng ký quy trình kỹ thuật liên kết.</td></tr>`;
    const fileArea = document.getElementById('dvFilesArea');
    if(fileHtml !== '') fileArea.innerHTML = fileHtml; else fileArea.innerHTML = `<span style="color:#888;">Chưa có tài liệu phê duyệt nào.</span>`;
    moModal('detailDVModal');
}

// 🟢 HÀM MỞ CHI TIẾT ĐÃ ĐƯỢC BỔ SUNG
function moChiTiet(ma, encodedTen, encodedPhanLoai, encodedQuyetDinh) {
    let ten = decodeURIComponent(encodedTen || "");
    let phanLoai = decodeURIComponent(encodedPhanLoai || "");
    let quyetDinh = decodeURIComponent(encodedQuyetDinh || "");

    document.getElementById('dtTenQT').innerText = ten || ''; 
    document.getElementById('dtMaQT').innerText = ma; 
    document.getElementById('dtPhanLoai').innerText = phanLoai || 'KPL'; 
    document.getElementById('dtQuyetDinh').innerText = quyetDinh || 'Chưa phê duyệt';
    
    const tbody = document.getElementById('dtKhoaBody'); tbody.innerHTML = ''; let fileHtml = ''; let coBaoCao = false;

    if(Array.isArray(database.depts)) {
        database.depts.forEach(function(d) {
            if(!d || !Array.isArray(d.danhMucQTKT)) return;
            const qt = d.danhMucQTKT.find(function(x) { 
                let nameMatch = false;
                if (ten && x.ten) { nameMatch = robustNormalize(x.ten) === robustNormalize(ten); }
                return x && (isCodeMatch(x.ma, ma) || isCodeMatch(x.maLienKet, ma) || nameMatch); 
            });
            if(qt) {
                coBaoCao = true; let ttRaw = qt.trangThai || 'CHUA_NOP'; let tt = (ttRaw === 'DA_DUYET' || ttRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : ttRaw; let ttStr = "Chưa nộp"; let col = "gray";
                if(tt === 'CHO_DUYET') { ttStr = "Chờ KHTH duyệt"; col = "var(--warning)"; } else if(tt === 'KHONG_DUYET') { ttStr = "Bị KHTH từ chối"; col = "var(--danger)"; } else if(tt === 'DA_PHE_DUYET') { ttStr = "Đã phê duyệt"; col = "var(--success)"; }
                tbody.innerHTML += `<tr><td><b>${d.tenKhoa}</b></td><td style="color:${col}; font-weight:bold;">${ttStr}</td></tr>`;

                if(qt.fileQuyetDinh || qt.fileBienBan || qt.filePdfChinhThuc) {
                    fileHtml += `<div style="margin-bottom:15px; padding-bottom:10px; border-bottom: 1px dashed #ccc;"><b>Tài liệu của ${d.tenKhoa}:</b><br>`;
                    if(qt.fileQuyetDinh) fileHtml += `<a class="file-online-link" href="${qt.fileQuyetDinh}" target="_blank">📄 Xem Quyết định Phê duyệt</a>`;
                    if(qt.fileBienBan) fileHtml += `<a class="file-online-link" href="${qt.fileBienBan}" target="_blank">📄 Xem Biên bản HĐKHKT</a>`;
                    if(qt.filePdfChinhThuc) {
                        fileHtml += `<div style="display:flex; align-items:center; gap:10px; margin-top:5px; margin-bottom:5px;"><a class="file-online-link" href="${qt.filePdfChinhThuc}" target="_blank" style="background:#28a745; color:white; border:none; width:auto; margin:0;">📄 Quy trình PDF Chính thức</a>`;
                        if (currentUser && currentUser.role === 'admin') fileHtml += `<button class="btn" style="background:var(--warning); color:black; margin:0;" onclick="chuanBiUpSinglePdf('${ma}', '${d.tenKhoa}', '${encodeForJS(ten)}')">🔄 Cập nhật PDF</button>`;
                        fileHtml += `</div>`;
                    }
                    fileHtml += `</div>`;
                }
            }
        });
    }
    if(!coBaoCao) tbody.innerHTML = `<tr><td colspan="2">Chưa có khoa nào đăng ký kỹ thuật này.</td></tr>`;
    const fileArea = document.getElementById('dtFilesArea'); if(fileHtml !== '') fileArea.innerHTML = fileHtml; else fileArea.innerHTML = `<span style="color:#888;">Kỹ thuật này chưa có tài liệu phê duyệt nào.</span>`;

    const giaArea = document.getElementById('dtGiaDVArea'); const giaBVArea = document.getElementById('dtMaDVBVArea');
    let matchedPrices = [];
    if(Array.isArray(database.GiaDV)) {
        matchedPrices = database.GiaDV.filter(function(priceItem) {
            if(!priceItem) return false; let isNameMatch = false; 
            if (ten && priceItem.tenKyThuat) { if (robustNormalize(ten) === robustNormalize(priceItem.tenKyThuat)) isNameMatch = true; }
            return isCodeMatch(priceItem.maTuongDuong, ma) || isNameMatch;
        });
    }

    if (matchedPrices.length > 0) {
        let htmlGia = `<table class="user-table" style="margin-top: 5px; width: 100%; background: white;"><thead><tr><th>Mã tương đương</th><th>Tên Dịch vụ BHYT</th><th>Giá phê duyệt</th></tr></thead><tbody>`;
        matchedPrices.forEach(function(p) { let formattedPrice = p.giaMax ? Number(p.giaMax).toLocaleString('vi-VN') + ' đ' : 'Chưa có giá'; htmlGia += `<tr><td style="text-align:center;"><b>${p.maTuongDuong || ''}</b></td><td>${p.tenDichVu || p.tenKyThuat || ''}</td><td style="text-align:right; color:red; font-weight:bold;">${formattedPrice}</td></tr>`; });
        htmlGia += `</tbody></table>`; giaArea.innerHTML = htmlGia;
    } else { giaArea.innerHTML = `<span style="color:#856404;">Chưa tìm thấy giá dịch vụ tương đương (TT23) cho kỹ thuật này.</span>`; }

    let matchedBVPrices = [];
    if(Array.isArray(database.MaDVBV)) {
        matchedBVPrices = database.MaDVBV.filter(function(priceItem) { return priceItem && isCodeMatch(priceItem.maTuongDuong, ma); });
    }
    
    if (matchedBVPrices.length > 0) {
        let htmlGiaBV = `<table class="user-table" style="margin-top: 5px; width: 100%; background: white;"><thead><tr><th>Mã dịch vụ</th><th>Tên dịch vụ (BV)</th><th>Giá BHYT</th><th>Giá Viện Phí</th><th>Giá Yêu Cầu</th><th>Giá NN</th></tr></thead><tbody>`;
        matchedBVPrices.forEach(function(p) {
            let gBHYT = p.giaBHYT ? Number(p.giaBHYT).toLocaleString('vi-VN') + ' đ' : '-'; let gVP = p.giaVienPhi ? Number(p.giaVienPhi).toLocaleString('vi-VN') + ' đ' : '-'; let gYC = p.giaYeuCau ? Number(p.giaYeuCau).toLocaleString('vi-VN') + ' đ' : '-'; let gNN = p.giaNuocNgoai ? Number(p.giaNuocNgoai).toLocaleString('vi-VN') + ' đ' : '-';
            htmlGiaBV += `<tr><td style="text-align:center;"><b>${p.maDichVu || ''}</b></td><td>${p.tenDichVu || ''}</td><td style="text-align:right; color:green; font-weight:bold;">${gBHYT}</td><td style="text-align:right; color:blue; font-weight:bold;">${gVP}</td><td style="text-align:right; color:purple; font-weight:bold;">${gYC}</td><td style="text-align:right; color:red; font-weight:bold;">${gNN}</td></tr>`;
        });
        htmlGiaBV += `</tbody></table>`; giaBVArea.innerHTML = htmlGiaBV;
    } else { giaBVArea.innerHTML = `<span style="color:#0c5460;">Chưa tìm thấy mã dịch vụ bệnh viện thiết lập cho kỹ thuật này.</span>`; }
    moModal('detailModal');
}

function showLoading(status) { let ld = document.getElementById('loading'); if(ld) ld.style.display = status ? 'flex' : 'none'; }