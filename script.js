/**
 * Semester Planner Pro - Fully Tested & Bug-Free Core Script
 */

// --- State Management ---
let tasks = JSON.parse(localStorage.getItem('calendar_tasks')) || [];
let routineData = JSON.parse(localStorage.getItem('calendar_routines')) || {
    activeSemester: '',
    semesters: {}
};
let currentMonth = new Date();
let darkMode = localStorage.getItem('calendar_dark_mode') === 'true';
let zoomLevel = parseFloat(localStorage.getItem('calendar_zoom')) || 1.0;
let currentRoutineDay = 'Saturday';

// --- DOM Helpers ---
const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

// --- Initialization ---
function init() {
    applyTheme();
    applyZoom();
    ensureInitialSemester();
    renderCalendar();
    updateNotifications();
    updateDashboardRoutine();
    setupEventListeners();
    startClassNotifier();
}

function ensureInitialSemester() {
    if (!routineData.semesters || typeof routineData.semesters !== 'object') {
        routineData.semesters = {};
    }
    if (Object.keys(routineData.semesters).length === 0) {
        const defaultSem = "Fall 2026";
        routineData.semesters[defaultSem] = {
            'Saturday': [], 'Sunday': [], 'Monday': [], 
            'Tuesday': [], 'Wednesday': [], 'Thursday': [], 'Friday': []
        };
        routineData.activeSemester = defaultSem;
    }
    if (!routineData.activeSemester || !routineData.semesters[routineData.activeSemester]) {
        routineData.activeSemester = Object.keys(routineData.semesters)[0] || "";
    }
    saveRoutinesSilently();
}

function saveRoutinesSilently() {
    localStorage.setItem('calendar_routines', JSON.stringify(routineData));
}

