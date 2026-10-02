import User from '../models/User.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import Announcement from '../models/Announcement.js';
import Notification from '../models/Notification.js';
import { DEFAULT_CATEGORIES } from './defaults.js';
import { learn } from '../services/categorizer.js';
import { refreshTips } from '../services/tips.js';
import { generateInsight } from '../services/insights.js';
import { addMonths, startOfMonth, nextOccurrence } from '../utils/dates.js';

// ---------------------------------------------------------------------------
// Seed data
//
// Creates the default categories, the administrator, and two demo students with
// six months of plausible history so every chart, report and tip has something
// real to work with the first time the app is opened.
//
// The random numbers come from a fixed seed, so re-running this produces the
// same data - which is what makes the figures in the project report repeatable.
// ---------------------------------------------------------------------------

// A small deterministic generator (mulberry32) - same seed, same history.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];
const between = (random, min, max) => Math.round(min + random() * (max - min));

const DESCRIPTIONS = {
  Food: ['Campus cafe lunch', 'Canteen lunch', 'Lunch with friends', 'Foodpanda dinner', 'Groceries for the room', 'Cheezious with friends', 'Burger after class', 'Coffee before the lab'],
  Transport: ['Rickshaw to campus', 'Careem to the station', 'Bus card top up', 'Petrol for the bike', 'InDrive home', 'Metro fare', 'Bykea to the market'],
  'Hostel/Rent': ['Monthly hostel rent', 'Electricity share', 'PTCL wifi bill', 'Jazz mobile package'],
  Academics: ['Printing lab report', 'Data structures textbook', 'Stationery from Daraz', 'Photocopy of notes', 'Semester lab fee'],
  Subscriptions: ['Spotify Premium', 'Netflix share', 'Gym membership', 'Google One storage', 'ChatGPT Plus share'],
  Entertainment: ['Cinema ticket', 'Cricket match with the hostel', 'Weekend outing', 'PUBG UC top up'],
  Miscellaneous: ['Laundry', 'Haircut', 'Medicine from the pharmacy', 'Birthday gift for a friend'],
  Allowance: ['Monthly allowance from home'],
  'Part-time Job': ['Tutoring payment', 'Freelance design work', 'Weekend shift'],
  Scholarship: ['Merit scholarship instalment'],
  Gift: ['Gift from uncle', 'Birthday money'],
  'Other Income': ['Refund on a cancelled order', 'Sold old textbooks'],
};

/** How many times a month each expense category typically appears, and for how much. */
const SPEND_PROFILE = {
  Food: { times: [14, 22], amount: [180, 900] },
  Transport: { times: [8, 16], amount: [120, 600] },
  'Hostel/Rent': { times: [1, 1], amount: [12000, 12000] },
  Academics: { times: [1, 4], amount: [400, 3500] },
  Subscriptions: { times: [2, 3], amount: [500, 1500] },
  Entertainment: { times: [2, 5], amount: [600, 2500] },
  Miscellaneous: { times: [2, 5], amount: [200, 1800] },
};

/* How each kind of spending tends to be paid for here. The lists are weighted
   by repetition rather than by probabilities, so `pick` alone produces a
   believable mix: a canteen is notes, rent is a bank transfer, a subscription
   needs a card, and a rickshaw is increasingly a wallet. This is what gives
   the dashboard's cash/digital split something honest to show on first run. */
const SPEND_METHODS = {
  Food: ['cash', 'cash', 'cash', 'cash', 'easypaisa', 'jazzcash'],
  Transport: ['cash', 'cash', 'cash', 'easypaisa', 'jazzcash'],
  'Hostel/Rent': ['bank'],
  Academics: ['cash', 'cash', 'easypaisa'],
  Subscriptions: ['card', 'card', 'sadapay'],
  Entertainment: ['cash', 'cash', 'jazzcash', 'card'],
  Miscellaneous: ['cash', 'cash', 'easypaisa', 'nayapay'],
  default: ['cash', 'cash', 'easypaisa'],
};

const INCOME_METHODS = ['bank', 'bank', 'easypaisa', 'jazzcash', 'cash'];

async function seedCategories() {
  const existing = await Category.countDocuments({ owner: null });
  if (existing >= DEFAULT_CATEGORIES.length) {
    // Keywords added in a later version still reach a database seeded before
    // it. $addToSet only ever adds, so keywords an administrator added are kept.
    await Category.bulkWrite(
      DEFAULT_CATEGORIES.map((category) => ({
        updateOne: {
          filter: { owner: null, type: category.type, name: category.name },
          update: { $addToSet: { keywords: { $each: category.keywords } } },
        },
      }))
    );
    return Category.find({ owner: null });
  }

  await Category.bulkWrite(
    DEFAULT_CATEGORIES.map((category) => ({
      updateOne: {
        filter: { owner: null, type: category.type, name: category.name },
        update: { $set: { ...category, owner: null, isDefault: true } },
        upsert: true,
      },
    }))
  );
  return Category.find({ owner: null });
}

async function createUser({ name, email, password, role = 'student', ...rest }) {
  const existing = await User.findOne({ email });
  if (existing) return existing;

  const user = new User({ name, email, role, ...rest });
  await user.setPassword(password);
  await user.save();
  return user;
}

