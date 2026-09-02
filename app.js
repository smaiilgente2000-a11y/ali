// ================ تهيئة النظام ================
let students = JSON.parse(localStorage.getItem('students')) || [];
let attendance = JSON.parse(localStorage.getItem('attendance')) || {};
let today = new Date().toISOString().split('T')[0];
let lastScanTime = 0;
let scanTimeout;

// ================ متغيرات الكاميرا ================
let html5QrCode = null;
let isCameraScanning = false;

// ================ تحديث التاريخ ================
function updateDateDisplay() {
    const dateElement = document.getElementById('currentDate');
    const todayDate = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = todayDate.toLocaleDateString('ar-MA', options);
}

// ================ التبديل بين التبويبات ================
function switchTab(tabName) {
    // إذا كانت الكاميرا مفتوحة وننتقل من تبويب المسح، نغلقها
    if (tabName !== 'scan' && isCameraScanning) {
        stopCamera();
    }

    // إخفاء جميع التبويبات
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // إزالة التفعيل من جميع الأزرار
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // تفعيل التبويب المحدد
    document.getElementById(tabName + '-tab').classList.add('active');

    // تفعيل الزر المناسب
    const activeButton = Array.from(buttons).find(btn =>
        btn.textContent.includes(getTabTitle(tabName))
    );
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // التركيز على حقل المسح إذا كنا في تبويب المسح
    if (tabName === 'scan') {
        document.getElementById('scanInput').focus();
    }
}

function getTabTitle(tabName) {
    const titles = {
        'scan': 'مسح',
        'students': 'إدارة',
        'barcodes': 'باركود'
    };
    return titles[tabName] || tabName;
}

// ================ معالجة المسح من جهاز المسح الخارجي ================
document.addEventListener('DOMContentLoaded', function() {
    const scanInput = document.getElementById('scanInput');

    // التركيز التلقائي على حقل المسح
    scanInput.focus();

    // معالجة الإدخال من جهاز المسح
    scanInput.addEventListener('input', function(e) {
        const code = this.value.trim();

        // أجهزة المسح عادة ما تكون سريعة جداً
        if (code.length >= 3) {
            clearTimeout(scanTimeout);

            scanTimeout = setTimeout(() => {
                processScan(code);
                this.value = '';
                this.focus();
            }, 100);
        }
    });

    // معالجة مفتاح Enter
    scanInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = this.value.trim();
            if (code) {
                processScan(code);
                this.value = '';
            }
        }
    });

    // منع فقدان التركيز
    scanInput.addEventListener('blur', function() {
        setTimeout(() => {
            if (document.getElementById('scan-tab').classList.contains('active')) {
                this.focus();
            }
        }, 10);
    });
});

// ================ معالجة المسح (عامة) ================
function processScan(code) {
    const now = Date.now();

    // منع المسح المكرر
    if (now - lastScanTime < 1000) {
        return;
    }
    lastScanTime = now;

    // البحث عن التلميذ
    const student = students.find(s => s.code === code);

    if (!student) {
        showMessage('❌ رمز غير معروف: ' + code, 'error');
        playBeep('error');
        return;
    }

    // التحقق من التسجيل المسبق
    if (attendance[today]?.includes(student.id)) {
        showMessage('⚠️ ' + student.name + ' مسجل بالفعل', 'warning');
        playBeep('warning');
        return;
    }

    // تسجيل الحضور
    if (!attendance[today]) {
        attendance[today] = [];
    }
    attendance[today].push(student.id);
    saveData();

    showMessage('✅ تم تسجيل حضور: ' + student.name + ' (' + student.code + ')', 'success');
    playBeep('success');
    updateDisplay();
}

// ================ دوال الكاميرا ================
function toggleCamera() {
    if (isCameraScanning) {
        stopCamera();
    } else {
        startCamera();
    }
}

function startCamera() {
    // التأكد من تحميل المكتبة
    if (typeof Html5Qrcode === 'undefined') {
        showMessage('❌ مكتبة المسح غير محملة. تأكد من اتصال الإنترنت.', 'error');
        return;
    }

    const container = document.getElementById('cameraContainer');
    container.style.display = 'block';
    const readerDiv = document.getElementById('reader');

    // مسح أي عناصر سابقة
    readerDiv.innerHTML = '';

    try {
        html5QrCode = new Html5Qrcode("reader");

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            // دعم الباركود الخطي و QR
            formatsToSupport: [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.PDF_417
            ]
        };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
        ).then(() => {
            isCameraScanning = true;
            document.getElementById('cameraBtn').textContent = '⏹️ إيقاف الكاميرا';
            showMessage('📷 الكاميرا تعمل ...', 'success');
        }).catch(err => {
            console.error('خطأ في تشغيل الكاميرا:', err);
            showMessage('❌ تعذر تشغيل الكاميرا: ' + err.message, 'error');
            container.style.display = 'none';
            isCameraScanning = false;
        });
    } catch (e) {
        showMessage('❌ خطأ في تهيئة الكاميرا: ' + e.message, 'error');
        container.style.display = 'none';
        isCameraScanning = false;
    }
}

