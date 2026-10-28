const bcrypt = require('bcryptjs');
const db = require('../config/database');
const userModel = require('../models/userModel');
const vendorModel = require('../models/vendorModel');
const vendorBalancesModel = require('../models/vendorBalancesModel');
const notificationService = require('../services/notificationService');

const isValidPhone = (phone) => /^0\d{9}$/.test(String(phone).trim());

const isStrongPassword = (password) =>
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

module.exports = {
    isValidPhone,
    isStrongPassword
};

const createVendor = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { name, phone, password } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (name.trim().length < 2 || name.trim().length > 100) {
            return res.status(400).json({ success: false, message: 'Name must be between 2 and 100 characters' });
        }

        if (!phone || String(phone).trim() === '') {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }
        if (!isValidPhone(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Phone number must be 10 digits and start with 0 (e.g. 0240000000)'
            });
        }

        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }
        if (!isStrongPassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character'
            });
        }

        await conn.beginTransaction();

        const normalizedPhone = String(phone).trim();
        const phoneInUse = await vendorModel.phoneExistsWithTransaction(conn, normalizedPhone);
        if (phoneInUse) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: 'A user with this phone number already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userResult = await vendorModel.createUserWithTransaction(
            conn,
            name.trim(),
            normalizedPhone,
            hashedPassword
        );
        const userId = userResult.insertId;

        await vendorModel.createVendorWithTransaction(conn, userId);
        await vendorBalancesModel.create(conn, userId);
        await notificationService.notifyOwner(
            conn,
            'VENDOR_CREATED',
            'New Vendor Added',
            `${name.trim()} has been added as a vendor.`,
            'VENDOR',
            userId
        );
        await conn.commit();

        const freshUser = await userModel.getUserById(userId);

        return res.status(201).json({
            success: true,
            message: 'Vendor account created successfully',
            data: {
                id: freshUser.id,
                name: freshUser.name,
                phone: freshUser.phone,
                role: freshUser.role,
                status: freshUser.status,
                created_at: freshUser.created_at,
                updated_at: freshUser.updated_at
            }
        });
    } catch (error) {
        await conn.rollback();
        console.error('Create vendor error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        conn.release();
    }
};

