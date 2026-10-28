const reportModel = require('../models/reportModel');

const getDailyReport = async (req, res) => {
    try {
        const { date, vendor_id } = req.query;
        
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())) {
            return res.status(400).json({ success: false, message: 'Valid date is required in YYYY-MM-DD format' });
        }
        
        let vendorIdNum = null;
        if (vendor_id) {
            vendorIdNum = Number(vendor_id);
            if (isNaN(vendorIdNum) || vendorIdNum <= 0) {
                return res.status(400).json({ success: false, message: 'Vendor ID must be a valid positive integer' });
            }
        }
        
        const result = await reportModel.getDailyReport(date, vendorIdNum);
        
        const data = {
            date: date,
            total_transactions: Number(result.total_transactions || 0),
            total_amount: Number(result.total_amount || 0).toFixed(2),
            total_deposits: Number(result.total_deposits || 0).toFixed(2),
            total_withdrawals: Number(result.total_withdrawals || 0).toFixed(2),
            total_transfers: Number(result.total_transfers || 0).toFixed(2),
            total_airtime: Number(result.total_airtime || 0).toFixed(2),
            total_data: Number(result.total_data || 0).toFixed(2),
            total_bill_payments: Number(result.total_bill_payments || 0).toFixed(2),
            total_other: Number(result.total_other || 0).toFixed(2)
        };
        
        if (vendorIdNum) {
            data.vendor_id = vendorIdNum;
            data.vendor_name = result.vendor_name || 'Unknown';
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get daily report error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getWeeklyReport = async (req, res) => {
    try {
        let { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(today.setDate(diff));
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            
            start_date = monday.toISOString().split('T')[0];
            end_date = sunday.toISOString().split('T')[0];
        }
        
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start_date).trim())) {
            return res.status(400).json({ success: false, message: 'Valid start_date is required in YYYY-MM-DD format' });
        }
        
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(end_date).trim())) {
            return res.status(400).json({ success: false, message: 'Valid end_date is required in YYYY-MM-DD format' });
        }
        
        if (String(start_date).trim() > String(end_date).trim()) {
            return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
        }
        const result = await reportModel.getWeeklyReport(start_date, end_date);
        
        const data = {
            start_date: start_date,
            end_date: end_date,
            total_transactions: Number(result.total_transactions || 0),
            total_amount: Number(result.total_amount || 0).toFixed(2),
            total_deposits: Number(result.total_deposits || 0).toFixed(2),
            total_withdrawals: Number(result.total_withdrawals || 0).toFixed(2),
            total_transfers: Number(result.total_transfers || 0).toFixed(2),
            total_airtime: Number(result.total_airtime || 0).toFixed(2),
            total_data: Number(result.total_data || 0).toFixed(2),
            total_bill_payments: Number(result.total_bill_payments || 0).toFixed(2),
            total_other: Number(result.total_other || 0).toFixed(2)
        };

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get weekly report error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getMonthlyReport = async (req, res) => {
    try {
        const { year, month } = req.query;
        
        const yearNum = Number(year);
        const monthNum = Number(month);
        
        if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            return res.status(400).json({ success: false, message: 'Valid year is required (e.g., 2026)' });
        }
        
        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ success: false, message: 'Valid month is required (1-12)' });
        }
        
        const result = await reportModel.getMonthlyReport(yearNum, monthNum);
        
        const data = {
            year: yearNum,
            month: monthNum,
            total_transactions: Number(result.total_transactions || 0),
            total_amount: Number(result.total_amount || 0).toFixed(2),
            total_deposits: Number(result.total_deposits || 0).toFixed(2),
            total_withdrawals: Number(result.total_withdrawals || 0).toFixed(2),
            total_transfers: Number(result.total_transfers || 0).toFixed(2),
            total_airtime: Number(result.total_airtime || 0).toFixed(2),
            total_data: Number(result.total_data || 0).toFixed(2),
            total_bill_payments: Number(result.total_bill_payments || 0).toFixed(2),
            total_other: Number(result.total_other || 0).toFixed(2)
        };

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get monthly report error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getTransactionTypesSummary = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(start_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid start_date format. Use YYYY-MM-DD' });
        }
        
        if (end_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(end_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid end_date format. Use YYYY-MM-DD' });
        }
        
        if (start_date && end_date && String(start_date).trim() > String(end_date).trim()) {
            return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
        }
        
        const rows = await reportModel.getTransactionTypesSummary(start_date, end_date);
        
        const data = rows.map(r => ({
            type: r.type,
            transaction_count: Number(r.transaction_count || 0),
            total_amount: Number(r.total_amount || 0).toFixed(2)
        }));

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get transaction types summary error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getVendorPerformance = async (req, res) => {
    try {
        const { start_date, end_date, sort_by, sort_order } = req.query;
        
        if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(start_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid start_date format. Use YYYY-MM-DD' });
        }
        
        if (end_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(end_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid end_date format. Use YYYY-MM-DD' });
        }
        
        if (start_date && end_date && String(start_date).trim() > String(end_date).trim()) {
            return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
        }
        
        let validSortBy = 'total_amount';
        if (sort_by && ['transaction_count', 'total_amount'].includes(String(sort_by).toLowerCase())) {
            validSortBy = String(sort_by).toLowerCase();
        }
        
        let validSortOrder = 'desc';
        if (sort_order && ['asc', 'desc'].includes(String(sort_order).toLowerCase())) {
            validSortOrder = String(sort_order).toLowerCase();
        }
        
        const rows = await reportModel.getVendorPerformance(start_date, end_date, validSortBy, validSortOrder);
        
        const data = rows.map(r => ({
            vendor_id: r.vendor_id,
            vendor_name: r.vendor_name,
            transaction_count: Number(r.transaction_count || 0),
            total_amount: Number(r.total_amount || 0).toFixed(2),
            total_deposits: Number(r.total_deposits || 0).toFixed(2),
            total_withdrawals: Number(r.total_withdrawals || 0).toFixed(2)
        }));

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get vendor performance error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const getDailyTrendReport = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(start_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid start_date format. Use YYYY-MM-DD' });
        }
        
        if (end_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(end_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid end_date format. Use YYYY-MM-DD' });
        }
        
        if (start_date && end_date && String(start_date).trim() > String(end_date).trim()) {
            return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
        }
        
        const rows = await reportModel.getDailyTrendReport(start_date, end_date);
        
        const data = rows.map(r => ({
            date: r.date,
            transaction_count: Number(r.transaction_count || 0),
            total_amount: Number(r.total_amount || 0).toFixed(2)
        }));

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get daily trend report error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getClosingReport = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(start_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid start_date format. Use YYYY-MM-DD' });
        }
        
        if (end_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(end_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid end_date format. Use YYYY-MM-DD' });
        }
        
        if (start_date && end_date && String(start_date).trim() > String(end_date).trim()) {
            return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
        }
        
        const result = await reportModel.getClosingReport(start_date, end_date);
        
        const summaryData = {
            total_days: Number(result.summary.total_days || 0),
            closed_days: Number(result.summary.closed_days || 0),
            open_days: Number(result.summary.open_days || 0)
        };
        
        const detailsData = result.details.map(r => ({
            date: r.date,
            vendor_id: r.vendor_id,
            vendor_name: r.vendor_name,
            status: r.status,
            total_transactions: Number(r.total_transactions || 0),
            total_amount: Number(r.total_amount || 0).toFixed(2),
            closed_at: r.closed_at
        }));

        return res.status(200).json({ 
            success: true, 
            data: summaryData,
            details: detailsData
        });
    } catch (error) {
        console.error('Get closing report error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getDailyTrendReport,
    getClosingReport,
    getDailyReport,
    getWeeklyReport,
    getMonthlyReport,
    getTransactionTypesSummary,
    getVendorPerformance
};
