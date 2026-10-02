import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import Announcement from '../models/Announcement.js';
import Notification from '../models/Notification.js';
import Budget from '../models/Budget.js';
import Insight from '../models/Insight.js';
import Tip from '../models/Tip.js';
import CategoryHint from '../models/CategoryHint.js';
import Udhaar from '../models/Udhaar.js';
import Committee from '../models/Committee.js';
import { protect, allow, wrap } from '../middleware/auth.js';
import { startOfMonth, addMonths } from '../utils/dates.js';
import { round2 } from '../utils/money.js';
import { temporaryPassword, isDemo } from '../utils/passwords.js';

const router = express.Router();
router.use(protect, allow('admin'));

/** System-wide usage statistics for the admin control panel. */
router.get(
  '/stats',
  wrap(async (req, res) => {
    const thisMonth = startOfMonth();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [totalUsers, activeUsers, totalTransactions, monthTransactions, volume, topCategories, signups] =
      await Promise.all([
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'student', lastLoginAt: { $gte: thirtyDaysAgo } }),
        Transaction.countDocuments(),
        Transaction.countDocuments({ month: thisMonth }),
        Transaction.aggregate([{ $group: { _id: '$type', total: { $sum: '$amount' } } }]),
        Transaction.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 }, total: { $sum: '$amount' } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
          { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
          { $unwind: '$category' },
          {
            $project: {
              _id: 0,
              name: '$category.name',
              type: '$category.type',
              slot: '$category.slot',
              count: 1,
              total: { $round: ['$total', 2] },
            },
          },
        ]),
        // New students per month over the last six months.
        User.aggregate([
          { $match: { role: 'student', createdAt: { $gte: addMonths(thisMonth, -5) } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
      ]);

    res.json({
      users: { total: totalUsers, activeLast30Days: activeUsers },
      transactions: { total: totalTransactions, thisMonth: monthTransactions },
      volume: {
        income: round2(volume.find((v) => v._id === 'income')?.total || 0),
        expense: round2(volume.find((v) => v._id === 'expense')?.total || 0),
      },
      topCategories,
      signups: signups.map((row) => ({ month: row._id, count: row.count })),
    });
  })
);

// --- Students ---------------------------------------------------------------

router.get(
  '/users',
  wrap(async (req, res) => {
    const filter = { role: 'student' };
    if (req.query.q) {
      const term = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: term }, { email: term }];
    }

    const users = await User.find(filter).sort({ createdAt: -1 }).limit(100);
    const counts = await Transaction.aggregate([
      { $match: { user: { $in: users.map((u) => u._id) } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
    const byUser = new Map(counts.map((row) => [String(row._id), row.count]));

    res.json({
      users: users.map((user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        avatarColor: user.avatarColor,
        academicYear: user.academicYear,
        institution: user.institution,
        currency: user.currency,
        disabled: user.disabled,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        transactionCount: byUser.get(String(user._id)) || 0,
      })),
    });
  })
);

/**
 * The full picture of one student - everything their own account can see,
 * read-only, so an administrator can actually help with a support question
 * ("my balance looks wrong", "I can't find a transaction") without asking
 * the student to screenshot their own app.
 */
router.get(
  '/users/:id',
  wrap(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!user) return res.status(404).json({ message: 'That student was not found' });
    const id = user._id;

    const [recentTransactions, totals, budgets, udhaar, committees, categoryCount] = await Promise.all([
      Transaction.find({ user: id }).sort({ date: -1 }).limit(25).populate('category', 'name icon slot type'),
      Transaction.aggregate([{ $match: { user: id } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Budget.find({ user: id }).populate('category', 'name icon'),
      Udhaar.find({ user: id, settled: false }),
      Committee.find({ user: id, archived: false }),
      Category.countDocuments({ owner: id }),
    ]);

    const income = totals.find((t) => t._id === 'income');
    const expense = totals.find((t) => t._id === 'expense');

    res.json({
      user: {
        ...user.toObject(),
        passwordHash: undefined,
        resetTokenHash: undefined,
        webhookKeyHash: undefined,
        twoFactorCodeHash: undefined,
      },
      totals: {
        income: round2(income?.total || 0),
        expense: round2(expense?.total || 0),
        transactionCount: (income?.count || 0) + (expense?.count || 0),
      },
      recentTransactions,
      budgets,
      udhaarOpen: udhaar.length,
      udhaarOwedToThem: round2(udhaar.filter((u) => u.direction === 'owed_to_me').reduce((s, u) => s + u.amount, 0)),
      udhaarTheyOwe: round2(udhaar.filter((u) => u.direction === 'i_owe').reduce((s, u) => s + u.amount, 0)),
      committees: committees.length,
      ownCategoryCount: categoryCount,
    });
  })
);

/** Disable or re-enable a student account. */
router.patch(
  '/users/:id',
  wrap(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!user) return res.status(404).json({ message: 'That student was not found' });

    if (req.body.disabled !== undefined) user.disabled = Boolean(req.body.disabled);
    await user.save();

    res.json({ message: user.disabled ? `${user.name} can no longer sign in` : `${user.name} can sign in again` });
  })
);