/** Writes six months of history for one demo student. */
async function seedHistory(user, categories, seed) {
  if (await Transaction.countDocuments({ user: user._id })) return;

  const random = rng(seed);
  const byName = new Map(categories.map((c) => [c.name, c]));
  const thisMonth = startOfMonth();
  const docs = [];

  const dayIn = (month, day) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 9, 0, 0));
  const daysIn = (month) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();

  for (let back = 5; back >= 0; back -= 1) {
    const month = addMonths(thisMonth, -back);
    const lastDay = daysIn(month);
    // The current month is only part-way through, so stop at today.
    const cutoff = back === 0 ? new Date().getUTCDate() : lastDay;

    // Income: the allowance always, a job most months, a scholarship twice,
    // and the occasional gift.
    const income = [
      { name: 'Allowance', day: 2, amount: user.monthlyAllowance || 20000 },
      ...(random() > 0.25 ? [{ name: 'Part-time Job', day: between(random, 10, 20), amount: between(random, 3000, 9000) }] : []),
      ...(back % 3 === 0 ? [{ name: 'Scholarship', day: 5, amount: 15000 }] : []),
      ...(random() > 0.7 ? [{ name: 'Gift', day: between(random, 8, 25), amount: between(random, 1000, 5000) }] : []),
    ];

    for (const entry of income) {
      if (entry.day > cutoff) continue;
      const category = byName.get(entry.name);
      docs.push({
        user: user._id,
        category: category._id,
        type: 'income',
        amount: entry.amount,
        description: pick(random, DESCRIPTIONS[entry.name]),
        date: dayIn(month, entry.day),
        month,
        // Money coming in mostly arrives digitally - an allowance transfer, a
        // wallet top-up - with the occasional envelope of notes.
        method: pick(random, INCOME_METHODS),
        source: 'manual',
      });
    }

    for (const [name, profile] of Object.entries(SPEND_PROFILE)) {
      const category = byName.get(name);
      if (!category) continue;

      // Food creeps up over the last two months - this is the pattern the
      // insight writer and the tips engine are meant to notice.
      const drift = name === 'Food' && back <= 1 ? 1.4 : 1;
      const times = between(random, profile.times[0], profile.times[1]);

      for (let i = 0; i < times; i += 1) {
        const day = name === 'Hostel/Rent' ? 3 : between(random, 1, lastDay);
        if (day > cutoff) continue;
        docs.push({
          user: user._id,
          category: category._id,
          type: 'expense',
          amount: Math.round(between(random, profile.amount[0], profile.amount[1]) * drift),
          description: pick(random, DESCRIPTIONS[name]),
          date: dayIn(month, day),
          month,
          method: pick(random, SPEND_METHODS[name] || SPEND_METHODS.default),
          source: 'manual',
        });
      }
    }
  }

  const created = await Transaction.insertMany(docs);

  // Mark the subscription entries as recurring, so the recurring feature has
  // something live to demonstrate.
  const subscriptions = byName.get('Subscriptions');
  const latestSub = created
    .filter((t) => String(t.category) === String(subscriptions._id))
    .sort((a, b) => b.date - a.date)[0];
  if (latestSub) {
    latestSub.recurring = { enabled: true, frequency: 'monthly', nextRun: nextOccurrence(latestSub.date, 'monthly') };
    await latestSub.save();
  }

  // Teach the categorisation assistant from this student's own history, so the
  // demo account behaves like one that has been used for a while.
  for (const doc of docs) {
    await learn({ userId: user._id, description: doc.description, categoryId: doc.category });
  }

  // Budgets for the current month.
  const caps = { Food: 9000, Transport: 3500, Entertainment: 4000, Subscriptions: 2500 };
  await Budget.bulkWrite(
    Object.entries(caps)
      .filter(([name]) => byName.has(name))
      .map(([name, limitAmount]) => ({
        updateOne: {
          filter: { user: user._id, category: byName.get(name)._id, month: thisMonth },
          update: { $set: { limitAmount }, $setOnInsert: { user: user._id, category: byName.get(name)._id, month: thisMonth } },
          upsert: true,
        },
      }))
  );

  // Build the first tips and the last two months of insights.
  await refreshTips(user, thisMonth);
  await generateInsight(user, thisMonth, { useLlm: false });
  await generateInsight(user, addMonths(thisMonth, -1), { useLlm: false });
}

/** Runs on first boot. Safe to call repeatedly - it only fills what is missing. */
export async function seedIfEmpty() {
  // Announcements the automated test posted before notifications were linked
  // to their announcement were never taken back out of the bells; clear them.
  await Notification.deleteMany({ kind: 'announcement', title: /^E2E /, announcement: { $exists: false } });
  const categories = await seedCategories();

  const admin = await createUser({
    name: 'Campus Coin Admin',
    email: 'admin@campuscoin.app',
    password: 'Admin@12345',
    role: 'admin',
    currency: 'PKR',
  });

  const demo = await createUser({
    name: 'Ayesha Khan',
    email: 'student@campuscoin.app',
    password: 'Student@12345',
    academicYear: 'Year 2',
    institution: 'City University',
    monthlyAllowance: 20000,
    savingsGoal: 5000,
    currency: 'PKR',
    avatarColor: '#121214',
  });

  const second = await createUser({
    name: 'Bilal Ahmed',
    email: 'bilal@campuscoin.app',
    password: 'Student@12345',
    academicYear: 'Year 3',
    institution: 'City University',
    monthlyAllowance: 16000,
    savingsGoal: 3000,
    currency: 'PKR',
    avatarColor: '#60a5fa',
  });

  await seedHistory(demo, categories, 20260101);
  await seedHistory(second, categories, 77771234);

  if (!(await Announcement.countDocuments())) {
    await Announcement.create([
      {
        title: 'Welcome to Campus Coin',
        body: 'Log a few days of spending and your dashboard will start showing patterns you can actually act on.',
        kind: 'announcement',
        createdBy: admin._id,
      },
      {
        title: 'Set one budget, not five',
        body: 'Students who cap a single category stick with it far more often than those who budget everything at once. Start with whatever you spend most on.',
        kind: 'tip-template',
        createdBy: admin._id,
      },
    ]);
  }

  return { admin, demo, second };
}
