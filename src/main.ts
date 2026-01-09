import { FSRS, Card, Rating, State, generatorParameters, FSRSParameters, createEmptyCard, ReviewLog } from 'ts-fsrs';

declare const eagle: any;

// --- Interfaces ---
interface Deck {
    id: string; // UUID
    name: string;
    folderIds: string[];
    settings: {
        request_retention: number;
        maximum_interval: number;
        limits: {
            new: number;
            review: number;
        };
        learning_steps: string;
        fsrs_params: number[]; // Array of weights
        reschedule: boolean;
    };
}

// --- State ---
let decks: Deck[] = [];
let db: { [key: string]: Card } = {}; // Global DB for all items (itemId -> Card)
let logs: { [key: string]: ReviewLog[] } = {}; // Global Logs (itemId -> logs[])
let currentDeck: Deck | null = null;
let currentFsrs: FSRS | null = null;
let reviewQueue: { item: any, card: Card }[] = [];
let currentCard: Card | null = null;
let currentItem: any = null;

// --- DOM Elements ---
let views: any = {};
let els: any = {};
// --- Initialization ---
eagle.onPluginCreate(async () => {
    console.log('FSRS Plugin: Init start');

    // Initialize DOM elements here, after DOM is ready (?)
    // Eagle might fire onPluginCreate before DOMContentLoaded? 
    // Let's rely on standard DOMContentLoaded inside if needed, but usually onPluginCreate is safe.
    // Re-assign els here to be sure.

    views.dashboard = document.getElementById('view-dashboard');
    views.editor = document.getElementById('view-editor');
    views.review = document.getElementById('view-review');

    // Theme Toggle Logic
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            const current = document.body.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        };
    }

    // Initialize Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
    } else {
        // Auto-detect Eagle theme (if available) or default to light
        if (eagle.app && eagle.app.isDarkColors) {
            document.body.setAttribute('data-theme', 'dark');
        }
    }

    // DOM Elements Binding
    els.deckList = document.getElementById('deck-list');
    els.btnCreateDeck = document.getElementById('btn-create-deck');

    // Editor config
    els.editorTitle = document.getElementById('editor-title');
    els.inputDeckName = document.getElementById('input-deck-name');
    els.folderSelector = document.getElementById('folder-selector');

    // Config Inputs
    els.inputLimitNew = document.getElementById('input-limit-new');
    els.inputLimitReview = document.getElementById('input-limit-review');
    els.inputLearningSteps = document.getElementById('input-learning-steps');
    els.inputRetention = document.getElementById('input-retention');
    els.inputFsrsParams = document.getElementById('input-fsrs-params');
    els.checkReschedule = document.getElementById('check-reschedule');

    els.btnSaveDeck = document.getElementById('btn-save-deck');
    els.btnCancelDeck = document.getElementById('btn-cancel-deck');
    els.btnFsrsOptimize = document.getElementById('btn-fsrs-optimize');
    els.btnFsrsEvaluate = document.getElementById('btn-fsrs-evaluate');

    // Review
    els.cardImage = document.getElementById('card-image');
    els.cardError = document.getElementById('card-error');
    els.cardErrorDetail = document.getElementById('card-error-detail');
    els.btnQuitReview = document.getElementById('btn-quit-review');
    els.btnEditItem = document.getElementById('btn-edit-item');

    // Sidebar Elements
    els.infoName = document.getElementById('info-name');
    els.infoRating = document.getElementById('info-rating');
    els.infoTags = document.getElementById('info-tags');
    els.infoNotes = document.getElementById('info-notes');

    els.timeLabels = {
        [Rating.Again]: document.getElementById('time-again'),
        [Rating.Hard]: document.getElementById('time-hard'),
        [Rating.Good]: document.getElementById('time-good'),
        [Rating.Easy]: document.getElementById('time-easy')
    };

    els.btns = {
        [Rating.Again]: document.getElementById('btn-again'),
        [Rating.Hard]: document.getElementById('btn-hard'),
        [Rating.Good]: document.getElementById('btn-good'),
        [Rating.Easy]: document.getElementById('btn-easy')
    };

    // Check elements
    for (const key in els) {
        // @ts-ignore
        const el = els[key];
        if (typeof el === 'object' && key !== 'btns') {
            if (!el) console.error(`DOM Element missing: ${key}`);
        }
    }

    // Fix: Input focus issues in Eagle Plugin environment
    // Eagle plugins run in a webview where some global listeners might hijack focus/inputs
    // Fix: Input focus issues in Eagle Plugin environment
    // Eagle plugins run in a webview where some global listeners might hijack focus/inputs
    // Focus fix removed to restore typing functionality
    // If shortcut conflicts return, we will need a more targeted fix.

    loadData();

    // Bind Events
    if (els.btnCreateDeck) {
        els.btnCreateDeck.addEventListener('click', () => {
            console.log('Button: Create Deck Clicked');
            openEditor();
        });
    } else {
        console.error('btnCreateDeck not found!');
    }

    if (els.btnSaveDeck) els.btnSaveDeck.addEventListener('click', () => {
        console.log('Button: Save Deck Clicked');
        saveDeckFromEditor();
    });

    if (els.btnCancelDeck) els.btnCancelDeck.addEventListener('click', () => {
        console.log('Button: Cancel Clicked');
        switchView('dashboard');
    });

    if (els.btnQuitReview) els.btnQuitReview.addEventListener('click', () => {
        console.log('Button: Quit Review Clicked');
        stopSession();
    });

    // Helper: Open current item in Eagle (Deep Link)
    const openInEagle = () => {
        if (currentItem) {
            const link = `eagle://item/${currentItem.id}`;
            if (typeof eagle.shell.openExternal === 'function') {
                eagle.shell.openExternal(link);
            } else if (currentItem.filePath && typeof eagle.shell.openPath === 'function') {
                eagle.shell.openPath(currentItem.filePath);
            }
        }
    };

    if (els.btnEditItem) {
        els.btnEditItem.addEventListener('click', openInEagle);
    }

    // Note: Sidebar double-click editing is now handled in renderSidebar()

    // Rating Buttons
    [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].forEach(r => {
        if (els.btns[r]) {
            els.btns[r].addEventListener('click', () => {
                console.log(`Button: Rate ${r} Clicked`);
                rate(r);
            });
        }
    });

    console.log('FSRS Plugin: Events Bound');

    // Help Tooltips
    const helpIcons = document.querySelectorAll('.icon-help');
    helpIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.target as HTMLElement;
            const header = target.parentElement;
            if (header) {
                const helpDiv = header.nextElementSibling as HTMLElement;
                if (helpDiv && helpDiv.classList.contains('settings-help')) {
                    const isHidden = helpDiv.style.display === 'none';
                    helpDiv.style.display = isHidden ? 'block' : 'none';
                }
            }
        });
    });

    bindOptimizeButton();
    renderDashboard();
});

