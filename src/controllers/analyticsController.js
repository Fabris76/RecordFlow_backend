const analyticsModel = require('../models/analyticsModel');
const notificationService = require('../services/notificationService');

const isValidDateString = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return false;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const localDate = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const parseDateRange = (query, { required = false } = {}) => {
    const start = query.start_date;
    const end = query.end_date;
    if (required && (!start || !end)) return { error: 'start_date and end_date are required' };
    if (start && !isValidDateString(start)) return { error: 'Invalid start_date format. Use YYYY-MM-DD' };
    if (end && !isValidDateString(end)) return { error: 'Invalid end_date format. Use YYYY-MM-DD' };
    if (start && end && String(start) > String(end)) return { error: 'Start date cannot be after end date' };
    return { start, end };
};

const defaultRange = (range) => ({ start: range.start || '1000-01-01', end: range.end || '9999-12-31' });
const money = (value) => Number(value || 0).toFixed(2);
const mapSummary = (row) => ({
    transaction_count: Number(row.transaction_count || 0),
    transaction_amount: money(row.transaction_amount),
    deposits: money(row.deposits),
    withdrawals: money(row.withdrawals),
    transfers: money(row.transfers),
    airtime: money(row.airtime),
    data: money(row.data),
    bill_payments: money(row.bill_payments),
    other: money(row.other_amount)
});

const getDashboard = async (req, res) => {
    try {
        const date = localDate();
        const [summary, vendors, closing, topVendors] = await Promise.all([
            analyticsModel.getTransactionSummary(date, date),
            analyticsModel.getVendorCounts(),
            analyticsModel.getClosingCounts(date),
            analyticsModel.getTopVendors(date, date)
        ]);
        return res.json({ success: true, data: {
            today: mapSummary(summary),
            vendors: { total: Number(vendors.total || 0), active: Number(vendors.active || 0), inactive: Number(vendors.inactive || 0) },
            closing: { completed: Number(closing.completed || 0), pending: Number(closing.pending || 0) },
            most_active_vendor: topVendors.mostActive ? {
                vendor_id: topVendors.mostActive.vendor_id,
                vendor_name: topVendors.mostActive.vendor_name,
                transaction_count: Number(topVendors.mostActive.transaction_count || 0)
            } : null,
            highest_transaction_value_vendor: topVendors.highestValue ? {
                vendor_id: topVendors.highestValue.vendor_id,
                vendor_name: topVendors.highestValue.vendor_name,
                transaction_amount: money(topVendors.highestValue.transaction_amount)
            } : null
        } });
    } catch (error) { console.error('Dashboard analytics error:', error); return res.status(500).json({ success: false, message: 'Internal server error' }); }
};

const getVendorPerformance = async (req, res) => {
    try {
        const range = parseDateRange(req.query);
        if (range.error) return res.status(400).json({ success: false, message: range.error });
        const dates = defaultRange(range);
        const sortBy = String(req.query.sort_by || 'transaction_amount').toLowerCase();
        const sortOrder = String(req.query.sort_order || 'desc').toLowerCase();
        if (!['transaction_count', 'transaction_amount'].includes(sortBy)) return res.status(400).json({ success: false, message: 'Invalid sort_by' });
        if (!['asc', 'desc'].includes(sortOrder)) return res.status(400).json({ success: false, message: 'sort_order must be asc or desc' });
        const rows = await analyticsModel.getVendorPerformance(dates.start, dates.end, sortBy, sortOrder);
        return res.json({ success: true, data: rows.map((row) => ({ vendor_id: row.vendor_id, vendor_name: row.vendor_name, transaction_count: Number(row.transaction_count), transaction_amount: money(row.transaction_amount) })) });
    } catch (error) { console.error('Vendor performance analytics error:', error); return res.status(500).json({ success: false, message: 'Internal server error' }); }
};

const getTransactionTypes = async (req, res) => {
    try {
        const range = parseDateRange(req.query);
        if (range.error) return res.status(400).json({ success: false, message: range.error });
        const dates = defaultRange(range);
        const rows = await analyticsModel.getTransactionTypes(dates.start, dates.end);
        return res.json({ success: true, data: rows.map((row) => ({ type: row.type, count: Number(row.transaction_count), amount: money(row.transaction_amount) })) });
    } catch (error) { console.error('Transaction types analytics error:', error); return res.status(500).json({ success: false, message: 'Internal server error' }); }
};

const getTransactionTrend = async (req, res) => {
    try {
        const range = parseDateRange(req.query, { required: true });
        if (range.error) return res.status(400).json({ success: false, message: range.error });
        const rows = await analyticsModel.getTransactionTrend(range.start, range.end);
        return res.json({ success: true, data: rows.map((row) => ({ date: row.date, transaction_count: Number(row.transaction_count), transaction_amount: money(row.transaction_amount) })) });
    } catch (error) { console.error('Transaction trend analytics error:', error); return res.status(500).json({ success: false, message: 'Internal server error' }); }
};

