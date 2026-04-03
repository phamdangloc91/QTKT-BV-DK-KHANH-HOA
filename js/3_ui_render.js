window.currentPage = 1;
window.rowsPerPage = 100; 

window.changePage = function(step) {
    window.currentPage += step;
    window.renderTable(); 
    document.querySelector('.table-container').scrollTop = 0; 
}

window.jumpToPage = function(inputEl, maxPage) {
    let p = parseInt(inputEl.value, 10);
    if (isNaN(p) || p < 1) p = 1;
    if (p > maxPage) p = maxPage;
    window.currentPage = p;
    window.renderTable();
    document.querySelector('.table-container').scrollTop = 0;
}

window.jumpToPL1 = function(encodedMa) { 
    window.switchTab('PL1', 'QTKT'); 
    let ma = decodeURIComponent(encodedMa || "");
    let sBox = document.getElementById('searchBox'); 
    if(sBox) { 
        sBox.value = ma; 
        window.apDungLoc(); 
    } 
}

window.getAggregatedList = function(tabName) {
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
        if (window.getOrderIndex) return window.getOrderIndex(a) - window.getOrderIndex(b);
        return 0;
    }); 
    return result;
}

window.prepareKeywords = function() {
    let validPL = [];
    if(Array.isArray(database.PL1)) validPL = validPL.concat(database.PL1);
    if(Array.isArray(database.PL2)) validPL = validPL.concat(database.PL2);
    validPL = validPL.filter(function(x) { return x && x.ten; });
    plKeywords = validPL.map(function(x) { return { ten: x.ten, words: new Set(window.robustNormalize(x.ten).split(" ").filter(Boolean)) }; });
}

window.getSuggestion = function(kyThuat) {
    if (!kyThuat) return null; let wordsKT = new Set(window.robustNormalize(kyThuat).split(" ").filter(Boolean)); if (wordsKT.size === 0) return null;
    let bestMatch = null; let maxScore = 0;
    for (let pl of plKeywords) {
        let intersection = 0; for (let w of wordsKT) { if (pl.words.has(w)) intersection++; }
        let union = wordsKT.size + pl.words.size - intersection; let score = intersection / union;
        if (score > maxScore) { maxScore = score; bestMatch = pl.ten; }
    }
    return (maxScore >= 0.65) ? bestMatch : null; 
}

window.acceptSuggestion = function(btn) {
    let suggestedText = btn.getAttribute('data-suggestion'); let td = btn.closest('td'); let cell = td.querySelector('.editable-cell');
    if(cell) cell.innerText = suggestedText; btn.closest('.suggestion-box').remove();
}