// --- Data Management ---
function getDbKey(deckId: string, itemId: string) {
    return `${deckId}_${itemId}`;
}
function loadData() {
    try {
        // Load DB
        const dbRaw = localStorage.getItem('eagle-fsrs-db');
        if (dbRaw) {
            const json = JSON.parse(dbRaw);
            for (const k in json) {
                const c = json[k];
                c.due = new Date(c.due);
                c.last_review = c.last_review ? new Date(c.last_review) : undefined;
                db[k] = c as Card;
            }
        }

        // Load Logs
        const logsRaw = localStorage.getItem('eagle-fsrs-logs');
        if (logsRaw) {
            const json = JSON.parse(logsRaw);
            for (const k in json) {
                const list = json[k];
                // Restore dates
                list.forEach((l: any) => {
                    l.due = new Date(l.due);
                    l.review = new Date(l.review);
                });
                logs[k] = list as ReviewLog[];
            }
        } else {
            logs = {};
        }

        // Load Decks
        const decksRaw = localStorage.getItem('eagle-fsrs-decks');
        if (decksRaw) {
            decks = JSON.parse(decksRaw);
        }
    } catch (e) {
        console.error("Failed to load data", e);
    }
}


function saveData() {
    localStorage.setItem('eagle-fsrs-db', JSON.stringify(db));
    localStorage.setItem('eagle-fsrs-decks', JSON.stringify(decks));
    localStorage.setItem('eagle-fsrs-logs', JSON.stringify(logs));
}

// --- View Management ---
function switchView(viewName: 'dashboard' | 'editor' | 'review') {
    views.dashboard.style.display = 'none';
    views.editor.style.display = 'none';
    views.review.style.display = 'none';
    views[viewName].style.display = 'block';

    if (viewName === 'dashboard') renderDashboard();
}

