import { useEffect, useRef } from 'react';
import { money } from '../lib/format.js';

/* ---------------------------------------------------------------------------
   The shareable spending personality card.

   One name for the month, built from two things the student already knows
   about themselves - what they spent most on, and whether they kept more
   or less than usual - drawn to a <canvas> so "Download" produces a real
   PNG a student can actually post, no server round trip and no extra
   dependency for something this small.
--------------------------------------------------------------------------- */

// Top category -> the base of the name.
const CATEGORY_TITLES = {
  Food: 'Foodie',
  Transport: 'Commuter',
  'Hostel/Rent': 'Homebody',
  Academics: 'Scholar',
  Subscriptions: 'Streamer',
  Entertainment: 'Socialite',
  Miscellaneous: 'Wildcard',
};

// Savings rate -> the modifier in front of it.
function modifierFor(savingsRate) {
  if (savingsRate === null) return 'The';
  if (savingsRate >= 20) return 'The Disciplined';
  if (savingsRate < 0) return 'The Free-Spirited';
  return 'The Balanced';
}

export function personalityFor({ totals, categories }) {
  const top = categories?.[0];
  const base = (top && CATEGORY_TITLES[top.name]) || 'Campus Coiner';
  return {
    title: `${modifierFor(totals.savingsRate)} ${base}`,
    topCategory: top || null,
  };
}

function draw(canvas, { title, monthText, totals, currency, topCategory, score }) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Background, matching the app's own black-and-green identity.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#121214');
  grad.addColorStop(1, '#0a0a0b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // The brand mark - a simple coin disc, drawn rather than loaded as an image
  // so this never depends on an asset being ready in time for export.
  ctx.beginPath();
  ctx.arc(60, 64, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillStyle = '#0a0a0b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', 60, 66);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#8a8a94';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('CAMPUS COIN', 104, 58);
  ctx.fillText(monthText.toUpperCase(), 104, 80);

  // The title, wrapped across up to two lines.
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 46px system-ui, sans-serif';
  const words = title.split(' ');
  let line = '';
  let y = 190;
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > w - 100 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, 50, y + i * 56));
  y += lines.length * 56 + 30;

  if (topCategory) {
    ctx.fillStyle = '#4ade80';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(`Most spent on ${topCategory.name} · ${topCategory.share}%`, 50, y);
    y += 50;
  }

  // Three stat chips along the bottom.
  const chips = [
    { label: 'SPENT', value: money(totals.expense, currency) },
    { label: 'KEPT', value: money(totals.balance, currency) },
    { label: 'SCORE', value: `${score.score}/100` },
  ];
  const chipW = (w - 100) / 3;
  chips.forEach((chip, i) => {
    const x = 50 + i * chipW;
    ctx.fillStyle = '#b0b0ba';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(chip.label, x, h - 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(chip.value, x, h - 58);
  });

  ctx.fillStyle = '#5c5c66';
  ctx.font = '400 13px system-ui, sans-serif';
  ctx.fillText('campuscoinpk.vercel.app', 50, h - 24);
}

export default function PersonalityCard({ details, month, currency }) {
  const ref = useRef(null);
  const { title, topCategory } = personalityFor(details);

  useEffect(() => {
    if (ref.current) {
      draw(ref.current, {
        title,
        monthText: month,
        totals: details.totals,
        currency,
        topCategory,
        score: details.score,
      });
    }
  }, [title, month, details, currency, topCategory]);

  const downloadCard = () => {
    const canvas = ref.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `campus-coin-${month.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <section className="in-card in-personality">
      <div className="in-head">
        <h3>Your spending personality</h3>
      </div>
      <canvas ref={ref} width={560} height={700} className="in-personality-canvas" />
      <button type="button" className="in-pill is-light" onClick={downloadCard}>
        Download to share
      </button>
    </section>
  );
}
