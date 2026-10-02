// The default categories every student starts with, taken from the SRS
// (section 1.6, "Category Management"). The keywords are what lets the
// categorisation assistant make a sensible guess on a brand new account,
// before it has learned anything about that particular student.

export const DEFAULT_CATEGORIES = [
  // Income
  // 'ghar' and 'kharcha' were tried here and dropped: 'kharcha' literally means
  // "expense" in Urdu, and both appear at least as often in an expense phrase
  // ("ghar ka bill") as an income one, so neither is a safe category signal.
  { name: 'Allowance', type: 'income', icon: 'wallet', slot: 1, keywords: ['allowance', 'pocket', 'money', 'parents', 'home', 'monthly', 'ammi', 'abbu', 'abu', 'ami', 'walid', 'walida', 'papa', 'mama'] },
  { name: 'Part-time Job', type: 'income', icon: 'briefcase', slot: 2, keywords: ['salary', 'wage', 'shift', 'job', 'work', 'freelance', 'gig', 'tutoring', 'tuition', 'kamaya', 'kamaye', 'kamai'] },
  { name: 'Scholarship', type: 'income', icon: 'award', slot: 3, keywords: ['scholarship', 'stipend', 'grant', 'bursary', 'merit', 'aid', 'wazifa', 'wazeefa'] },
  { name: 'Gift', type: 'income', icon: 'gift', slot: 4, keywords: ['gift', 'eidi', 'eid', 'salami', 'birthday', 'present', 'bonus'] },
  { name: 'Other Income', type: 'income', icon: 'plus-circle', slot: 5, keywords: ['refund', 'cashback', 'sold', 'return', 'misc', 'wapas', 'wapis'] },

  // Expenses
  { name: 'Food', type: 'expense', icon: 'utensils', slot: 1, keywords: ['food', 'lunch', 'dinner', 'breakfast', 'canteen', 'cafe', 'cafeteria', 'mess', 'snack', 'tea', 'coffee', 'biryani', 'burger', 'pizza', 'restaurant', 'foodpanda', 'delivery', 'groceries', 'grocery', 'chai', 'paratha', 'samosa', 'roti', 'naan', 'dhaba', 'shawarma', 'sandwich', 'fries', 'juice', 'kebab', 'bakery', 'nashta', 'khana'] },
  { name: 'Transport', type: 'expense', icon: 'bus', slot: 3, keywords: ['bus', 'rickshaw', 'uber', 'careem', 'indrive', 'fuel', 'petrol', 'metro', 'train', 'fare', 'taxi', 'bike', 'ride', 'bykea', 'qingqi', 'chingchi', 'van', 'auto', 'parking', 'toll'] },
  { name: 'Hostel/Rent', type: 'expense', icon: 'home', slot: 2, keywords: ['rent', 'hostel', 'room', 'deposit', 'electricity', 'utility', 'gas', 'water', 'wifi', 'internet', 'bill'] },
  { name: 'Academics', type: 'expense', icon: 'book', slot: 4, keywords: ['book', 'books', 'stationery', 'notebook', 'printing', 'photocopy', 'lab', 'semester', 'fee', 'course', 'exam', 'library', 'pen'] },
  { name: 'Subscriptions', type: 'expense', icon: 'repeat', slot: 6, keywords: ['netflix', 'spotify', 'youtube', 'subscription', 'premium', 'plan', 'package', 'cloud', 'chatgpt', 'canva', 'gym', 'membership'] },
  { name: 'Entertainment', type: 'expense', icon: 'film', slot: 5, keywords: ['movie', 'cinema', 'game', 'gaming', 'concert', 'outing', 'trip', 'hangout', 'party', 'match', 'ticket'] },
  // 'zakat'/'sadqa' and their spellings land here rather than a 13th default
  // category - the SRS deliberately fixes the twelve defaults (see the report's
  // Test data section), so a new category for this is a dedicated page's job,
  // not the seed's; the keywords are what let the categoriser still place it
  // correctly when logged as a normal transaction.
  { name: 'Miscellaneous', type: 'expense', icon: 'tag', slot: 7, keywords: ['misc', 'other', 'random', 'gift', 'charity', 'haircut', 'medicine', 'clothes', 'laundry', 'zakat', 'sadqa', 'sadaqah', 'sadaqa', 'khairat', 'fitrana', 'donation'] },
];