// --- Dashboard Logic ---
// --- Dashboard Logic ---
async function renderDashboard() {
    els.deckList.innerHTML = '';

    if (decks.length === 0) {
        els.deckList.innerHTML = '<div style="color:#888; width:100%; margin-top:50px;">还没有卡组，点击上方 "+ 新建卡组" 创建一个吧！</div>';
        return;
    }

    // Create Table Header
    const table = document.createElement('div');
    table.className = 'deck-table';
    table.innerHTML = `
        <div class="deck-header">
            <div class="col-name">牌组</div>
            <div class="col-stat text-new">未学习</div>
            <div class="col-stat text-learn">学习中</div>
            <div class="col-stat text-due">待复习</div>
            <div class="col-ops">选项</div>
        </div>
    `;

    for (const deck of decks) {
        const stats = await calculateDeckStats(deck);

        const row = document.createElement('div');
        row.className = 'deck-row';
        row.innerHTML = `
            <div class="col-name" style="cursor:pointer; display:flex; align-items:center;">
                <span style="margin-right:8px;">${deck.name}</span>
            </div>
            <div class="col-stat text-new">${stats.newCount}</div>
            <div class="col-stat text-learn">${stats.learnCount}</div>
            <div class="col-stat text-due">${stats.dueCount}</div>
            <div class="col-ops">
                 <button class="btn-icon btn-edit" title="配置">⚙</button>
                 <button class="btn-icon btn-delete" title="删除">🗑</button>
            </div>
        `;

        // Click name or row to start
        const nameCol = row.querySelector('.col-name') as HTMLElement;
        nameCol.onclick = () => startSession(deck);

        // Options
        const btnEdit = row.querySelector('.btn-edit') as HTMLElement;
        btnEdit.onclick = (e) => { e.stopPropagation(); openEditor(deck); };

        const btnDelete = row.querySelector('.btn-delete') as HTMLElement;
        btnDelete.onclick = (e) => { e.stopPropagation(); deleteDeck(deck.id); };

        table.appendChild(row);
    }

    els.deckList.appendChild(table);
}

async function calculateDeckStats(deck: Deck) {
    const items = await fetchItemsForDeck(deck);
    let totalNewInDeck = 0;  // All cards that are still "new" in DB
    let learnCount = 0;      // Learning + Relearning
    let dueCount = 0;        // Review && due <= now

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count how many NEW cards were studied TODAY (first review = new card graduating)
    let todayNewStudied = 0;

    items.forEach(item => {
        const key = getDbKey(deck.id, item.id);
        const card = db[key];
        const itemLogs = logs[key];

        if (!card) {
            // Not in DB = completely new
            totalNewInDeck++;
        } else {
            if (card.state === State.New) {
                totalNewInDeck++;
            } else if (card.state === State.Learning || card.state === State.Relearning) {
                learnCount++;
            } else if (card.state === State.Review) {
                if (card.due <= now) {
                    dueCount++;
                }
            }

            // Check if this card was NEW and studied TODAY (first log is today)
            if (itemLogs && itemLogs.length > 0) {
                const firstLog = itemLogs[0];
                const firstReviewDate = new Date(firstLog.review);
                if (firstReviewDate >= todayStart && itemLogs.length === 1) {
                    // This card just graduated from New TODAY
                    // (Only count if it has exactly 1 log, meaning first review was today)
                    // More robust: check if state was New before first log
                    todayNewStudied++;
                } else if (itemLogs.length >= 1) {
                    // Check if the first review happened today for cards with history
                    const firstReviewDate = new Date(itemLogs[0].review);
                    if (firstReviewDate >= todayStart) {
                        todayNewStudied++;
                    }
                }
            }
        }
    });

    // Calculate remaining quota for today
    const limitNew = deck.settings.limits?.new || 20;
    const limitReview = deck.settings.limits?.review || 200;

    // Remaining NEW cards to study TODAY = min(totalNewInDeck, limit - alreadyStudiedToday)
    const remainingNewQuota = Math.max(0, limitNew - todayNewStudied);
    const newCount = Math.min(totalNewInDeck, remainingNewQuota);

    dueCount = Math.min(dueCount, limitReview);

    return { total: items.length, newCount, learnCount, dueCount };
}

