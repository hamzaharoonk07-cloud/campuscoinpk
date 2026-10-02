import express from 'express';
import Transaction from '../models/Transaction.js';
import CategoryHint from '../models/CategoryHint.js';
import { protect, wrap } from '../middleware/auth.js';
import { suggestCategory, accuracyFor } from '../services/categorizer.js';
import { llmEnabled } from '../services/llm.js';
import { answer, opening } from '../services/chat.js';

const router = express.Router();
router.use(protect);

/**
 * Called as the student types a description. Returns the assistant's best guess
 * with its confidence and the reason behind it, so the suggestion is always
 * something the student can judge rather than a black box.
 */
router.get(
  '/suggest',
  wrap(async (req, res) => {
    const suggestion = await suggestCategory({
      userId: req.user._id,
      description: req.query.q,
      type: req.query.type === 'income' ? 'income' : 'expense',
    });

    if (!suggestion) return res.json({ suggestion: null });

    res.json({
      suggestion: {
        categoryId: suggestion.category._id,
        name: suggestion.category.name,
        slot: suggestion.category.slot,
        icon: suggestion.category.icon,
        confidence: suggestion.confidence,
        reason: suggestion.reason,
        alternatives: suggestion.alternatives,
      },
    });
  })
);

/** How the assistant is doing, and what it has learned - shown on the AI page. */
router.get(
  '/status',
  wrap(async (req, res) => {
    const [accuracy, learned, topTokens] = await Promise.all([
      accuracyFor(Transaction, req.user._id),
      CategoryHint.countDocuments({ user: req.user._id }),
      CategoryHint.find({ user: req.user._id })
        .sort({ count: -1 })
        .limit(12)
        .populate('category', 'name slot'),
    ]);

    res.json({
      categorisation: {
        accuracy,
        wordsLearned: learned,
        examples: topTokens
          .filter((hint) => hint.category)
          .map((hint) => ({ word: hint.token, category: hint.category.name, slot: hint.category.slot, count: hint.count })),
      },
      // The narrative writer is a separate, optional feature from the categoriser.
      narrativeInsights: {
        enabled: llmEnabled(),
        note: llmEnabled()
          ? 'Monthly summaries are rewritten by a language model from figures Campus Coin calculates itself.'
          : 'No API key is set, so monthly summaries are written by the built-in statistical engine.',
      },
    });
  })
);

/** The chat opens with a greeting and the student's most valuable tip. */
router.get(
  '/chat',
  wrap(async (req, res) => {
    res.json(await opening(req.user));
  })
);

/** One question in, one answer out. History stays in the browser - nothing is stored. */
router.post(
  '/chat',
  wrap(async (req, res) => {
    const question = String(req.body.message || '').slice(0, 500);
    res.json(await answer(req.user, question));
  })
);

/** Lets a student wipe what the assistant has learned about them. */
router.delete(
  '/memory',
  wrap(async (req, res) => {
    const result = await CategoryHint.deleteMany({ user: req.user._id });
    res.json({ message: `Cleared ${result.deletedCount} learned words. The assistant will start over from the defaults.` });
  })
);

export default router;