window.enrichGiaDV = function() {
    let qtktMapByCode = new Map();
    let qtktMapByName = new Map();
    
    let addTolist = function(i) {
        if(!i) return;
        let m1 = window.normalizeCodeFast(i.ma); 
        let m2 = window.normalizeCodeFast(i.maLienKet);
        let n = window.robustNormalize(i.ten); 
        
        if (m1) {
            let arr1 = m1.split(';').filter(Boolean);
            arr1.forEach(a => { if(!qtktMapByCode.has(a)) qtktMapByCode.set(a, i); });
        }
        if (m2) {
            let arr2 = m2.split(';').filter(Boolean);
            arr2.forEach(b => { if(!qtktMapByCode.has(b)) qtktMapByCode.set(b, i); });
        }
        if (n && !qtktMapByName.has(n)) qtktMapByName.set(n, i);
    };
    if(Array.isArray(database.PL1)) database.PL1.forEach(addTolist); 
    if(Array.isArray(database.PL2)) database.PL2.forEach(addTolist);

    if(Array.isArray(database.GiaDV)) {
        database.GiaDV.forEach(function(item) {
            if(!item) return;
            let qtktInfo = null;
            
            if (window.isValidForCrossLink(item.maTuongDuong)) {
                let qtMa = window.normalizeCodeFast(item.maTuongDuong);
                let qtName = window.robustNormalize(item.tenKyThuat);
                if (qtName && qtktMapByName.has(qtName)) { qtktInfo = qtktMapByName.get(qtName); } 
                else if (qtMa) {
                    let arr = qtMa.split(';').filter(Boolean);
                    for(let m of arr) {
                        if (qtktMapByCode.has(m)) { qtktInfo = qtktMapByCode.get(m); break; }
                    }
                }
            }

            item.qt_ten = (qtktInfo && qtktInfo.ten) ? String(qtktInfo.ten).replace(/['"`\n\r\\]/g, "") : (item.tenKyThuat ? String(item.tenKyThuat).replace(/['"`\n\r\\]/g, "") : "");
            item.qt_phanLoai = (qtktInfo && qtktInfo.phanLoai) ? String(qtktInfo.phanLoai).replace(/['"`\n\r\\]/g, "") : "KPL";
            item.qt_quyetDinh = (qtktInfo && qtktInfo.quyetDinh) ? String(qtktInfo.quyetDinh).replace(/['"`\n\r\\]/g, "") : "Chưa phê duyệt";
            
            if (!item.maTuongDuong && qtktInfo && (qtktInfo.ma || qtktInfo.maLienKet)) { item.maTuongDuong = qtktInfo.ma || qtktInfo.maLienKet; }
        });
    }
}

window.layDuLieu = async function() {
    window.showLoading(true);
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
        
        if (window.buildOrderMap) window.buildOrderMap();
        
        window.enrichGiaDV(); 
        window.prepareKeywords(); 
        window.apDungLoc(); 
    } catch (error) { console.log("Lỗi khi lấy dữ liệu:", error); }
    window.showLoading(false);
}

window.toggleMultiSelect = function(state) {
    isMultiSelectMode = state; selectedTechniques = [];
    if (isMultiSelectMode) {
        document.getElementById('btnStartBatch').style.display = 'none'; document.getElementById('btnConfirmBatch').style.display = 'inline-block'; document.getElementById('btnCancelBatch').style.display = 'inline-block';
        document.getElementById('batchStatusText').innerHTML = `<b style="color:var(--danger)">Vui lòng TICK CHỌN các ô vuông trong bảng bên dưới.</b>`;
    } else {
        document.getElementById('btnStartBatch').style.display = 'inline-block'; document.getElementById('btnConfirmBatch').style.display = 'none'; document.getElementById('btnCancelBatch').style.display = 'none';
        document.getElementById('batchStatusText').innerHTML = `<b>Công cụ Admin:</b> Tick chọn các kỹ thuật bên dưới để tải Quyết định & Biên bản hàng loạt.`;
    }
    window.apDungLoc(); 
}

window.toggleSelectRow = function(checkbox, tenKhoa, encodedMa) {
    let ma = decodeURIComponent(encodedMa || "");
    if (checkbox.checked) { selectedTechniques.push({ tenKhoa: tenKhoa, maQuyTrinh: ma }); } 
    else { selectedTechniques = selectedTechniques.filter(function(item) { return item && !(item.tenKhoa === tenKhoa && item.maQuyTrinh === ma); }); }
}

window.toggleAllGiaDV = function(source) {
    let checkboxes = document.querySelectorAll('.row-checkbox-giadv');
    checkboxes.forEach(function(cb) { 
        cb.checked = source.checked; 
        let strVal = String(cb.value);
        if (source.checked) { if (!selectedGiaDV.includes(strVal)) selectedGiaDV.push(strVal); } 
        else { selectedGiaDV = selectedGiaDV.filter(function(x) { return x !== strVal; }); }
    });
}

window.toggleRowGiaDV = function(checkbox, val) {
    let strVal = String(val);
    if (checkbox.checked) { if (!selectedGiaDV.includes(strVal)) selectedGiaDV.push(strVal); } 
    else { selectedGiaDV = selectedGiaDV.filter(function(x) { return x !== strVal; }); }
    window.updateSelectAllGiaDVUI();
}

window.updateSelectAllGiaDVUI = function() {
    let selectAllCb = document.getElementById('selectAllGiaDV'); if (!selectAllCb) return;
    let visibleCheckboxes = document.querySelectorAll('.row-checkbox-giadv');
    if (visibleCheckboxes.length === 0) { selectAllCb.checked = false; return; }
    let allChecked = true;
    for (let i = 0; i < visibleCheckboxes.length; i++) { if (!visibleCheckboxes[i].checked) { allChecked = false; break; } }
    selectAllCb.checked = allChecked;
}

window.toggleAllQD = function(source) {
    let qdCheckboxes = document.querySelectorAll('.qd-checkbox');
    qdCheckboxes.forEach(function(cb) { cb.checked = source.checked; });
    window.apDungLoc();
}

window.renderTable = function(data = null) {
    try {
        const isDeptTab = DANH_SACH_KHOA.includes(currentTab); 
        const isSuperTab = currentTab.startsWith('KHTH_'); 
        
        if (data !== null) window.currentFilteredData = data;
        let list = window.currentFilteredData || []; 

        let canEdit = false;
        if (currentUser && currentUser.role === 'admin') canEdit = true;
        if (currentUser && currentUser.role === 'khoa' && currentUser.tenKhoa === currentTab) canEdit = true;

        let canAddPL = false; 
        let canRemovePL = false; 
        let showFileCol = false;
        
        if (currentUser && currentUser.role === 'khoa') { 
            if (!isDeptTab && !isSuperTab) canAddPL = true; 
            if (isDeptTab && currentUser.tenKhoa === currentTab) canRemovePL = true; 
        }
        if (currentUser && currentUser.role === 'admin' && isDeptTab) canRemovePL = true; 
        if (isDeptTab || isSuperTab) showFileCol = true; 

        const thead = document.getElementById('tableHead'); 
        const tbody = document.getElementById('dataBody'); 
        let tbodyHtml = '';
        let htmlHead = `<tr>`;

        if (!window.rowsPerPage) window.rowsPerPage = 100;
        let totalPages = Math.ceil(list.length / window.rowsPerPage);
        if (window.currentPage < 1) window.currentPage = 1;
        if (totalPages > 0 && window.currentPage > totalPages) window.currentPage = totalPages;
        
        let startIdx = (window.currentPage - 1) * window.rowsPerPage;
        let endIdx = startIdx + window.rowsPerPage;
        let pageData = list.slice(startIdx, endIdx); 

        if (currentTabType === 'DTNH') {
            htmlHead = `<tr>
                <th style="width:40px; text-align:center;">STT</th><th style="width:25%">Nội dung đào tạo</th><th style="width:25%">Kỹ thuật cụ thể (Click xem liên kết QTKT)</th><th>Thời gian</th><th style="text-align:center;" title="Cử nhân Sinh học">CN.SH</th><th style="text-align:center;" title="Nữ hộ sinh">NHS</th><th style="text-align:center;" title="Kỹ thuật viên">KTV</th><th style="text-align:center;" title="Điều dưỡng">ĐD</th><th style="text-align:center;" title="Bác sĩ">BS</th><th>Đơn vị chủ trì</th><th style="text-align:right;">Kinh phí (Tr)</th>
            </tr>`;
            thead.innerHTML = htmlHead; 
            
            let sttCounter = startIdx + 1; 
            
            pageData.forEach(function(item, index) {
                if(!item) return; let isFirst = false; let rowspan = 1; let prevItem = pageData[index - 1];
                if (index === 0 || !prevItem || item.groupId !== prevItem.groupId) {
                    isFirst = true;
                    for (let j = index + 1; j < pageData.length; j++) { if (pageData[j] && pageData[j].groupId === item.groupId) rowspan++; else break; }
                }

                let kyThuatHtml = ''; let suggestionHtml = ''; let rawKT = item.kyThuat || '';
                if (String(rawKT).trim() !== '') {
                    let normName = window.robustNormalize(rawKT); let matchedQT = null;
                    if(Array.isArray(database.PL1)) { let found = database.PL1.find(function(x) { return x && window.robustNormalize(x.ten) === normName; }); if(found) matchedQT = found; }
                    if(!matchedQT && Array.isArray(database.PL2)) { let found = database.PL2.find(function(x) { return x && window.robustNormalize(x.ten) === normName; }); if(found) matchedQT = found; }
                    
                    if (matchedQT) {
                        let safeTen = matchedQT.ten ? String(matchedQT.ten) : ""; 
                        let safePL = matchedQT.phanLoai ? String(matchedQT.phanLoai) : ""; 
                        let safeQD = matchedQT.quyetDinh ? String(matchedQT.quyetDinh) : ""; 
                        let maHienThi = matchedQT.ma || matchedQT.maLienKet || '';
                        
                        kyThuatHtml = `<a href="#" onclick="window.moChiTiet('${window.encodeForJS(maHienThi)}', '${window.encodeForJS(safeTen)}', '${window.encodeForJS(safePL)}', '${window.encodeForJS(safeQD)}')" style="color:var(--info); font-weight:bold; text-decoration:none; border-bottom: 1px dashed var(--info);" title="Bấm để xem chi tiết QTKT liên kết">${rawKT}</a>`;
                    } else {
                        kyThuatHtml = `<span style="color:var(--primary); font-weight:bold;">${rawKT}</span>`;
                        if (canEdit) { let suggested = window.getSuggestion(rawKT); if (suggested) { let safeSug = String(suggested).replace(/"/g, '&quot;'); suggestionHtml = `<div class="suggestion-box">💡 Ý bạn là: <button class="suggestion-btn" data-suggestion="${safeSug}" onclick="window.acceptSuggestion(this)">${suggested}</button>?</div>`; } }
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
                } else { 
                    tbodyHtml += `<tr><td><div class="editable-cell" contenteditable="${canEdit}">${kyThuatHtml}</div>${suggestionHtml}</td></tr>`; 
                }
            });
        }
        else {
            if (currentTab === 'KHTH_CHUA_AP_GIA') {
                htmlHead += `<th>STT</th><th style="width:10%">Mã kỹ thuật</th><th style="width:15%">Tên chương</th><th>Tên kỹ thuật (Click xem chi tiết)</th><th style="width:10%; text-align:center;">Mã tương đương</th><th style="width:25%">Tên Dịch vụ BHYT</th></tr>`;
            } else if (currentTab === 'GiaDV') {
                htmlHead += `<th style="width:40px; text-align:center;"><input type="checkbox" id="selectAllGiaDV" onchange="window.toggleAllGiaDV(this)"></th>
                             <th>STT</th><th>Tên kỹ thuật (Click xem chi tiết)</th><th>Tên dịch vụ BHYT</th>
                             <th style="text-align:center;">Mã tương đương</th><th style="text-align:center;">Quyết định</th>
                             <th style="text-align:right;">Mức giá</th><th>Ghi chú</th></tr>`;
            } else if (currentTab === 'MaDVBV') {
                htmlHead += `<th>STT</th><th>Mã dịch vụ</th><th>Mã tương đương</th><th>Tên dịch vụ (Click xem liên kết)</th><th>Giá BHYT</th><th>Giá Viện Phí</th><th>Giá Yêu Cầu</th><th>Giá Nước Ngoài</th></tr>`;
            } else {
                if (isMultiSelectMode) { htmlHead += `<th style="width:40px; text-align:center;">Chọn</th>`; }
                htmlHead += `<th>STT</th>`;
                if (isSuperTab) { htmlHead += `<th>Mã kỹ thuật</th><th>Tên kỹ thuật (Click để xem)</th><th>Phân loại</th><th>Quyết định</th>`; } 
                else if (currentTab === 'PL1' || isDeptTab) { htmlHead += `<th>Mã kỹ thuật</th><th>Tên chương</th><th>Tên kỹ thuật (Click để xem)</th><th>Phân loại</th><th>Quyết định</th>`; } 
                else { htmlHead += `<th>STT của chương</th><th>Tên chương</th><th>Mã liên kết</th><th>Tên kỹ thuật (Click để xem)</th><th>Phân loại</th><th>Quyết định</th>`; }
                
                if (showFileCol) { htmlHead += `<th style="width:220px;">Trạng thái & Thao tác</th>`; }
                if (canAddPL || canRemovePL) { htmlHead += `<th style="text-align:center;">Khoa Thêm / Xóa</th>`; }
                htmlHead += `</tr>`;
            }
            thead.innerHTML = htmlHead;

            let currentKhoaGroup = ""; 
            let myDeptCart = [];
            if (currentUser && currentUser.role === 'khoa') {
                let myDept = null; if(Array.isArray(database.depts)) { myDept = database.depts.find(function(d){ return d && d.tenKhoa === currentUser.tenKhoa; }); }
                if (myDept && Array.isArray(myDept.danhMucQTKT)) myDeptCart = myDept.danhMucQTKT;
            }

            // LẤY BỘ NHỚ ĐỆM TÊN FILE TỪ LOCAL STORAGE ĐỂ HIỂN THỊ CHUẨN XÁC
            let mapNames = {};
            try { mapNames = JSON.parse(localStorage.getItem('fileNamesMap') || '{}'); } catch(e){}

            pageData.forEach(function(item, index) {
                if(!item) return;
                let realIndex = startIdx + index; 

                if (currentTab === 'KHTH_CHUA_AP_GIA') {
                    let safeTen = item.ten ? String(item.ten) : ""; 
                    let safePL = item.phanLoai ? String(item.phanLoai) : ""; 
                    let safeQD = item.quyetDinh ? String(item.quyetDinh) : "";
                    let tenClickable = `<a href="#" onclick="window.moChiTiet('${window.encodeForJS(item.ma || item.maLienKet || '')}', '${window.encodeForJS(safeTen)}', '${window.encodeForJS(safePL)}', '${window.encodeForJS(safeQD)}')" style="color:var(--info); font-weight:bold; text-decoration:none;">${safeTen}</a>`;
                    let td_ma = item.matchedGia && item.matchedGia.length > 0 ? item.matchedGia.map(function(g){ return `<b style="color:#dc3545;">${g.maTuongDuong||''}</b>`; }).join('<br><br>') : '';
                    let td_ten = item.matchedGia && item.matchedGia.length > 0 ? item.matchedGia.map(function(g){ return g.tenDichVu || g.tenKyThuat || ''; }).join('<hr style="border:0; border-top:1px dashed #ccc; margin: 4px 0;">') : '<span style="color:#888;">Chưa có trong TT23</span>';
                    tbodyHtml += `<tr class="row-bhyt"><td>${realIndex + 1}</td><td><b>${item.ma || item.maLienKet || ''}</b></td><td>${item.chuong || ''}</td><td>${tenClickable}</td><td style="text-align:center; background:#fff3cd;">${td_ma}</td><td style="background:#fff3cd;">${td_ten}</td></tr>`;
                    return;
                }

                if (currentTab === 'GiaDV') {
                    let formattedPrice = item.giaMax ? Number(item.giaMax).toLocaleString('vi-VN') + ' đ' : '';
                    let safeTenKT = item.qt_ten || item.tenKyThuat || "";
                    let safePL = item.qt_phanLoai || "KPL";
                    let safeQD = item.qt_quyetDinh || "Chưa phê duyệt";
                    let maPass = item.maTuongDuong || item.tenKyThuat || "";
                    let tenClickable = `<a href="#" onclick="window.moChiTiet('${window.encodeForJS(maPass)}', '${window.encodeForJS(safeTenKT)}', '${window.encodeForJS(safePL)}', '${window.encodeForJS(safeQD)}')" style="color:var(--info); font-weight:bold; text-decoration:none;">${safeTenKT}</a>`;
                    let uniqueId = String(item.maTuongDuong || item.tenKyThuat || realIndex);
                    let isChecked = selectedGiaDV.includes(uniqueId) ? "checked" : "";
                    tbodyHtml += `<tr>
                        <td style="text-align:center;"><input type="checkbox" class="row-checkbox-giadv" value="${uniqueId}" onchange="window.toggleRowGiaDV(this, '${uniqueId}')" ${isChecked}></td>
                        <td>${realIndex + 1}</td><td>${tenClickable}</td><td>${item.tenDichVu || ''}</td>
                        <td style="text-align:center;"><b>${item.maTuongDuong || ''}</b></td><td style="text-align:center;"><span class="badge badge-type">${safeQD}</span></td>
                        <td style="color:red; font-weight:bold; text-align:right;">${formattedPrice}</td><td>${item.ghiChu || ''}</td>
                    </tr>`;
                    return;
                }

                if (currentTab === 'MaDVBV') {
                    let gBHYT = item.giaBHYT ? Number(item.giaBHYT).toLocaleString('vi-VN') + ' đ' : ''; 
                    let gVP = item.giaVienPhi ? Number(item.giaVienPhi).toLocaleString('vi-VN') + ' đ' : ''; 
                    let gYC = item.giaYeuCau ? Number(item.giaYeuCau).toLocaleString('vi-VN') + ' đ' : ''; 
                    let gNN = item.giaNuocNgoai ? Number(item.giaNuocNgoai).toLocaleString('vi-VN') + ' đ' : '';
                    let safeTenDV = item.tenDichVu ? String(item.tenDichVu) : ""; 
                    let safeMaTD = item.maTuongDuong ? String(item.maTuongDuong) : ""; 
                    let safeMaDV = item.maDichVu ? String(item.maDichVu) : "";
                    let tenClickable = `<a href="#" onclick="window.moChiTietDV('${window.encodeForJS(safeMaDV)}', '${window.encodeForJS(safeMaTD)}', '${window.encodeForJS(safeTenDV)}')" style="color:var(--info); font-weight:bold; text-decoration:none;">${safeTenDV}</a>`;
                    tbodyHtml += `<tr><td>${realIndex + 1}</td><td><b>${item.maDichVu || ''}</b></td><td>${item.maTuongDuong || ''}</td><td>${tenClickable}</td><td style="color:green; text-align:right; font-weight:bold;">${gBHYT}</td><td style="color:blue; text-align:right; font-weight:bold;">${gVP}</td><td style="color:purple; text-align:right; font-weight:bold;">${gYC}</td><td style="color:red; text-align:right; font-weight:bold;">${gNN}</td></tr>`;
                    return;
                }

                let realTenKhoa = item.tenKhoaChuQuan || currentTab; 
                if (isSuperTab && realTenKhoa !== currentKhoaGroup) {
                    currentKhoaGroup = realTenKhoa; let colSpan = isMultiSelectMode ? 10 : 9;
                    tbodyHtml += `<tr><td colspan="${colSpan}" style="background-color: #cce5ff; color: #004085; font-weight: bold; padding: 10px 15px; font-size: 14px;">🏥 ${currentKhoaGroup.toUpperCase()}</td></tr>`;
                }

                let maHienThi = item.ma || item.maLienKet || ''; 
                
                let rowClass = "";
                let isHasBHYT = false; let isHasBV = false;
                
                let arrSearch = window.normalizeCodeFast(maHienThi).split(';').filter(Boolean);
                if (arrSearch.length > 0) {
                    if (Array.isArray(database.GiaDV)) {
                        isHasBHYT = database.GiaDV.some(g => {
                            if (!window.isValidForCrossLink(g.maTuongDuong)) return false;
                            return arrSearch.some(m => window.isCodeMatch(g.maTuongDuong, m));
                        });
                    }
                    if (Array.isArray(database.MaDVBV)) {
                        isHasBV = database.MaDVBV.some(b => {
                            if (!window.isValidForCrossLink(b.maTuongDuong)) return false;
                            return arrSearch.some(m => window.isCodeMatch(b.maTuongDuong, m));
                        });
                    }
                }
                
                if (isHasBHYT && isHasBV) rowClass = "row-full";
                else if (isHasBHYT) rowClass = "row-bhyt";

                let html = `<tr class="${rowClass}">`;
                
                if (isMultiSelectMode) {
                    let isChecked = selectedTechniques.find(function(x) { return x && x.tenKhoa === realTenKhoa && x.maQuyTrinh === maHienThi; }) ? "checked" : "";
                    html += `<td style="text-align:center;"><input type="checkbox" style="width:18px; height:18px; cursor:pointer;" onchange="window.toggleSelectRow(this, '${realTenKhoa}', '${window.encodeForJS(maHienThi)}')" ${isChecked}></td>`;
                }

                let safeTen = item.ten ? String(item.ten) : ""; 
                let safePL = item.phanLoai ? String(item.phanLoai) : ""; 
                let safeQD = item.quyetDinh ? String(item.quyetDinh) : ""; 
                let safeMaLienKet = item.maLienKet ? String(item.maLienKet) : "";
                
                let tenClickable = `<a href="#" onclick="window.moChiTiet('${window.encodeForJS(maHienThi)}', '${window.encodeForJS(safeTen)}', '${window.encodeForJS(safePL)}', '${window.encodeForJS(safeQD)}')" style="color:#0056b3; font-weight:bold; text-decoration:none;">${safeTen}</a>`;

                let maLienKetHtml = '';
                if (safeMaLienKet) {
                    let arrMaLienKet = safeMaLienKet.split(/;|\/|\|/).filter(Boolean);
                    maLienKetHtml = arrMaLienKet.map(m => {
                        let cleanM = m.trim();
                        return `<span style="color:blue;cursor:pointer;font-weight:bold;text-decoration:underline;display:inline-block;margin:2px 4px;" onclick="window.jumpToPL1('${window.encodeForJS(cleanM)}')">${cleanM}</span>`;
                    }).join('');
                }

                html += `<td>${realIndex + 1}</td>`;
                if (isSuperTab) { html += `<td><b>${maHienThi}</b></td><td>${tenClickable}</td><td><span class="badge badge-type">${safePL}</span></td><td>${safeQD}</td>`; } 
                else if (currentTab === 'PL1' || isDeptTab) { let textMa = item.ma ? `<b>${item.ma}</b>` : `<span style="color:blue">${item.maLienKet}</span>`; html += `<td>${textMa}</td><td>${item.chuong || ''}</td><td>${tenClickable}</td><td><span class="badge badge-type">${safePL}</span></td><td>${safeQD}</td>`; } 
                else { html += `<td>${item.maChuong || ''}</td><td>${item.chuong || ''}</td><td>${maLienKetHtml}</td><td>${tenClickable}</td><td><span class="badge badge-type">${safePL}</span></td><td>${safeQD}</td>`; }
                
                let ttRaw = item.trangThai || 'CHUA_NOP'; let tt = (ttRaw === 'DA_DUYET' || ttRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : ttRaw; 

                // 🟢 THAY ĐỔI: TÁI CẤU TRÚC VÙNG HIỂN THỊ NÚT (ẨN HOÀN TOÀN FILE KHI BỊ XÓA HOẶC CHƯA NỘP)
                if (showFileCol) {
                    let fileHtml = '';
                    if(tt === 'DA_PHE_DUYET') {
                        fileHtml += `<span class="badge badge-success" style="font-size:12px; padding:6px 10px;">Final (Đã phê duyệt)</span><br><span style="font-size:12px; color:#555;">(Xem file trong chi tiết)</span>`;
                        if (currentUser && currentUser.role === 'admin' && !isMultiSelectMode) { fileHtml += `<br><button class="btn" style="background:var(--danger); margin-top:5px;" onclick="window.thayDoiTrangThai('${realTenKhoa}', '${window.encodeForJS(maHienThi)}', 'REVERT_FINAL')">🔙 Hủy Phê Duyệt</button>`; }
                    } else {
                        // LUÔN VẼ HUY HIỆU TRẠNG THÁI ĐẦU TIÊN
                        if(tt === 'CHUA_NOP') fileHtml += `<span class="badge badge-gray" style="margin-bottom:5px; display:inline-block;">Chưa nộp</span><br>`; 
                        else if(tt === 'CHO_DUYET') fileHtml += `<span class="badge badge-warning" style="margin-bottom:5px; display:inline-block;">Chờ KHTH duyệt</span><br>`; 
                        else if(tt === 'KHONG_DUYET') fileHtml += `<span class="badge badge-danger" style="margin-bottom:5px; display:inline-block;">Bị KHTH từ chối</span><br>`;

                        let dispNameLocal = mapNames[maHienThi] || "📄 Tài liệu đính kèm";

                        if (currentUser && currentUser.role === 'khoa' && currentUser.tenKhoa === currentTab) {
                            // NẾU CÓ FILE VÀ TRẠNG THÁI HIỆN TẠI KHÁC CHƯA NỘP -> Hiển thị tên file và Nút Xóa vĩnh viễn
                            if(item.fileKhoa && tt !== 'CHUA_NOP') {
                                fileHtml += `<div style="display:flex; align-items:center; gap:5px; margin-top:5px;">
                                                <a href="${item.fileKhoa}" target="_blank" style="font-size:13px; color:blue; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${dispNameLocal}">${dispNameLocal}</a>
                                                <span style="color:red; cursor:pointer; font-weight:bold; font-size:14px; background:#ffe6e6; padding:2px 5px; border-radius:4px;" title="Xóa vĩnh viễn file này" onclick="window.xoaFileKhoa('${window.encodeForJS(maHienThi)}')">❌</span>
                                             </div>`;
                            } 
                            // NẾU KHÔNG CÓ FILE HOẶC BỊ XÓA -> Chỉ hiện nút Nộp File
                            else {
                                fileHtml += `<button class="btn" style="background:var(--info); margin-top:5px; font-weight:bold;" onclick="window.chuanBiNopKhoa('${window.encodeForJS(maHienThi)}')">📤 Nộp file QTKT</button>`;
                            }
                        } 
                        else if (currentUser && currentUser.role === 'admin') {
                            if(item.fileKhoa && tt !== 'CHUA_NOP') {
                                let dispNameAd = mapNames[maHienThi] || "Bản Khoa nộp";
                                fileHtml += `<a href="${item.fileKhoa}" target="_blank" style="font-size:12px; color:blue; display:inline-block; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top:5px;" title="${dispNameAd}">📄 ${dispNameAd}</a><br>`;
                            }
                            if(tt === 'CHO_DUYET' && !isMultiSelectMode) { 
                                fileHtml += `<button class="btn" style="background:var(--success); margin-top:5px;" onclick="window.chuanBiUpSinglePdf('${window.encodeForJS(maHienThi)}', '${realTenKhoa}', '${window.encodeForJS(safeTen)}')">📥 Tải File Chính Thức (PDF)</button> `; 
                                fileHtml += `<button class="btn" style="background:var(--danger); margin-top:5px;" onclick="window.thayDoiTrangThai('${realTenKhoa}', '${window.encodeForJS(maHienThi)}', 'REJECT_KHOA')">❌ Từ chối</button>`; 
                            }
                        }
                    }
                    html += `<td>${fileHtml}</td>`;
                }
                
                if (canAddPL) { 
                    let itemInCart = null;
                    if(Array.isArray(myDeptCart)) { 
                        itemInCart = myDeptCart.find(function(x) { 
                            if (!x) return false;
                            if (maHienThi) return (window.isCodeMatch(x.ma, maHienThi) || window.isCodeMatch(x.maLienKet, maHienThi));
                            return window.robustNormalize(x.ten) === window.robustNormalize(item.ten);
                        }); 
                    }
                    if (itemInCart) {
                        let cartStatusRaw = itemInCart.trangThai || 'CHUA_NOP'; let cartStatus = (cartStatusRaw === 'DA_DUYET' || cartStatusRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : cartStatusRaw;
                        if (cartStatus === 'DA_PHE_DUYET') { html += `<td style="text-align:center;"><span class="badge badge-locked">🔒 Đã chốt</span></td>`; } 
                        else { html += `<td style="text-align:center;"><button class="btn btn-remove" onclick="window.xoaQuyTrinh('${window.encodeForJS(maHienThi)}', '${currentUser.tenKhoa}', '${window.encodeForJS(safeTen)}')">🗑️ Xóa</button></td>`; }
                    } else {
                        html += `<td style="text-align:center;"><button class="btn btn-add" onclick="window.bocQuyTrinh('${window.encodeForJS(maHienThi)}', '${window.encodeForJS(safeTen)}')">+ Thêm</button></td>`;
                    }
                }
                else if (canRemovePL) { 
                    if (currentUser.role === 'khoa' && tt === 'DA_PHE_DUYET') { html += `<td style="text-align:center;"><span class="badge badge-locked">🔒 Đã chốt</span></td>`; } 
                    else { html += `<td style="text-align:center;"><button class="btn btn-remove" onclick="window.xoaQuyTrinh('${window.encodeForJS(maHienThi)}', '${realTenKhoa}', '${window.encodeForJS(safeTen)}')">🗑️ Xóa</button></td>`; }
                }
                
                html += "</tr>"; tbodyHtml += html;
            });
        }
        
        if (totalPages > 1) {
            tbodyHtml += `<tr style="background: #fff;"><td colspan="100%" style="text-align:center; padding: 15px;">
                <button class="btn" style="background:#6c757d; font-size:13px; padding:8px 15px;" onclick="window.changePage(-1)" ${window.currentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>⬅️ Trang Trước</button>
                <span style="font-size: 14px; font-weight: bold; margin: 0 15px;">
                    Trang <input type="number" value="${window.currentPage}" min="1" max="${totalPages}" style="width:50px; text-align:center; padding:5px; border:1px solid #ccc; border-radius:4px;" onkeydown="if(event.key === 'Enter') { window.jumpToPage(this, ${totalPages}); this.blur(); }"> / ${totalPages}
                </span>
                <button class="btn" style="background:#0056b3; font-size:13px; padding:8px 15px;" onclick="window.changePage(1)" ${window.currentPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Trang Sau ➡️</button>
            </td></tr>`;
        }

        tbody.innerHTML = tbodyHtml;
        if(window.capNhatDanhSachQuyetDinh) window.capNhatDanhSachQuyetDinh();
        if(currentTab === 'GiaDV' && window.updateSelectAllGiaDVUI) window.updateSelectAllGiaDVUI();
        
    } catch(e) { 
        console.error(e); 
        alert("Lỗi khi tải bảng dữ liệu: " + e.message); 
    }
}

window.capNhatTieuDe = function() {
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
    let grpChuaCoMa = document.getElementById('groupChuaCoMa');
    
    let legendColor = document.getElementById('colorLegend');
    if(legendColor) {
        if(currentTabType === 'QTKT' && currentTab !== 'GiaDV' && currentTab !== 'MaDVBV') legendColor.style.display = 'flex';
        else legendColor.style.display = 'none';
    }

    if(grpPhanLoai) grpPhanLoai.style.display = (currentTabType === 'DTNH' || currentTab === 'GiaDV' || currentTab === 'MaDVBV' || currentTab === 'KHTH_CHUA_AP_GIA') ? 'none' : 'flex';
    if(grpQuyetDinh) grpQuyetDinh.style.display = (currentTabType === 'DTNH' || currentTab === 'MaDVBV' || currentTab === 'KHTH_CHUA_AP_GIA') ? 'none' : 'flex';
    if(grpNamDT) grpNamDT.style.display = currentTabType === 'DTNH' ? 'flex' : 'none';
    if(grpChuaCoMa) grpChuaCoMa.style.display = (currentTab === 'PL2') ? 'block' : 'none';

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

window.switchTab = function(tab, type) { 
    if (!type) type = 'QTKT';
    currentTab = tab; currentTabType = type; window.capNhatTieuDe(); 
    
    window.currentPage = 1; 

    let sBox = document.getElementById('searchBox'); if(sBox) sBox.value = ''; 
    let fLoai = document.getElementById('filterLoai'); if(fLoai) fLoai.value = ""; 
    let chkChua = document.getElementById('chkChuaCoMa'); if(chkChua) chkChua.checked = false;
    
    let optionsQD = document.getElementById('optionsQD');
    if(optionsQD) {
        let checkboxes = optionsQD.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function(cb) { cb.checked = false; });
        let textSpan = document.getElementById('selectedQDText');
        if(textSpan) textSpan.innerText = "-- Tất cả --";
    }
    
    let fNam = document.getElementById('filterNamDT'); if(fNam) fNam.value = "";
    window.thucHienLocGoc(); 
}

window.searchTimeout = null;
window.apDungLoc = function() {
    clearTimeout(window.searchTimeout);
    window.currentPage = 1;
    window.searchTimeout = setTimeout(() => {
        window.thucHienLocGoc();
    }, 300); 
}

window.thucHienLocGoc = function() { 
    try {
        const searchEl = document.getElementById('searchBox');
        const search = searchEl ? window.safeStr(searchEl.value) : '';
        
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
        
        let chkChuaCoMa = document.getElementById('chkChuaCoMa');
        let isLocChuaCoMa = chkChuaCoMa && chkChuaCoMa.checked;
        
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
                let matchSearch = (window.safeStr(item.noiDung).includes(search) || window.safeStr(item.kyThuat).includes(search));
                let matchYear = filterNam === "" || String(item.nam) === String(filterNam);
                return matchSearch && matchYear;
            });
            window.renderTable(filtered);
            
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
                    if (dv && dv.maTuongDuong) maDvbvSet.add(window.normalizeCodeFast(dv.maTuongDuong)); 
                });
            }

            const giaDvByCode = new Map();
            const giaDvByName = new Map();
            
            if(Array.isArray(database.GiaDV)) {
                database.GiaDV.forEach(function(g) {
                    if(!g) return;
                    if (g.maTuongDuong) {
                        let code = window.normalizeCodeFast(g.maTuongDuong);
                        if (!giaDvByCode.has(code)) giaDvByCode.set(code, []);
                        giaDvByCode.get(code).push(g);
                    }
                    if (g.tenKyThuat) {
                        let name = window.robustNormalize(g.tenKyThuat);
                        if (!giaDvByName.has(name)) giaDvByName.set(name, []);
                        giaDvByName.get(name).push(g);
                    }
                });
            }

            let sourceList = [];
            if(Array.isArray(database.PL1)) {
                database.PL1.forEach(function(qt) {
                    if(!qt) return;
                    let qdVal = qt.quyetDinh ? window.safeStr(qt.quyetDinh) : '';
                    if (!qdVal || qdVal.includes('chưa phê duyệt') || qdVal.includes('chua phe duyet')) return; 
                    
                    let normCode = window.normalizeCodeFast(qt.ma);
                    if (maDvbvSet.has(normCode)) return;

                    let matchedGiaMap = new Map(); 
                    if (giaDvByCode.has(normCode)) { 
                        giaDvByCode.get(normCode).forEach(function(g) { matchedGiaMap.set(g, g); }); 
                    }
                    if (qt.ten) {
                        let normName = window.robustNormalize(qt.ten);
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
                return (window.safeStr(item.ma).includes(search) || window.safeStr(item.maLienKet).includes(search) || window.safeStr(item.ten).includes(search) || window.safeStr(item.tt23_ma).includes(search) || window.safeStr(item.tt23_ten).includes(search));
            });
            window.renderTable(filtered); 
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
            window.renderTable(filtered); 
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
            window.renderTable(filtered); 
            return;
        }

        document.getElementById('lblSearch').innerText = 'TÌM KIẾM CHUNG'; 

        let filterLoaiEl = document.getElementById('filterLoai');
        const loaiSelect = filterLoaiEl ? filterLoaiEl.value : "";
        
        const isDeptTab = DANH_SACH_KHOA.includes(currentTab); 
        const isSuperTab = currentTab.startsWith('KHTH_'); 
        let sourceList = []; 
        
        if (isSuperTab) { 
            sourceList = window.getAggregatedList(currentTab); 
        } else if (isDeptTab) { 
            let deptObj = null;
            if(Array.isArray(database.depts)) {
                deptObj = database.depts.find(function(d){ return d && d.tenKhoa === currentTab; }); 
            }
            let rawList = deptObj && Array.isArray(deptObj.danhMucQTKT) ? deptObj.danhMucQTKT : []; 
            sourceList = [...rawList];
            sourceList.sort(function(a, b) { return window.getOrderIndex(a) - window.getOrderIndex(b); });
        } else { 
            sourceList = Array.isArray(database[currentTab]) ? database[currentTab] : []; 
        } 
        
        const filtered = sourceList.filter(function(item) { 
            if(!item) return false;
            
            if (isLocChuaCoMa && currentTab === 'PL2') {
                let checkMa = item.maLienKet || item.ma || "";
                if (checkMa.toString().trim() !== "") return false; 
            }

            const matchSearch = (window.safeStr(item.ma).includes(search) || window.safeStr(item.maLienKet).includes(search) || window.safeStr(item.ten).includes(search) || window.safeStr(item.tenKhoaChuQuan).includes(search)); 
            
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
        
        window.renderTable(filtered); 
    } catch(e) {
        console.error(e);
        alert("Lỗi khi Lọc Dữ liệu: " + e.message);
    }
}

window.capNhatDanhSachQuyetDinh = function() { 
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
        sourceList = window.getAggregatedList(currentTab); 
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
    chkAll.onchange = function() { window.toggleAllQD(this); };
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
        chk.onchange = window.apDungLoc;
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