/** Issues a temporary password and hands it back once, for the admin to pass on. */
router.post(
  '/users/:id/reset-password',
  wrap(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: 'student' }).select('+passwordHash');
    if (!user) return res.status(404).json({ message: 'That student was not found' });
    if (isDemo(user)) {
      return res.status(403).json({ message: 'The demo student keeps its published password, so it cannot be reset.' });
    }

    // Random from the crypto module, not Math.random, since it guards an account.
    const temporary = temporaryPassword();
    await user.setPassword(temporary);
    // Signs the student out everywhere (setPassword raised the session version),
    // lifts any lock, and asks them to choose their own password next time.
    user.mustChangePassword = true;
    user.failedLogins = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({
      temporaryPassword: temporary,
      message: `Share this with ${user.name}. It is shown once, is not stored anywhere in readable form, and they will be asked to replace it when they sign in.`,
    });
  })
);

/** Removes a student and everything belonging to them. */
router.delete(
  '/users/:id',
  wrap(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!user) return res.status(404).json({ message: 'That student was not found' });

    const id = new mongoose.Types.ObjectId(String(user._id));
    await Promise.all([
      Transaction.deleteMany({ user: id }),
      Budget.deleteMany({ user: id }),
      Insight.deleteMany({ user: id }),
      Tip.deleteMany({ user: id }),
      Notification.deleteMany({ user: id }),
      CategoryHint.deleteMany({ user: id }),
      Category.deleteMany({ owner: id }),
    ]);
    await user.deleteOne();

    res.json({ message: `${user.name} and all of their data have been removed` });
  })
);

// --- Default categories -----------------------------------------------------

router.get(
  '/categories',
  wrap(async (req, res) => {
    const categories = await Category.find({ owner: null }).sort({ type: 1, name: 1 });
    const usage = await Transaction.aggregate([
      { $match: { category: { $in: categories.map((c) => c._id) } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const counts = new Map(usage.map((row) => [String(row._id), row.count]));

    res.json({
      categories: categories.map((category) => ({
        ...category.toObject(),
        transactionCount: counts.get(String(category._id)) || 0,
      })),
    });
  })
);

router.post(
  '/categories',
  wrap(async (req, res) => {
    const { name, type, icon, slot, keywords } = req.body;
    if (!name || !type) return res.status(400).json({ message: 'A category needs a name and a type' });

    const category = await Category.create({
      name: String(name).trim(),
      type,
      owner: null,
      isDefault: true,
      icon: icon || 'tag',
      slot: Number(slot) || 7,
      keywords: Array.isArray(keywords) ? keywords.map((k) => String(k).toLowerCase()) : [],
    });

    res.status(201).json({ category });
  })
);

router.patch(
  '/categories/:id',
  wrap(async (req, res) => {
    const category = await Category.findOne({ _id: req.params.id, owner: null });
    if (!category) return res.status(404).json({ message: 'That default category was not found' });

    for (const field of ['name', 'icon', 'slot', 'archived']) {
      if (req.body[field] !== undefined) category[field] = req.body[field];
    }
    if (Array.isArray(req.body.keywords)) category.keywords = req.body.keywords.map((k) => String(k).toLowerCase());

    await category.save();
    res.json({ category });
  })
);

/** A default in use is archived, so no student's history is broken by a delete. */
router.delete(
  '/categories/:id',
  wrap(async (req, res) => {
    const category = await Category.findOne({ _id: req.params.id, owner: null });
    if (!category) return res.status(404).json({ message: 'That default category was not found' });

    const used = await Transaction.countDocuments({ category: category._id });
    if (used > 0) {
      category.archived = true;
      await category.save();
      return res.json({
        archived: true,
        message: `${category.name} is used by ${used} transaction${used === 1 ? '' : 's'}, so it has been archived rather than deleted.`,
      });
    }

    await category.deleteOne();
    res.json({ archived: false, message: `${category.name} has been deleted` });
  })
);

// --- Announcements and tip templates ---------------------------------------

router.get(
  '/announcements',
  wrap(async (req, res) => {
    res.json({ announcements: await Announcement.find().sort({ createdAt: -1 }).limit(50) });
  })
);

router.post(
  '/announcements',
  wrap(async (req, res) => {
    const { title, body, kind } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'An announcement needs a title and a message' });

    const announcement = await Announcement.create({
      title,
      body,
      kind: kind === 'tip-template' ? 'tip-template' : 'announcement',
      createdBy: req.user._id,
    });

    // A live announcement is pushed to every student's bell straight away.
    if (announcement.kind === 'announcement' && announcement.active) {
      const students = await User.find({ role: 'student', disabled: false }).select('_id');
      if (students.length) {
        await Notification.insertMany(
          students.map((student) => ({
            user: student._id,
            kind: 'announcement',
            title: announcement.title,
            body: announcement.body,
            announcement: announcement._id,
          }))
        );
      }
    }

    res.status(201).json({ announcement });
  })
);

router.patch(
  '/announcements/:id',
  wrap(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'That announcement was not found' });

    for (const field of ['title', 'body', 'active']) {
      if (req.body[field] !== undefined) announcement[field] = req.body[field];
    }
    await announcement.save();
    res.json({ announcement });
  })
);

router.delete(
  '/announcements/:id',
  wrap(async (req, res) => {
    await Announcement.findByIdAndDelete(req.params.id);
    // Take it out of every student's bell as well.
    await Notification.deleteMany({ announcement: req.params.id });
    res.json({ message: 'Announcement removed' });
  })
);

export default router;