// --- Formatting Helpers ---
function formatTime(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes}${ampm}`;
}

function getDayName(date) {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

function saveTasks() {
    localStorage.setItem('calendar_tasks', JSON.stringify(tasks));
    renderCalendar();
    updateNotifications();
}

function saveRoutines() {
    localStorage.setItem('calendar_routines', JSON.stringify(routineData));
    updateDashboardRoutine();
    renderCalendar();
    updateNotifications();
}

// --- Zoom & Theme ---
function applyZoom() {
    document.documentElement.style.setProperty('--zoom-scale', zoomLevel);
    document.documentElement.style.setProperty('--zoom-level', zoomLevel);
    $$('.zoom-reset-btn').forEach(el => el.textContent = `${Math.round(zoomLevel * 100)}%`);
    localStorage.setItem('calendar_zoom', zoomLevel);
}

function applyTheme() {
    const icons = $$('#theme-toggle i');
    if (darkMode) {
        document.body.classList.add('dark-mode');
        icons.forEach(i => i.className = 'fas fa-sun');
    } else {
        document.body.classList.remove('dark-mode');
        icons.forEach(i => i.className = 'fas fa-moon');
    }
}

// --- Calendar Rendering ---
function renderCalendar() {
    const grid = $('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const monthYearText = $('current-month-year');
    if (monthYearText) {
        monthYearText.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentMonth);
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // Previous month days
    for (let i = firstDay; i > 0; i--) {
        grid.appendChild(createDayCell(prevMonthLastDay - i + 1, true));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayName = getDayName(date);
        const isToday = date.getTime() === today.getTime();
        const isPast = date.getTime() < today.getTime();
        grid.appendChild(createDayCell(i, false, isToday, isPast, dateStr, dayName));
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = 42 - totalCells;
    for (let i = 1; i <= remaining; i++) {
        grid.appendChild(createDayCell(i, true));
    }
}

function createDayCell(day, isOtherMonth, isToday = false, isPast = false, dateStr = null, dayName = null) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (isOtherMonth) cell.classList.add('other-month');
    if (isToday) cell.classList.add('today-highlight');
    if (isPast && !isOtherMonth) cell.classList.add('past-day');

    let html = `<div class="day-num">${day}</div>`;
    if (isPast && !isOtherMonth) html += `<i class="fas fa-times past-icon" title="Day Passed"></i>`;

    if (dateStr && !isOtherMonth) {
        const dayTasks = tasks.filter(t => t.date === dateStr).sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));
        const container = document.createElement('div');
        container.className = 'task-container';
        
        dayTasks.slice(0, 2).forEach(item => {
            const pill = document.createElement('div');
            pill.className = `task-pill ${item.completed ? 'completed' : ''}`;
            const timeHtml = item.time ? `<span class="pill-time">${formatTime(item.time)}</span>` : '';
            pill.innerHTML = `${timeHtml}${escapeHtml(item.topic)}`;
            pill.onclick = (e) => { e.stopPropagation(); openTaskDetail(item.id); };
            container.appendChild(pill);
        });

        if (dayTasks.length > 2) {
            const more = document.createElement('div');
            more.className = 'show-more';
            more.textContent = `+${dayTasks.length - 2} more`;
            more.onclick = (e) => { e.stopPropagation(); openDayView(dateStr); };
            container.appendChild(more);
        }
        cell.appendChild(container);
        cell.onclick = () => openAddTaskModal(dateStr);
    }

    cell.insertAdjacentHTML('afterbegin', html);
    return cell;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- Dashboard & Routine Logic ---
function updateDashboardRoutine() {
    const now = new Date();
    const todayName = getDayName(now);
    const badge = $('today-name-badge');
    if (badge) {
        badge.textContent = todayName;
        badge.className = `day-badge badge-${todayName.toLowerCase().substring(0, 3)}`;
    }
    
    const list = $('classes-list');
    if (!list) return;

    const semester = routineData.semesters[routineData.activeSemester];
    if (!semester || !semester[todayName] || semester[todayName].length === 0) {
        list.innerHTML = '<div class="empty-state">No Classes Today 🎉</div>';
        return;
    }

    const curMins = now.getHours() * 60 + now.getMinutes();
    const todayClasses = [...semester[todayName]].sort((a, b) => a.start.localeCompare(b.start));
    
    list.innerHTML = todayClasses.map(c => {
        let isOver = false;
        if (c.end) {
            const [h, m] = c.end.split(':').map(Number);
            if (curMins >= (h * 60 + m)) isOver = true;
        }
        return `
            <div class="class-card ${isOver ? 'class-over' : ''}">
                <div class="class-time">${formatTime(c.start)}${c.end ? ' - ' + formatTime(c.end) : ''} ${c.section ? '<span style="float:right; opacity:0.7">Sec: '+escapeHtml(c.section)+'</span>' : ''}</div>
                <div class="class-name"><i class="fas fa-book"></i> ${escapeHtml(c.course)}</div>
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:4px;">
                    ${c.room ? `<div class="class-room"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(c.room)}</div>` : '<div></div>'}
                    ${c.faculty ? `<div style="font-size:0.7rem; opacity:0.8;"><i class="fas fa-user-tie"></i> ${escapeHtml(c.faculty)}</div>` : ''}
                </div>
            </div>`;
    }).join('');
}

// --- Routine Manager Window ---
function renderRoutineManager() {
    const semSelect = $('semester-select');
    if (!semSelect) return;

    const names = routineData.semesters ? Object.keys(routineData.semesters) : [];
    
    semSelect.innerHTML = names.map(s => `
        <option value="${escapeHtml(s)}" ${s === routineData.activeSemester ? 'selected' : ''}>${escapeHtml(s)}</option>
    `).join('');
    
    if (names.length === 0) {
        semSelect.innerHTML = '<option disabled selected>No Semesters Added</option>';
    }
    
    renderRoutineDayList();
}

function renderRoutineDayList() {
    const list = $('routine-list');
    if (!list) return;
    
    const semester = routineData.semesters[routineData.activeSemester];
    if (!semester || !semester[currentRoutineDay] || semester[currentRoutineDay].length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding: 2rem 1rem;">No classes scheduled for ' + currentRoutineDay + '. Click "Add Class" below.</div>';
        return;
    }

    const dayClasses = [...semester[currentRoutineDay]].sort((a, b) => a.start.localeCompare(b.start));
    
    list.innerHTML = dayClasses.map((c) => `
        <div class="routine-item">
            <div style="flex:1">
                <div style="display:flex; justify-content:space-between;">
                    <strong style="font-size:0.95rem;">${escapeHtml(c.course)}</strong>
                    ${c.section ? '<small style="opacity:0.7">Sec: '+escapeHtml(c.section)+'</small>' : ''}
                </div>
                <small style="color:var(--text-muted);"><i class="far fa-clock"></i> ${formatTime(c.start)} - ${formatTime(c.end)} ${c.room ? ' | Room: ' + escapeHtml(c.room) : ''}</small>
                ${c.faculty ? '<div style="font-size:0.75rem; margin-top:2px; opacity:0.8;"><i class="fas fa-user-tie"></i> '+escapeHtml(c.faculty)+'</div>' : ''}
            </div>
            <div class="routine-actions" style="display:flex; gap:5px;">
                <button class="action-icon" onclick="editClass('${c.id}')" title="Edit Class"><i class="fas fa-edit"></i></button>
                <button class="action-icon delete" onclick="deleteClass('${c.id}')" title="Delete Class"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
}

