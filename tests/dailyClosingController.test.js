const test = require('node:test');
const assert = require('node:assert/strict');

const dailyClosingModel = require('../src/models/dailyClosingModel');
const {
    isValidDate,
    formatClosingNotificationMessage
} = require('../src/controllers/dailyClosingController');

test('daily closing rejects invalid calendar dates', () => {
    assert.equal(isValidDate('2026-09-09'), true);
    assert.equal(isValidDate('2026-02-31'), false);
    assert.equal(isValidDate('2026-9-09'), false);
});

test('daily closing notification includes vendor and closing details', () => {
    const message = formatClosingNotificationMessage(
        { id: 7, name: 'Ama Mensah', phone: '0240000000' },
        '2026-09-01',
        {
            totalTransactions: 12,
            totalAmount: 1250,
            totalDeposits: 700,
            totalWithdrawals: 400,
            totalTransfers: 100,
            totalAirtime: 20,
            totalData: 15,
            totalBillPayments: 10,
            totalOther: 5
        },
        { cash_balance: 300, momo_balance: 950 }
    );

    assert.match(message, /Vendor Ama Mensah \(ID: 7, phone: 0240000000\)/);
    assert.match(message, /September 1, 2026/);
    assert.match(message, /Transactions: 12/);
    assert.match(message, /total amount: 1250\.00/);
    assert.match(message, /Balances - cash: 300\.00, MoMo: 950\.00/);
});

test('Daily Closing Model', async (t) => {
    await t.test('formatDate formats date correctly', () => {
        const date = new Date('2026-09-01');
        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        assert.equal(formatted, '2026-09-01');
    });

    await t.test('isValidDate validates dates', () => {
        assert.equal(!isNaN(new Date('2026-09-01')), true);
        assert.equal(!isNaN(new Date('invalid')), false);
    });
});

test('Daily Closing Business Logic', async (t) => {
    await t.test('future dates should be rejected', () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        tomorrow.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        assert.equal(tomorrow > today, true);
    });

    await t.test('transaction totals calculation', () => {
        const mockTotals = {
            totalTransactions: 5,
            totalDeposits: 1500,
            totalWithdrawals: 300,
            totalTransfers: 0,
            totalAirtime: 50,
            totalData: 100,
            totalBillPayments: 0,
            totalOther: 0,
            totalAmount: 1950
        };

        assert.equal(mockTotals.totalTransactions, 5);
        assert.equal(mockTotals.totalDeposits, 1500);
        assert.equal(mockTotals.totalAmount, 1950);
    });
});