const getAllVendors = async (req, res) => {
    try {
        const { status, search } = req.query;

        if (status && !['ACTIVE', 'INACTIVE'].includes(String(status).trim().toUpperCase())) {
            return res.status(400).json({ success: false, message: 'status filter must be ACTIVE or INACTIVE' });
        }

        if (search !== undefined && String(search).trim() === '') {
            return res.status(400).json({ success: false, message: 'search filter cannot be empty' });
        }

        const filters = {
            status: status ? String(status).trim().toUpperCase() : undefined,
            search: search ? String(search).trim() : undefined
        };

        const vendors = await vendorModel.getAllVendors(filters);

        return res.status(200).json({
            success: true,
            message: 'Vendors retrieved successfully',
            data: vendors.map((vendor) => ({
                id: vendor.user_id,
                name: vendor.name,
                phone: vendor.phone,
                role: vendor.role,
                status: vendor.status,
                created_at: vendor.created_at,
                updated_at: vendor.updated_at
            }))
        });
    } catch (error) {
        console.error('Get all vendors error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getVendorMe = async (req, res) => {
    try {
        if (req.user.role !== 'VENDOR') {
            return res.status(403).json({ success: false, message: 'Vendor access required' });
        }

        const user = await userModel.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                role: user.role,
                status: user.status,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        });
    } catch (error) {
        console.error('Get vendor me error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getVendorById = async (req, res) => {
    try {
        const { id } = req.params;
        const parsed = parseInt(id, 10);
        if (isNaN(parsed) || parsed <= 0) {
            return res.status(400).json({ success: false, message: 'Vendor ID must be a valid positive integer' });
        }

        const vendor = await vendorModel.getVendorById(parsed);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Vendor retrieved successfully',
            data: {
                id: vendor.user_id,
                name: vendor.name,
                phone: vendor.phone,
                role: vendor.role,
                status: vendor.status,
                created_at: vendor.created_at,
                updated_at: vendor.updated_at
            }
        });
    } catch (error) {
        console.error('Get vendor error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = parseInt(id, 10);
        if (isNaN(vendorId) || vendorId <= 0) {
            return res.status(400).json({ success: false, message: 'Vendor ID must be a valid positive integer' });
        }

        const forbidden = ['role', 'password', 'status', 'id'];
        for (const field of forbidden) {
            if (req.body[field] !== undefined) {
                return res.status(400).json({ success: false, message: `Field "${field}" cannot be changed through this endpoint` });
            }
        }

        const { name, phone } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (name.trim().length < 2 || name.trim().length > 100) {
            return res.status(400).json({ success: false, message: 'Name must be between 2 and 100 characters' });
        }

        if (!phone || String(phone).trim() === '') {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }
        if (!isValidPhone(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Phone number must be 10 digits and start with 0 (e.g. 0240000000)'
            });
        }

        const vendor = await vendorModel.getVendorById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        const normalizedPhone = String(phone).trim();
        if (normalizedPhone !== vendor.phone) {
            const existingUser = await userModel.getUserByPhone(normalizedPhone);
            if (existingUser && existingUser.id !== vendor.user_id) {
                return res.status(409).json({ success: false, message: 'A user with this phone number already exists' });
            }
        }

        await vendorModel.updateVendorProfile(vendor.user_id, vendorId, {
            name: name.trim(),
            phone: normalizedPhone
        });

        const updated = await vendorModel.getVendorById(vendorId);
        return res.status(200).json({
            success: true,
            message: 'Vendor updated successfully',
            data: {
                id: updated.user_id,
                name: updated.name,
                phone: updated.phone,
                role: updated.role,
                status: updated.status,
                created_at: updated.created_at,
                updated_at: updated.updated_at
            }
        });
    } catch (error) {
        console.error('Update vendor error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateVendorStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const vendorId = parseInt(id, 10);
        if (isNaN(vendorId) || vendorId <= 0) {
            return res.status(400).json({ success: false, message: 'Vendor ID must be a valid positive integer' });
        }

        if (!status || typeof status !== 'string') {
            return res.status(400).json({ success: false, message: 'status is required' });
        }

        const normalizedStatus = status.trim().toUpperCase();
        if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
            return res.status(400).json({ success: false, message: 'status must be ACTIVE or INACTIVE' });
        }

        const vendor = await vendorModel.getVendorById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        if (vendor.status === normalizedStatus) {
            return res.status(200).json({
                success: true,
                message: `Vendor is already ${normalizedStatus}`,
                data: {
                    id: vendor.user_id,
                    name: vendor.name,
                    status: vendor.status
                }
            });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await vendorModel.updateUserStatus(vendor.user_id, normalizedStatus, conn);

            const actionType = normalizedStatus === 'ACTIVE' ? 'VENDOR_ACTIVATED' : 'VENDOR_DEACTIVATED';
            const actionTitle = normalizedStatus === 'ACTIVE' ? 'Vendor Activated' : 'Vendor Deactivated';
            const actionMsg = `${vendor.name}'s account has been ${normalizedStatus.toLowerCase()}.`;
            await notificationService.notifyOwner(conn, actionType, actionTitle, actionMsg, 'VENDOR', vendor.user_id);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }

        const updated = await vendorModel.getVendorById(vendorId);

        return res.status(200).json({
            success: true,
            message: `Vendor ${normalizedStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
            data: {
                id: updated.user_id,
                name: updated.name,
                phone: updated.phone,
                role: updated.role,
                status: updated.status,
                created_at: updated.created_at,
                updated_at: updated.updated_at
            }
        });
    } catch (error) {
        console.error('Update vendor status error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = parseInt(id, 10);
        if (isNaN(vendorId) || vendorId <= 0) {
            return res.status(400).json({ success: false, message: 'Vendor ID must be a valid positive integer' });
        }

        const vendor = await vendorModel.getVendorById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        if (vendor.status === 'INACTIVE') {
            return res.status(200).json({
                success: true,
                message: 'Vendor is already deactivated',
                data: {
                    id: vendor.user_id,
                    name: vendor.name,
                    status: vendor.status
                }
            });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await vendorModel.updateUserStatus(vendor.user_id, 'INACTIVE', conn);
            await notificationService.notifyOwner(
                conn,
                'VENDOR_DEACTIVATED',
                'Vendor Deactivated',
                `${vendor.name}'s account has been deactivated.`,
                'VENDOR',
                vendor.user_id
            );
            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }

        const updated = await vendorModel.getVendorById(vendorId);

        return res.status(200).json({
            success: true,
            message: 'Vendor account deactivated successfully',
            data: {
                id: updated.user_id,
                name: updated.name,
                phone: updated.phone,
                role: updated.role,
                status: updated.status,
                created_at: updated.created_at,
                updated_at: updated.updated_at
            }
        });
    } catch (error) {
        console.error('Delete vendor error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteAllVendors = async (req, res) => {
    if (req.body?.confirmation !== 'DELETE_ALL_VENDORS') {
        return res.status(400).json({
            success: false,
            message: 'Type DELETE_ALL_VENDORS to permanently remove all vendors'
        });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const deletedCount = await vendorModel.deleteAllVendors(conn);
        await conn.commit();

        return res.status(200).json({
            success: true,
            message: `${deletedCount} vendor account${deletedCount === 1 ? '' : 's'} permanently removed`,
            data: { deleted_count: deletedCount }
        });
    } catch (error) {
        await conn.rollback();
        console.error('Delete all vendors error:', error);
        return res.status(500).json({ success: false, message: 'Unable to remove all vendors' });
    } finally {
        conn.release();
    }
};

module.exports = {
    isValidPhone,
    isStrongPassword,
    createVendor,
    getAllVendors,
    getVendorMe,
    getVendorById,
    updateVendor,
    updateVendorStatus,
    deleteVendor,
    deleteAllVendors
};
