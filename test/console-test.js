/**
 * Eagle FSRS Memory Plugin - 控制台测试脚本
 * 在 Eagle 插件开发者工具控制台中运行
 */

const TestSuite = {
    // === 工具函数 ===
    log: (msg, type = 'info') => {
        const styles = {
            info: 'color: #2196f3',
            pass: 'color: #4caf50; font-weight: bold',
            fail: 'color: #f44336; font-weight: bold',
            section: 'color: #9c27b0; font-size: 14px; font-weight: bold'
        };
        console.log(`%c${msg}`, styles[type] || '');
    },

    assert: (condition, testName) => {
        if (condition) {
            TestSuite.log(`✅ PASS: ${testName}`, 'pass');
            return true;
        } else {
            TestSuite.log(`❌ FAIL: ${testName}`, 'fail');
            return false;
        }
    },

    // === 测试用例 ===

    // 1. LocalStorage 数据测试
    testLocalStorage: () => {
        TestSuite.log('\n📦 Testing LocalStorage...', 'section');

        const decks = JSON.parse(localStorage.getItem('eagle-fsrs-decks') || '[]');
        const db = JSON.parse(localStorage.getItem('eagle-fsrs-db') || '{}');
        const logs = JSON.parse(localStorage.getItem('eagle-fsrs-logs') || '{}');

        TestSuite.assert(Array.isArray(decks), 'Decks is array');
        TestSuite.assert(typeof db === 'object', 'DB is object');
        TestSuite.assert(typeof logs === 'object', 'Logs is object');

        TestSuite.log(`Found ${decks.length} deck(s)`, 'info');
        TestSuite.log(`Found ${Object.keys(db).length} card(s) in DB`, 'info');
        TestSuite.log(`Found ${Object.keys(logs).length} item(s) with logs`, 'info');

        return decks;
    },

    // 2. 卡组结构验证
    testDeckStructure: (decks) => {
        TestSuite.log('\n🗂️ Testing Deck Structure...', 'section');

        if (decks.length === 0) {
            TestSuite.log('No decks to test. Create a deck first.', 'info');
            return;
        }

        const deck = decks[0];
        TestSuite.assert(typeof deck.id === 'string', 'Deck has ID');
        TestSuite.assert(typeof deck.name === 'string', 'Deck has name');
        TestSuite.assert(Array.isArray(deck.folderIds), 'Deck has folderIds array');
        TestSuite.assert(typeof deck.settings === 'object', 'Deck has settings');
        TestSuite.assert(typeof deck.settings.request_retention === 'number', 'Settings has retention');
        TestSuite.assert(typeof deck.settings.limits === 'object', 'Settings has limits');

        TestSuite.log(`Deck: "${deck.name}" with ${deck.folderIds.length} folder(s)`, 'info');
    },

    // 3. Card 状态验证
    testCardStates: () => {
        TestSuite.log('\n🃏 Testing Card States...', 'section');

        const db = JSON.parse(localStorage.getItem('eagle-fsrs-db') || '{}');
        const keys = Object.keys(db);

        if (keys.length === 0) {
            TestSuite.log('No cards in DB. Review some cards first.', 'info');
            return;
        }

        const states = { 0: 0, 1: 0, 2: 0, 3: 0 }; // New, Learning, Review, Relearning
        const stateNames = ['New', 'Learning', 'Review', 'Relearning'];

        keys.forEach(key => {
            const card = db[key];
            if (card && typeof card.state === 'number') {
                states[card.state]++;
            }
        });

        TestSuite.log(`Card distribution:`, 'info');
        stateNames.forEach((name, i) => {
            TestSuite.log(`  ${name}: ${states[i]}`, 'info');
        });

        TestSuite.assert(keys.every(k => db[k].state >= 0 && db[k].state <= 3), 'All cards have valid state');
    },

    // 4. Review Logs 验证
    testReviewLogs: () => {
        TestSuite.log('\n📝 Testing Review Logs...', 'section');

        const logs = JSON.parse(localStorage.getItem('eagle-fsrs-logs') || '{}');
        const keys = Object.keys(logs);

        if (keys.length === 0) {
            TestSuite.log('No review logs found.', 'info');
            return;
        }

        let totalLogs = 0;
        let validLogs = 0;

        keys.forEach(key => {
            const itemLogs = logs[key];
            if (Array.isArray(itemLogs)) {
                totalLogs += itemLogs.length;
                itemLogs.forEach(log => {
                    if (log.rating && log.review) validLogs++;
                });
            }
        });

        TestSuite.log(`Total logs: ${totalLogs}`, 'info');
        TestSuite.assert(validLogs === totalLogs, 'All logs have rating and review date');
    },

    // 5. FSRS 参数验证
    testFSRSParams: (decks) => {
        TestSuite.log('\n⚙️ Testing FSRS Parameters...', 'section');

        if (decks.length === 0) return;

        const deck = decks[0];
        const { settings } = deck;

        TestSuite.assert(
            settings.request_retention >= 0.7 && settings.request_retention <= 0.99,
            `Retention in valid range (${settings.request_retention})`
        );

        TestSuite.assert(
            settings.maximum_interval > 0,
            `Max interval is positive (${settings.maximum_interval})`
        );

        if (settings.fsrs_params && settings.fsrs_params.length > 0) {
            TestSuite.log(`FSRS weights: [${settings.fsrs_params.slice(0, 5).join(', ')}...]`, 'info');
        }
    },

    // 6. 每日限制验证
    testDailyLimits: (decks) => {
        TestSuite.log('\n📊 Testing Daily Limits...', 'section');

        if (decks.length === 0) return;

        const deck = decks[0];
        const { limits } = deck.settings;

        TestSuite.assert(typeof limits.new === 'number', `New limit set (${limits.new})`);
        TestSuite.assert(typeof limits.review === 'number', `Review limit set (${limits.review})`);
    },

    // === 主测试函数 ===
    runAll: () => {
        TestSuite.log('🚀 Starting Eagle FSRS Plugin Tests...\n', 'section');

        const decks = TestSuite.testLocalStorage();
        TestSuite.testDeckStructure(decks);
        TestSuite.testCardStates();
        TestSuite.testReviewLogs();
        TestSuite.testFSRSParams(decks);
        TestSuite.testDailyLimits(decks);

        TestSuite.log('\n✨ Test Suite Complete!\n', 'section');
    }
};

// 运行所有测试
TestSuite.runAll();