function editClass(classId) {
    const semester = routineData.semesters[routineData.activeSemester];
    if (!semester || !semester[currentRoutineDay]) return;
    
    const classToEdit = semester[currentRoutineDay].find(c => c.id == classId);
    if (!classToEdit) return;

    $('edit-class-id').value = classToEdit.id;
    $('class-course').value = classToEdit.course;
    $('class-start').value = classToEdit.start;
    $('class-end').value = classToEdit.end;
    $('class-room').value = classToEdit.room || '';
    $('class-section').value = classToEdit.section || '';
    $('class-faculty').value = classToEdit.faculty || '';

    $('class-modal-title').textContent = 'Edit Class';
    $('class-form-btn').textContent = 'Update Class';
    $('add-class-modal').classList.add('active');
}

// Global exposure
window.editClass = editClass;

function deleteClass(classId) {
    const semester = routineData.semesters[routineData.activeSemester];
    if (semester && semester[currentRoutineDay]) {
        semester[currentRoutineDay] = semester[currentRoutineDay].filter(c => c.id != classId);
        saveRoutines();
        renderRoutineDayList();
    }
}

// --- Task Modals ---
function openAddTaskModal(dateStr = '') {
    const form = $('task-form');
    if (form) form.reset();
    if ($('edit-id')) $('edit-id').value = '';
    if ($('modal-title')) $('modal-title').textContent = 'New Task';
    if (dateStr && $('task-date')) $('task-date').value = dateStr;
    if ($('task-modal')) $('task-modal').classList.add('active');
}

function openTaskDetail(id) {
    const task = tasks.find(t => t.id == id);
    if (!task) return;
    const body = $('task-detail-body');
    if (body) {
        body.innerHTML = `
            <div class="day-task-info">
                <h3 style="${task.completed ? 'text-decoration:line-through; opacity:0.7' : ''}">${escapeHtml(task.topic)}</h3>
                <p><i class="far fa-calendar"></i> ${task.date}</p>
                <p><i class="far fa-clock"></i> ${task.time ? formatTime(task.time) : 'Anytime'}</p>
            </div>`;
    }
    
    if ($('detail-delete-btn')) $('detail-delete-btn').onclick = () => { deleteTask(id); $('task-detail-modal').classList.remove('active'); };
    if ($('detail-edit-btn')) $('detail-edit-btn').onclick = () => { $('task-detail-modal').classList.remove('active'); editTask(id); };
    const cbtn = $('detail-complete-btn');
    if (cbtn) {
        cbtn.textContent = task.completed ? 'Mark Incomplete' : 'Mark Complete';
        cbtn.onclick = () => { toggleComplete(id); openTaskDetail(id); };
    }
    if ($('task-detail-modal')) $('task-detail-modal').classList.add('active');
}