function onScanSuccess(decodedText, decodedResult) {
    // عند نجاح المسح، نوقف الكاميرا
    stopCamera();
    // تعبئة الحقل ومعالجته
    document.getElementById('scanInput').value = decodedText;
    processScan(decodedText);
}

function onScanError(err) {
    // أخطاء مستمرة أثناء المسح (تجاهلها)
}

function stopCamera() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            isCameraScanning = false;
            document.getElementById('cameraContainer').style.display = 'none';
            document.getElementById('cameraBtn').textContent = '📷 مسح بالكاميرا';
            showMessage('⏹️ تم إيقاف الكاميرا', 'warning');
        }).catch(err => {
            console.error('خطأ في إيقاف الكاميرا:', err);
        });
    } else {
        // إذا لم تكن الكاميرا مفعلة
        document.getElementById('cameraContainer').style.display = 'none';
        document.getElementById('cameraBtn').textContent = '📷 مسح بالكاميرا';
        isCameraScanning = false;
    }
}

// ================ عرض الرسائل ================
function showMessage(message, type) {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = 'message-box';

    if (type) {
        messageBox.classList.add('message-' + type);
    }

    clearTimeout(messageBox.timeout);
    messageBox.timeout = setTimeout(() => {
        messageBox.className = 'message-box';
    }, 4000);
}

// ================ أصوات التنبيه ================
function playBeep(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        switch (type) {
            case 'success':
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.3;
                oscillator.start();
                setTimeout(() => {
                    oscillator.frequency.value = 1000;
                }, 100);
                setTimeout(() => {
                    oscillator.stop();
                }, 300);
                break;

            case 'error':
                oscillator.frequency.value = 200;
                gainNode.gain.value = 0.3;
                oscillator.start();
                setTimeout(() => {
                    oscillator.stop();
                }, 500);
                break;

            case 'warning':
                oscillator.frequency.value = 600;
                gainNode.gain.value = 0.2;
                oscillator.start();
                setTimeout(() => {
                    oscillator.stop();
                }, 200);
                break;
        }
    } catch (e) {
        console.log('تعذر تشغيل الصوت');
    }
}

// ================ إدارة التلاميذ ================
function addStudent() {
    const name = document.getElementById('studentName').value.trim();
    const code = document.getElementById('studentCode').value.trim();

    if (!name || !code) {
        showMessage('❌ يرجى إدخال الاسم والرمز التعريفي', 'error');
        return;
    }

    if (students.some(s => s.code === code)) {
        showMessage('❌ هذا الرمز التعريفي موجود بالفعل', 'error');
        return;
    }

    const newStudent = {
        id: Date.now(),
        name: name,
        code: code,
        createdAt: new Date().toISOString()
    };

    students.push(newStudent);
    saveData();

    document.getElementById('studentName').value = '';
    document.getElementById('studentCode').value = '';

    updateDisplay();
    showMessage('✅ تم إضافة التلميذ: ' + name, 'success');
    playBeep('success');
}

function deleteStudent(id) {
    if (confirm('هل أنت متأكد من حذف هذا التلميذ؟')) {
        students = students.filter(s => s.id !== id);

        // إزالة هذا التلميذ من كل أيام الحضور
        Object.keys(attendance).forEach(date => {
            attendance[date] = attendance[date].filter(sId => sId !== id);
        });

        saveData();
        updateDisplay();
        showMessage('تم حذف التلميذ', 'warning');
    }
}

// ================ إعادة تعيين حضور اليوم ================
function resetTodayAttendance() {
    if (confirm('هل أنت متأكد من إعادة تعيين حضور اليوم؟')) {
        attendance[today] = [];
        saveData();
        updateDisplay();
        showMessage('تم إعادة تعيين حضور اليوم', 'success');
    }
}

// ================ تحديث العرض ================
function updateDisplay() {
    const todayAttendance = attendance[today] || [];

    // تحديث الإحصائيات
    document.getElementById('totalStudentsStat').textContent = students.length;
    document.getElementById('presentStudentsStat').textContent = todayAttendance.length;
    document.getElementById('absentStudentsStat').textContent = students.length - todayAttendance.length;

    // تحديث قائمة الحاضرين
    const presentStudents = students.filter(s => todayAttendance.includes(s.id));
    document.getElementById('presentList').innerHTML = presentStudents.map(s =>
        `<li>
            <span>${s.name}</span>
            <span class="student-code">${s.code}</span>
        </li>`
    ).join('');
    document.getElementById('presentCount').textContent = presentStudents.length;

    // تحديث قائمة الغائبين
    const absentStudents = students.filter(s => !todayAttendance.includes(s.id));
    document.getElementById('absentList').innerHTML = absentStudents.map(s =>
        `<li>
            <span>${s.name}</span>
            <span class="student-code">${s.code}</span>
        </li>`
    ).join('');
    document.getElementById('absentCount').textContent = absentStudents.length;

    // تحديث قائمة جميع التلاميذ
    document.getElementById('allStudentsList').innerHTML = students.map(s =>
        `<li>
            <div>
                <strong>${s.name}</strong>
                <span style="color:#666;margin-right:10px;">الرمز: ${s.code}</span>
            </div>
            <div class="student-actions">
                <button class="barcode-btn" onclick="generateBarcodeForStudent('${s.code}', '${s.name}')">🏷️ باركود</button>
                <button class="delete-btn" onclick="deleteStudent(${s.id})">🗑️ حذف</button>
            </div>
        </li>`
    ).join('');

    document.getElementById('totalStudents').textContent = students.length;
}