async function fetchItemsForDeck(deck: Deck): Promise<any[]> {
    if (!deck.folderIds || deck.folderIds.length === 0) return [];

    try {
        let allItems: any[] = [];
        for (const fid of deck.folderIds) {
            let items: any[] = [];
            // Try standard API
            if (typeof eagle.item.get === 'function') {
                items = await eagle.item.get({ folders: [fid] });
            } else if (typeof eagle.item.getList === 'function') {
                items = await eagle.item.getList({ folders: [fid] });
            }

            if (Array.isArray(items)) {
                allItems = allItems.concat(items);
            }
        }
        return allItems;
    } catch (e) {
        console.error("Fetch items failed", e);
        return [];
    }
}

function deleteDeck(id: string) {
    if (confirm('确定要删除这个卡组吗？该卡组的复习进度将被彻底删除。')) {
        // Cleanup DB and Logs
        const prefix = id + "_";
        for (const k in db) {
            if (k.startsWith(prefix)) delete db[k];
        }
        for (const k in logs) {
            if (k.startsWith(prefix)) delete logs[k];
        }
        decks = decks.filter(d => d.id !== id);
        saveData();
        renderDashboard();
    }
}

// --- Editor Logic ---
let editingDeckId: string | null = null;
let selectedFolderIds: Set<string> = new Set();

async function openEditor(deck?: Deck) {
    switchView('editor');

    // Reset Form
    editingDeckId = null;
    selectedFolderIds.clear();
    els.editorTitle.innerText = '新建卡组';
    els.folderSelector.innerHTML = '加载中...';

    // Default Values
    if (els.inputDeckName) els.inputDeckName.value = '';
    if (els.inputLimitNew) els.inputLimitNew.value = '20';
    if (els.inputLimitReview) els.inputLimitReview.value = '200';
    if (els.inputLearningSteps) els.inputLearningSteps.value = '1m 10m';
    if (els.inputRetention) els.inputRetention.value = '0.90';
    if (els.inputFsrsParams) els.inputFsrsParams.value = ''; // Use placeholder
    if (els.checkReschedule) els.checkReschedule.checked = false;

    // Populate if editing
    if (deck) {
        editingDeckId = deck.id;
        els.editorTitle.innerText = '编辑卡组';
        if (els.inputDeckName) els.inputDeckName.value = deck.name;

        if (deck.folderIds) {
            deck.folderIds.forEach(id => selectedFolderIds.add(id));
        }

        if (deck.settings) {
            if (els.inputRetention) els.inputRetention.value = (deck.settings.request_retention || 0.9).toString();

            if (els.inputLimitNew) els.inputLimitNew.value = (deck.settings.limits?.new || 20).toString();
            if (els.inputLimitReview) els.inputLimitReview.value = (deck.settings.limits?.review || 200).toString();
            if (els.inputLearningSteps) els.inputLearningSteps.value = deck.settings.learning_steps || '1m 10m';
            if (els.checkReschedule) els.checkReschedule.checked = deck.settings.reschedule || false;

            // FSRS Params
            if (els.inputFsrsParams && deck.settings.fsrs_params) {
                els.inputFsrsParams.value = deck.settings.fsrs_params.join(', ');
            }
        }
    }

    // Load Folders
    await renderFolderTree();
}

async function rescheduleDeck(deck: Deck) {
    if (!els.checkReschedule.checked) return;

    console.log("Rescheduling deck:", deck.name);
    // Init FSRS with NEW params
    const p = generatorParameters({
        request_retention: deck.settings.request_retention,
        maximum_interval: deck.settings.maximum_interval,
        w: deck.settings.fsrs_params
    });
    const f = new FSRS(p);

    // Find all items in deck
    const items = await fetchItemsForDeck(deck);
    let count = 0;

    items.forEach(item => {
        const itemLogs = logs[getDbKey(deck.id, item.id)];
        if (itemLogs && itemLogs.length > 0) {
            // Replay History
            // Sort logs by review date just in case
            itemLogs.sort((a, b) => new Date(a.review).getTime() - new Date(b.review).getTime());

            // Start from Empty
            let card = createEmptyCard(new Date(itemLogs[0].review)); // Initial date? Or empty?
            // createEmptyCard default is now.
            // Actually first repeat needs 'Now'.
            // Replay:
            // 1. First review: State.New. repeat(card, log.review).
            // But we need the STATE at that time.
            // Simplified Replay:
            // Reset card to New.
            card = createEmptyCard();

            itemLogs.forEach(log => {
                const reviewTime = new Date(log.review);
                const scheduling = f.repeat(card, reviewTime);
                // log.rating is the rating used.
                card = (scheduling as any)[log.rating].card;
            });

            // Update DB
            db[getDbKey(deck.id, item.id)] = card;
            count++;
        }
    });

    console.log(`Rescheduled ${count} cards.`);
    saveData();
}

