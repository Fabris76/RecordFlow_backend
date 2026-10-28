const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const register = async (req, res) => {
    try {
        const { name, phone, password, role } = req.body;

        if (!name || String(name).trim() === '') {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        if (!phone || String(phone).trim() === '') {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        if (!password || typeof password !== 'string' || password.length <= 6) {
            return res.status(400).json({ success: false, message: 'Password is required and must be more than 6 characters' });
        }

        if (!role || typeof role !== 'string' || role.toUpperCase() !== 'VENDOR') {
            return res.status(403).json({ success: false, message: 'Public registration is limited to vendor accounts' });
        }

        const existingUser = await userModel.getUserByPhone(phone);
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Phone number already registered' });
        }

        const userRole = role.toUpperCase();
        const hashedPassword = await bcrypt.hash(password, 10);
        const created = await userModel.createUser(name, phone, hashedPassword, userRole);

        const user = await userModel.getUserById(created.insertId);

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
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
        console.error('Registration error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || String(phone).trim() === '') {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        if (!password || typeof password !== 'string') {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        const user = await userModel.getUserByPhone(phone);
        const isMatch = user && user.status === 'ACTIVE' && await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role, status: user.status },
            process.env.JWT_SECRET,
            { expiresIn: '1d', algorithm: 'HS256' }
        );

        return res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    role: user.role,
                    status: user.status
                }
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await userModel.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact the business owner.'
            });
        }

        return res.json({
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
        console.error('Get me error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    register,
    login,
    getMe
};