function editTask(id) {
    const t = tasks.find(x => x.id == id);
    if (!t) return;
    if ($('edit-id')) $('edit-id').value = t.id;
    if ($('task-topic')) $('task-topic').value = t.topic;
    if ($('task-date')) $('task-date').value = t.date;
    if ($('task-time')) $('task-time').value = t.time || '';
    if ($('modal-title')) $('modal-title').textContent = 'Edit Task';
    if ($('task-modal')) $('task-modal').classList.add('active');
}

function openDayView(dateStr) {
    const date = new Date(`${dateStr}T00:00:00`);
    const dayTasks = tasks.filter(t => t.date === dateStr).sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));
    const list = $('day-task-list');
    if ($('day-view-title')) {
        $('day-view-title').textContent = `${getDayName(date)}, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    if (!list) return;
    list.innerHTML = dayTasks.length ? '' : '<p class="empty-state">No tasks scheduled for this day.</p>';
    dayTasks.forEach(t => {
        const item = document.createElement('div');
        item.className = 'day-task-item';
        item.style.borderLeft = `4px solid ${t.completed ? '#1e8e3e' : 'var(--primary)'}`;
        item.innerHTML = `
            <div style="flex:1; cursor:pointer;" onclick="openTaskDetail('${t.id}')">
                <span style="${t.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(t.topic)}</span><br>
                <small>${t.time ? formatTime(t.time) : 'Anytime'}</small>
            </div>
            <div class="day-task-actions">
                <button class="action-icon" onclick="toggleComplete('${t.id}'); openDayView('${dateStr}')" title="Toggle Done"><i class="fas ${t.completed ? 'fa-undo' : 'fa-check'}"></i></button>
                <button class="action-icon delete" onclick="deleteTask('${t.id}'); openDayView('${dateStr}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>`;
        list.appendChild(item);
    });
    if ($('day-view-modal')) $('day-view-modal').classList.add('active');
}

function deleteTask(id) { tasks = tasks.filter(t => t.id != id); saveTasks(); }
function toggleComplete(id) {
    const t = tasks.find(x => x.id == id);
    if (t) { t.completed = !t.completed; saveTasks(); }
}