async function renderFolderTree() {
    let folders: any[] = [];

    try {
        // Try various API methods likely to exist
        if (typeof eagle.folder.getAll === 'function') {
            folders = await eagle.folder.getAll();
        } else if (typeof eagle.folder.list === 'function') {
            folders = await eagle.folder.list();
        } else if (typeof eagle.folder.get === 'function') {
            // Try get without args or with empty object
            folders = await eagle.folder.get();
        }
    } catch (e) {
        console.error("Failed to fetch folders via API", e);
    }

    console.log("Fetched folders:", folders);

    // folders is a tree structure
    els.folderSelector.innerHTML = '';
    if (!folders || folders.length === 0) {
        els.folderSelector.innerHTML = '<div style="padding:10px; color:#aaa;">无法获取文件夹或列表为空。<br>请尝试重启插件。</div>';
        // Mock for debugging if empty
        // folders = [{ id: 'mock', name: 'Mock Folder', children: [] }];
        return;
    }

    const createNode = (folder: any, level: number) => {
        const div = document.createElement('div');
        div.className = 'folder-item';
        // Base padding 12px + 16px per level
        div.style.paddingLeft = `${level * 16 + 12}px`;
        div.innerHTML = `
            <span class="icon">${selectedFolderIds.has(folder.id) ? '☑' : '☐'}</span> 
            <span class="name">${folder.name}</span>
        `;

        if (selectedFolderIds.has(folder.id)) div.classList.add('selected');

        div.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedFolderIds.has(folder.id)) {
                selectedFolderIds.delete(folder.id);
                div.classList.remove('selected');
                div.querySelector('.icon')!.innerHTML = '☐';
            } else {
                selectedFolderIds.add(folder.id);
                div.classList.add('selected');
                div.querySelector('.icon')!.innerHTML = '☑';
            }
        });

        els.folderSelector.appendChild(div);

        if (folder.children && folder.children.length > 0) {
            folder.children.forEach((child: any) => createNode(child, level + 1));
        }
    };

    folders.forEach((f: any) => createNode(f, 0));
}

async function saveDeckFromEditor() {
    const name = els.inputDeckName.value.trim();
    if (!name) {
        alert('Deck name is required!');
        return;
    }

    // Parse Settings
    const limitNew = parseInt(els.inputLimitNew.value) || 20;
    const limitReview = parseInt(els.inputLimitReview.value) || 200;
    const learningSteps = els.inputLearningSteps.value.trim() || '1m 10m';
    const retention = parseFloat(els.inputRetention.value) || 0.9;

    // Parse Weights
    let w: number[] = [];
    try {
        const rawW = els.inputFsrsParams.value.trim();
        w = rawW.split(/[\s,]+/).map((s: string) => parseFloat(s)).filter((n: number) => !isNaN(n));
        if (w.length !== 17 && w.length !== 19) { // Simple validation (FSRS v4 vs v5?)
            // Allow flexible length for now, just warning if critical
            console.warn('FSRS weights length suspicious:', w.length);
        }
    } catch (e) {
        console.error('Error parsing weights', e);
        w = [...generatorParameters({ enable_fuzz: false }).w];
    }
    if (w.length === 0) w = [...generatorParameters({ enable_fuzz: false }).w];

    const reschedule = els.checkReschedule.checked;

    const newDeck: Deck = {
        id: editingDeckId ? editingDeckId : crypto.randomUUID(),
        name: name,
        folderIds: Array.from(selectedFolderIds),
        settings: {
            request_retention: retention,
            maximum_interval: 36500, // Default to 100 years
            limits: {
                new: limitNew,
                review: limitReview
            },
            learning_steps: learningSteps,
            fsrs_params: w,
            reschedule: reschedule
        }
    };

    if (editingDeckId) {
        // Update
        const index = decks.findIndex(d => d.id === editingDeckId);
        if (index !== -1) {
            decks[index] = newDeck;
        } else {
            decks.push(newDeck); // Should not happen but fallback
        }
    } else {
        // Create
        decks.push(newDeck);
    }

    if (reschedule && currentDeck) {
        // Only reschedule if editing existing deck? Or also new? (New has no cards)
        // Actually we should use editingDeckId to find previous deck, but we already have newDeck.
        await rescheduleDeck(newDeck);
    } else if (reschedule && !currentDeck) {
        // New deck, nothing to reschedule
    }

    saveData();
    switchView('dashboard');
    currentDeck = null;
    editingDeckId = null; // Clear editing state
}