const getComparison = async (req, res) => {
    try {
        const current = parseDateRange({ start_date: req.query.current_start_date, end_date: req.query.current_end_date }, { required: true });
        const previous = parseDateRange({ start_date: req.query.previous_start_date, end_date: req.query.previous_end_date }, { required: true });
        if (current.error || previous.error) return res.status(400).json({ success: false, message: current.error || previous.error });
        const [currentSummary, previousSummary] = await Promise.all([
            analyticsModel.getComparisonSummary(current.start, current.end),
            analyticsModel.getComparisonSummary(previous.start, previous.end)
        ]);
        const currentCount = Number(currentSummary.transaction_count || 0);
        const previousCount = Number(previousSummary.transaction_count || 0);
        const currentAmount = Number(currentSummary.transaction_amount || 0);
        const previousAmount = Number(previousSummary.transaction_amount || 0);
        const percent = (now, before) => before === 0 ? null : ((now - before) / before * 100).toFixed(2);
        return res.json({ success: true, data: {
            current_period: { transaction_count: currentCount, transaction_amount: money(currentAmount) },
            previous_period: { transaction_count: previousCount, transaction_amount: money(previousAmount) },
            change: { transaction_count: currentCount - previousCount, transaction_amount: money(currentAmount - previousAmount), transaction_count_percentage: percent(currentCount, previousCount), transaction_amount_percentage: percent(currentAmount, previousAmount) }
        } });
    } catch (error) { console.error('Comparison analytics error:', error); return res.status(500).json({ success: false, message: 'Internal server error' }); }
};

const getActivitySummary = async (req, res) => {
    try {
        const row = await analyticsModel.getActivitySummary(localDate(), notificationService.getLargeTransactionThreshold());
        return res.json({ success: true, data: { transactions: Number(row.transactions || 0), amount: money(row.amount), active_vendors: Number(row.active_vendors || 0), inactive_vendors: Number(row.inactive_vendors || 0), completed_closings: Number(row.completed_closings || 0), pending_closings: Number(row.pending_closings || 0), large_transactions: Number(row.large_transactions || 0), transaction_edits: Number(row.transaction_edits || 0), balance_adjustments: Number(row.balance_adjustments || 0) } });
    } catch (error) { console.error('Activity analytics error:', error); return res.status(500).json({ success: false, message: 'Internal server error' }); }
};

const getLargeTransactions = async (req, res) => {
    try {
        const range = parseDateRange(req.query);
        if (range.error) return res.status(400).json({ success: false, message: range.error });
        const dates = defaultRange(range);
        const rows = await analyticsModel.getLargeTransactions(dates.start, dates.end, notificationService.getLargeTransactionThreshold());
        return res.json({ success: true, data: rows.map((row) => ({ transaction_id: row.transaction_id, vendor_id: row.vendor_id, vendor_name: row.vendor_name, type: row.type, amount: money(row.amount), date: row.date })) });
    } catch (error) { console.error('Large transactions analytics error:', error); return res.status(500).json({ success: false, message: 'Internal server error' }); }
};

const getTransactionEdits = async (req, res) => {
    try {
        const row = await analyticsModel.getTransactionEditSummary();
        return res.json({ success: true, data: { total_edits: Number(row.total_edits || 0), vendors_with_edits: Number(row.vendors_with_edits || 0) } });
    } catch (error) { console.error('Transaction edits analytics error:', error); return res.status(500).json({ success: false, message: 'Internal server error' }); }
};

const getVendorDashboard = async (req, res) => {
    try {
        const result = await analyticsModel.getVendorDashboardSummary(req.user.id, localDate());
        return res.json({ success: true, data: {
            today: {
                transaction_count: Number(result.transactions.transaction_count || 0),
                transaction_amount: money(result.transactions.transaction_amount),
                deposits: money(result.transactions.deposits),
                withdrawals: money(result.transactions.withdrawals)
            },
            balance: result.balance ? { cash_balance: money(result.balance.cash_balance), momo_balance: money(result.balance.momo_balance) } : null,
            closing: result.closing ? { status: result.closing.status, closed_at: result.closing.closed_at } : { status: 'OPEN', closed_at: null }
        } });
    } catch (error) {
        console.error('Vendor dashboard analytics error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = { isValidDateString, parseDateRange, localDate, defaultRange, getDashboard, getVendorDashboard, getVendorPerformance, getTransactionTypes, getTransactionTrend, getComparison, getActivitySummary, getLargeTransactions, getTransactionEdits };