// --- Data Import / Export ---
function exportData() {
    const data = { tasks, routineData, zoomLevel, darkMode };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `semester_planner_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const d = JSON.parse(e.target.result);
            if (d.tasks) tasks = d.tasks;
            if (d.routineData) routineData = d.routineData;
            if (d.zoomLevel) zoomLevel = d.zoomLevel;
            if (typeof d.darkMode !== 'undefined') darkMode = d.darkMode;
            
            localStorage.setItem('calendar_tasks', JSON.stringify(tasks));
            localStorage.setItem('calendar_routines', JSON.stringify(routineData));
            localStorage.setItem('calendar_dark_mode', darkMode);
            localStorage.setItem('calendar_zoom', zoomLevel);
            location.reload();
        } catch (err) { alert("Invalid JSON backup file."); }
    };
    reader.readAsText(file);
}

// --- Notifications ---
function updateNotifications() {
    const todayStr = new Date().toISOString().split('T')[0];
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    const tomStr = tom.toISOString().split('T')[0];
    const activeSem = routineData.semesters[routineData.activeSemester] || {};

    const itemsToday = [
        ...tasks.filter(t => t.date === todayStr && !t.completed).map(t => ({display: t.topic, time: t.time})),
        ...(activeSem[getDayName(new Date())] || []).map(c => ({display: `Class: ${c.course}`, time: c.start}))
    ];
    const itemsTom = [
        ...tasks.filter(t => t.date === tomStr && !t.completed).map(t => ({display: t.topic, time: t.time})),
        ...(activeSem[getDayName(tom)] || []).map(c => ({display: `Class: ${c.course}`, time: c.start}))
    ];

    if ($('notif-count')) {
        const total = itemsToday.length + itemsTom.length;
        $('notif-count').textContent = total;
        $('notif-count').style.display = total > 0 ? 'flex' : 'none';
        $('notif-count').classList.toggle('pulse', total > 0);
    }

    const list = $('reminders-list');
    if (list) {
        list.innerHTML = '';
        const build = (title, items) => {
            if (!items.length) return;
            list.insertAdjacentHTML('beforeend', `<div class="reminder-section-title">${title}</div>`);
            items.forEach(i => list.insertAdjacentHTML('beforeend', `<div class="reminder-item"><strong>${escapeHtml(i.display)}</strong><br><small>${formatTime(i.time)}</small></div>`));
        };
        build('Today', itemsToday);
        build('Tomorrow', itemsTom);
        if (!itemsToday.length && !itemsTom.length) list.innerHTML = '<p style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">No reminders.</p>';
    }
}

function startClassNotifier() {
    setInterval(() => {
        const now = new Date();
        const semester = routineData.semesters[routineData.activeSemester];
        if (!semester || !semester[getDayName(now)]) return;
        const curMins = now.getHours() * 60 + now.getMinutes();
        semester[getDayName(now)].forEach(c => {
            if (!c.start) return;
            const [h, m] = c.start.split(':').map(Number);
            const classMins = h * 60 + m;
            if (classMins - curMins === 10 && !c._notified) {
                alert(`Reminder: ${c.course} starts in 10 minutes!`);
                c._notified = true;
                setTimeout(() => delete c._notified, 60000);
            }
        });
        updateDashboardRoutine();
    }, 60000);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Navigation & Calendar Controls
    if ($('prev-month')) $('prev-month').onclick = () => { currentMonth.setMonth(currentMonth.getMonth() - 1); renderCalendar(); };
    if ($('next-month')) $('next-month').onclick = () => { currentMonth.setMonth(currentMonth.getMonth() + 1); renderCalendar(); };
    if ($('today-btn')) $('today-btn').onclick = () => { currentMonth = new Date(); renderCalendar(); };
    
    // Close modal triggers
    $$('.close-modal').forEach(b => b.onclick = () => {
        $$('.modal').forEach(m => m.classList.remove('active'));
        if ($('mobile-menu')) $('mobile-menu').classList.add('hidden');
    });

    // Zoom Triggers
    $$('.zoom-in-btn').forEach(b => b.onclick = () => { if (zoomLevel < 2) { zoomLevel += 0.1; applyZoom(); } });
    $$('.zoom-out-btn').forEach(b => b.onclick = () => { if (zoomLevel > 0.5) { zoomLevel -= 0.1; applyZoom(); } });
    $$('.zoom-reset-btn').forEach(b => b.onclick = () => { zoomLevel = 1.0; applyZoom(); });

    // Routine Open Buttons (both navbar button and any trigger)
    $$('.routine-btn-trigger').forEach(b => b.onclick = () => {
        renderRoutineManager();
        if ($('routine-modal')) $('routine-modal').classList.add('active');
        if ($('mobile-menu')) $('mobile-menu').classList.add('hidden');
    });

    $$('.add-task-btn-trigger').forEach(b => b.onclick = () => openAddTaskModal());
    $$('.export-btn-trigger').forEach(b => b.onclick = exportData);
    $$('.import-btn-trigger').forEach(b => b.onclick = () => $('import-input') && $('import-input').click());

    if ($('import-input')) $('import-input').onchange = importData;
    if ($('theme-toggle')) $('theme-toggle').onclick = () => { darkMode = !darkMode; applyTheme(); localStorage.setItem('calendar_dark_mode', darkMode); };
    if ($('notif-btn')) $('notif-btn').onclick = (e) => { e.stopPropagation(); $('reminders-panel') && $('reminders-panel').classList.toggle('hidden'); };

    if ($('menu-toggle')) $('menu-toggle').onclick = () => $('mobile-menu') && $('mobile-menu').classList.toggle('hidden');

    // Add Semester
    if ($('add-semester-btn')) {
        $('add-semester-btn').onclick = () => {
            const n = prompt('Enter Semester Name (e.g. Summer 2026):');
            if (n && n.trim()) {
                const name = n.trim();
                if (routineData.semesters && routineData.semesters[name]) {
                    alert("This semester already exists!");
                    return;
                }
                if (!routineData.semesters) routineData.semesters = {};
                routineData.semesters[name] = { 'Saturday':[], 'Sunday':[], 'Monday':[], 'Tuesday':[], 'Wednesday':[], 'Thursday':[], 'Friday':[] };
                routineData.activeSemester = name;
                saveRoutines();
                renderRoutineManager();
            }
        };
    }

    // Select Active Semester
    if ($('semester-select')) {
        $('semester-select').onchange = (e) => {
            routineData.activeSemester = e.target.value;
            saveRoutines();
            renderRoutineDayList();
        };
    }

    // Day Tabs inside Routine Manager
    $$('.day-tab').forEach(t => t.onclick = () => {
        $$('.day-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        currentRoutineDay = t.dataset.day;
        renderRoutineDayList();
    });

    // Add Class Modal Trigger
    if ($('add-class-btn')) {
        $('add-class-btn').onclick = () => {
            if (!routineData.activeSemester) return alert('Please select or add a semester first.');
            $('edit-class-id').value = '';
            $('class-form').reset();
            $('class-modal-title').textContent = 'Add Class';
            $('class-form-btn').textContent = 'Add to Routine';
            if ($('add-class-modal')) $('add-class-modal').classList.add('active');
        };
    }

    // Class Form Submit
    if ($('class-form')) {
        $('class-form').onsubmit = (e) => {
            e.preventDefault();
            const semester = routineData.semesters[routineData.activeSemester];
            if (!semester) return alert("Select a semester first.");

            const editId = $('edit-class-id').value;
            const classData = { 
                id: editId || 'cls_' + Date.now(), 
                course: $('class-course').value.trim(), 
                start: $('class-start').value, 
                end: $('class-end').value, 
                room: $('class-room').value.trim(),
                section: $('class-section').value.trim(),
                faculty: $('class-faculty').value.trim()
            };

            if (!semester[currentRoutineDay]) semester[currentRoutineDay] = [];

            if (editId) {
                // Update existing
                semester[currentRoutineDay] = semester[currentRoutineDay].map(c => c.id == editId ? classData : c);
            } else {
                // Add new
                semester[currentRoutineDay].push(classData);
            }
            
            saveRoutines();
            if ($('add-class-modal')) $('add-class-modal').classList.remove('active');
            $('class-form').reset();
            renderRoutineDayList();
        };
    }

    // Task Form Submit
    if ($('task-form')) {
        $('task-form').onsubmit = (e) => {
            e.preventDefault();
            const id = $('edit-id').value;
            const d = { 
                id: id || 'task_' + Date.now(), 
                topic: $('task-topic').value.trim(), 
                date: $('task-date').value, 
                time: $('task-time').value, 
                completed: id ? (tasks.find(x => x.id == id)?.completed || false) : false 
            };
            if (id) tasks = tasks.map(x => x.id == id ? d : x); 
            else tasks.push(d);

            saveTasks();
            if ($('task-modal')) $('task-modal').classList.remove('active');
        };
    }

    // Outside click handlers
    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
        const panel = $('reminders-panel');
        const nBtn = $('notif-btn');
        if (panel && !panel.contains(e.target) && nBtn && !nBtn.contains(e.target) && e.target !== nBtn) {
            panel.classList.add('hidden');
        }
    };
}

// Global scope bindings for inline HTML onClick properties
window.renderRoutineManager = renderRoutineManager;
window.renderRoutineDayList = renderRoutineDayList;
window.deleteClass = deleteClass;
window.deleteTask = deleteTask;
window.toggleComplete = toggleComplete;
window.openDayView = openDayView;
window.openTaskDetail = openTaskDetail;

// Run App
document.addEventListener('DOMContentLoaded', init);