// --- FSRS Optimize (Placeholder) ---
// Note: Real optimization requires fsrs-optimizer (Wasm/Python) which is too heavy for this plugin currently.
function bindOptimizeButton() {
    if (els.btnFsrsOptimize) {
        els.btnFsrsOptimize.addEventListener('click', (e) => {
            e.preventDefault();
            // Show non-blocking toast instead of focus-stealing alert
            showToast('FSRS Optimizer 暂未集成 (需 Wasm 支持)。请使用默认参数或手动输入。');
        });
    }
}

// Non-blocking toast notification
function showToast(message: string, duration = 3000) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            transition: opacity 0.3s;
            max-width: 80%;
            text-align: center;
        `;
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    toast.style.display = 'block';
    setTimeout(() => {
        toast!.style.opacity = '0';
        setTimeout(() => { toast!.style.display = 'none'; }, 300);
    }, duration);
}
// Call this in Init


// --- Review Session ---
async function startSession(deck: Deck) {
    currentDeck = deck;

    // Init FSRS with deck settings
    const p = generatorParameters({
        request_retention: deck.settings.request_retention,
        maximum_interval: deck.settings.maximum_interval,
        w: deck.settings.fsrs_params
    });
    currentFsrs = new FSRS(p);

    // Fetch items
    const items = await fetchItemsForDeck(deck);
    if (items.length === 0) {
        alert('该卡组没有图片！');
        return;
    }

    const now = new Date();
    reviewQueue = [];

    // Limit Config
    const limitNew = deck.settings.limits?.new || 20;
    const limitReview = deck.settings.limits?.review || 200;
    let countNew = 0;
    let countReview = 0;

    // Separate potential cards into New and Review lists first to apply limits?
    // Or just iterate and stop when limits hit?

    // Anki logic: 
    // Filter out Suspended cards (not implemented yet)

    // Sort items by some criteria? Random for New?
    // For now simple iteration

    for (const item of items) {
        let card = db[getDbKey(deck.id, item.id)];

        if (!card) {
            // New Card
            if (countNew < limitNew) {
                // Initialize new card
                card = {
                    due: now,
                    stability: 0,
                    difficulty: 0,
                    elapsed_days: 0,
                    scheduled_days: 0,
                    reps: 0,
                    lapses: 0,
                    state: State.New,
                    last_review: undefined
                } as Card;

                reviewQueue.push({ item, card });
                countNew++;
            }
        } else if (card.state === State.New) {
            // Existing New Card (seen but still new-ish? or manually reset?)
            // Treat as New for limit purposes
            if (countNew < limitNew) {
                reviewQueue.push({ item, card });
                countNew++;
            }
        } else if (card.due <= now) {
            // Review Card
            if (countReview < limitReview) {
                reviewQueue.push({ item, card });
                countReview++;
            }
        }
    }

    // Sort: Reviews first, then New? Or Interleaved?
    // User Settings "New/Review Order" is meant to control this.
    // For now: Sort by Due Date (Reviews usually have earlier dates).
    reviewQueue.sort((a, b) => a.card.due.getTime() - b.card.due.getTime());

    if (reviewQueue.length === 0) {
        alert('恭喜！所有卡片大吉大利，今晚吃鸡！（今日任务已完成）');
        return;
    }

    switchView('review');
    nextCardLoop();
}

function stopSession() {
    currentDeck = null;
    switchView('dashboard');
}

async function nextCardLoop() {
    if (reviewQueue.length === 0) {
        alert('卡组复习完成！');
        stopSession();
        return;
    }

    const next = reviewQueue.shift();
    if (!next) return;

    currentItem = next.item;
    currentCard = next.card;

    // --- Image Handling Fix ---
    let src = '';
    if (currentItem.thumbnailUrl) {
        src = currentItem.thumbnailUrl;
    } else if (currentItem.fileURL) {
        src = currentItem.fileURL;
    } else if (currentItem.filePath) {
        src = 'file:///' + currentItem.filePath.replace(/\\/g, '/');
    }

    // Reset UI
    els.cardImage.style.display = 'none';
    els.cardError.style.display = 'none';
    els.cardImage.src = src;

    // Load handler
    els.cardImage.onload = () => {
        els.cardImage.style.display = 'block';
    };
    els.cardImage.onerror = () => {
        console.error("Image failed to load:", src);
        if (currentItem.url && currentItem.url.startsWith('http')) {
            els.cardImage.src = currentItem.url;
            return;
        }
        els.cardError.style.display = 'block';
        els.cardErrorDetail.innerText = `Path: ${src}\nID: ${currentItem.id}`;
    };

    // sidebar
    renderSidebar();

    // --- Update Interval Labels (Anki Style) ---
    if (currentFsrs && currentCard) {
        const now = new Date();
        const scheduling_cards = currentFsrs.repeat(currentCard, now);
        updateIntervalLabels(scheduling_cards, now);
    }
}

function updateIntervalLabels(scheduling_cards: any, now: Date) {
    const ratings = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

    ratings.forEach(r => {
        const record = scheduling_cards[r];
        const el = els.timeLabels[r];
        if (record && el) {
            const due = record.card.due;
            const diff = due.getTime() - now.getTime();
            el.innerText = formatInterval(diff);
        }
    });
}

function formatInterval(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 365) return `${(days / 365).toFixed(1)}年`;
    if (days >= 30) return `${(days / 30).toFixed(1)}月`;
    if (days >= 1) return `${days}天`;
    if (hours >= 1) return `${hours}时`;
    if (minutes >= 1) return `${minutes}分`;
    return `<1分`;
}

function rate(rating: Rating) {
    if (!currentCard || !currentItem || !currentFsrs) return;

    const now = new Date();
    const scheduling_cards = currentFsrs.repeat(currentCard, now);
    const record = (scheduling_cards as any)[rating];
    const processedCard = record.card;
    const log = record.log;

    if (!currentDeck) return;
    const key = getDbKey(currentDeck.id, currentItem.id);

    // Update DB
    db[key] = processedCard;

    // Save Log
    if (!logs[key]) logs[key] = [];
    logs[key].push(log);

    saveData();

    // Requeue logic: If interval is short (<= 5 mins), add back to queue
    const dueTime = processedCard.due.getTime();
    if (dueTime <= now.getTime() + 5 * 60 * 1000) {
        reviewQueue.push({ item: currentItem, card: processedCard });
    }

    nextCardLoop();
}

// --- Sidebar & Editing Helpers ---

function renderSidebar() {
    if (!currentItem) return;

    // Name
    if (els.infoName) {
        els.infoName.innerText = currentItem.name || '无标题';
        els.infoName.title = "双击编辑标题";
        els.infoName.style.cursor = "text";
        els.infoName.ondblclick = () => editField(els.infoName, 'name');
    }

    // Notes
    if (els.infoNotes) {
        els.infoNotes.innerText = currentItem.annotation || '暂无注释';
        els.infoNotes.title = "双击编辑注释";
        els.infoNotes.style.cursor = "text";
        els.infoNotes.ondblclick = () => editField(els.infoNotes, 'annotation', true);
    }

    // Tags
    if (els.infoTags) {
        els.infoTags.innerHTML = '';
        const tags = currentItem.tags || [];

        // Add Edit Button to Label if not present
        const tagSection = els.infoTags.parentElement; // .info-section
        if (tagSection) {
            let labelDiv = tagSection.querySelector('.info-label') as HTMLElement;
            if (labelDiv && !labelDiv.querySelector('.btn-edit-small')) {
                const editBtn = document.createElement('span');
                editBtn.className = 'btn-edit-small';
                editBtn.innerText = ' ✏️';
                editBtn.style.cursor = 'pointer';
                editBtn.style.opacity = '0.7';
                editBtn.title = "点击编辑标签";
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    editTags(els.infoTags);
                };
                labelDiv.appendChild(editBtn);
            }
        }

        // Render Tags
        if (tags.length === 0) {
            els.infoTags.innerText = '-';
        } else {
            tags.forEach((tag: string) => {
                const sp = document.createElement('span');
                sp.className = 'tag-badge';
                sp.innerText = tag;
                sp.style.cursor = 'pointer';
                sp.title = `双击复制 "${tag}"`;
                sp.ondblclick = async (e) => {
                    e.stopPropagation();
                    try {
                        await navigator.clipboard.writeText(tag);
                        console.log("Tag copied:", tag);
                        // Visual feedback (Green flash)
                        const originalBg = sp.style.background;
                        sp.style.background = '#52c41a';
                        setTimeout(() => {
                            sp.style.background = originalBg;
                        }, 500);
                    } catch (err) {
                        console.error('Failed to copy', err);
                    }
                };
                els.infoTags.appendChild(sp);
            });
        }

        // Remove container dblclick (prevent override)
        els.infoTags.ondblclick = null;
        els.infoTags.style.cursor = "default";
        els.infoTags.title = "";
    }

    // Rating
    if (els.infoRating) {
        renderRating(els.infoRating, currentItem.star || 0);
    }
}

function renderRating(el: HTMLElement, currentStar: number) {
    el.innerHTML = '';
    el.title = "点击星星修改评分";
    el.style.cursor = "pointer";

    for (let i = 1; i <= 5; i++) {
        const span = document.createElement('span');
        span.innerText = i <= currentStar ? '⭐' : '☆';
        span.style.padding = '0 2px';
        span.onclick = (e) => {
            e.stopPropagation();
            updateItemAPI({ star: i });
        };
        el.appendChild(span);
    }
    // Clear rating on long press or specific action? 
    // For now simple click sets 1-5.
}

function editField(el: HTMLElement, prop: string, isTextarea = false) {
    const originalValue = currentItem[prop] || '';
    el.ondblclick = null; // Disable dblclick while editing
    el.innerHTML = '';

    const input = document.createElement(isTextarea ? 'textarea' : 'input') as HTMLInputElement | HTMLTextAreaElement;
    input.value = originalValue;
    input.className = 'editing-input';

    if (isTextarea) {
        // Auto-grow height
        input.style.height = 'auto'; // Reset
        input.style.height = el.offsetHeight + 'px'; // Start with current
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        });
        // Initial adjust
        setTimeout(() => {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        }, 0);
    }

    const save = async () => {
        const newValue = input.value.trim();
        if (newValue !== originalValue) {
            await updateItemAPI({ [prop]: newValue });
        } else {
            renderSidebar(); // Revert
        }
    };

    input.onblur = save;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            if (!isTextarea || e.ctrlKey) {
                e.preventDefault(); // Stop newline
                input.blur();
            }
        }
        if (e.key === 'Escape') {
            renderSidebar();
        }
        e.stopPropagation(); // Stop FSRS shortcuts
    };

    el.appendChild(input);
    input.focus();
}

function editTags(el: HTMLElement) {
    const originalTags = currentItem.tags || [];
    const str = originalTags.join(', ');
    el.ondblclick = null;
    el.innerHTML = '';

    const input = document.createElement('input');
    input.value = str;
    input.className = 'editing-input';

    const save = async () => {
        const val = input.value;
        // Split by comma/chinese comma
        const newTags = val.split(/[,，]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // Dedup
        const uniqueTags = [...new Set(newTags)];
        await updateItemAPI({ tags: uniqueTags });
    };

    input.onblur = save;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
        if (e.key === 'Escape') {
            renderSidebar();
        }
        e.stopPropagation();
    };

    el.appendChild(input);
    input.focus();
}

async function updateItemAPI(props: any) {
    if (!currentItem) return;
    try {
        // Optimistic local update for UI
        Object.assign(currentItem, props);
        renderSidebar();

        // Call Eagle API
        // Pattern: Get item instance -> Modify -> item.save()
        let itemToSave: any = currentItem;

        // If currentItem doesn't have .save(), try to fetch it
        if (typeof (itemToSave as any).save !== 'function') {
            if (eagle.item && (eagle.item as any).getById) {
                itemToSave = await (eagle.item as any).getById(currentItem.id);
            }
        }

        if (itemToSave && typeof (itemToSave as any).save === 'function') {
            Object.assign(itemToSave, props);
            await (itemToSave as any).save();
            console.log("Saved item:", props);
        } else {
            console.warn("Item.save() method not found", itemToSave);
            // Fallback: try eagle.item.update if it existed (it doesn't), or alert user
            alert("无法保存修改: API 不支持");
        }
    } catch (e) {
        console.error("Failed to update item:", e);
        alert("更新失败");
        renderSidebar();
    }
}

// Utility
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