// ================ توليد الباركود ================
function generateAllBarcodes() {
    if (students.length === 0) {
        showMessage('❌ لا يوجد تلاميذ مسجلين', 'error');
        return;
    }

    const container = document.getElementById('barcodeContainer');
    container.innerHTML = '';

    students.forEach(student => {
        addBarcodeItem(student.name, student.code);
    });
    showMessage('✅ تم توليد جميع الباركودات', 'success');
}

function generateBarcodeForStudent(code, name) {
    switchTab('barcodes');
    addBarcodeItem(name, code);
    showMessage('✅ تم توليد باركود لـ ' + name, 'success');
}

function addBarcodeItem(name, code) {
    const container = document.getElementById('barcodeContainer');

    // تجنب التكرار
    const existingBarcode = document.getElementById(`barcode-item-${code}`);
    if (existingBarcode) {
        showMessage('⚠️ هذا الباركود موجود بالفعل', 'warning');
        return;
    }

    const item = document.createElement('div');
    item.className = 'barcode-item';
    item.id = `barcode-item-${code}`;

    item.innerHTML = `
        <h3>${name}</h3>
        <svg id="barcode-${code}"></svg>
        <p>الرمز: ${code}</p>
        <button onclick="removeBarcode('${code}')">🗑️ حذف</button>
    `;

    container.appendChild(item);

    // توليد الباركود مع تأخير بسيط لظهور العنصر
    setTimeout(() => {
        try {
            JsBarcode(`#barcode-${code}`, code, {
                format: "CODE128",
                width: 2,
                height: 60,
                displayValue: true,
                margin: 5
            });
        } catch (error) {
            console.error('خطأ في توليد الباركود:', error);
            showMessage('❌ فشل في توليد الباركود', 'error');
            item.remove();
        }
    }, 100);
}

function removeBarcode(code) {
    const item = document.getElementById(`barcode-item-${code}`);
    if (item) {
        item.remove();
        showMessage('🗑️ تم حذف الباركود', 'warning');
    }
}

function clearBarcodes() {
    if (confirm('هل تريد مسح جميع الباركودات؟')) {
        document.getElementById('barcodeContainer').innerHTML = '';
        showMessage('🗑️ تم مسح جميع الباركودات', 'warning');
    }
}

// ================ التصدير ================
function exportAttendance() {
    const todayAttendance = attendance[today] || [];
    const presentStudents = students.filter(s => todayAttendance.includes(s.id));
    const absentStudents = students.filter(s => !todayAttendance.includes(s.id));

    let report = 'تقرير الحضور - ' + today + '\n\n';
    report += 'الحاضرون (' + presentStudents.length + '):\n';
    presentStudents.forEach(s => {
        report += '- ' + s.name + ' (' + s.code + ')\n';
    });

    report += '\nالغائبون (' + absentStudents.length + '):\n';
    absentStudents.forEach(s => {
        report += '- ' + s.name + ' (' + s.code + ')\n';
    });

    // تحميل التقرير
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance-report-' + today + '.txt';
    a.click();
    URL.revokeObjectURL(url);

    showMessage('✅ تم تصدير التقرير', 'success');
}

function exportStudents() {
    let data = 'قائمة التلاميذ\n\n';
    students.forEach(s => {
        data += s.name + ' - ' + s.code + '\n';
    });

    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-list.txt';
    a.click();
    URL.revokeObjectURL(url);

    showMessage('✅ تم تصدير قائمة التلاميذ', 'success');
}

// ================ حفظ البيانات ================
function saveData() {
    localStorage.setItem('students', JSON.stringify(students));
    localStorage.setItem('attendance', JSON.stringify(attendance));
}

// ================ التهيئة الأولية ================
updateDateDisplay();
updateDisplay();

window.addEventListener('load', function() {
    document.getElementById('scanInput').focus();
});

// تحديث التاريخ إذا تغير اليوم
setInterval(() => {
    const newToday = new Date().toISOString().split('T')[0];
    if (newToday !== today) {
        today = newToday;
        updateDisplay();
        updateDateDisplay();
    }
}, 60000);

// إيقاف الكاميرا عند إغلاق الصفحة
window.addEventListener('beforeunload', function() {
    if (isCameraScanning) {
        stopCamera();
    }
});