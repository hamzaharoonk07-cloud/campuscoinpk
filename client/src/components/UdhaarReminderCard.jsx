import { useEffect, useRef } from 'react';
import { money } from '../lib/format.js';

/* ---------------------------------------------------------------------------
   The branded reminder card for one udhaar - drawn to a <canvas>, same
   pattern as PersonalityCard, so "Download" produces a real PNG the
   student can attach in WhatsApp alongside the message (wa.me links can
   open a chat with text ready, but cannot attach an image for you - this
   is the part that fills that gap).
--------------------------------------------------------------------------- */

function draw(canvas, { person, amount, currency, note }) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#121214');
  grad.addColorStop(1, '#0a0a0b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(60, 60, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillStyle = '#0a0a0b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', 60, 63);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#8a8a94';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('CAMPUS COIN · UDHAAR REMINDER', 104, 56);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 32px system-ui, sans-serif';
  ctx.fillText(person, 50, 170);

  ctx.fillStyle = '#4ade80';
  ctx.font = '800 58px system-ui, sans-serif';
  ctx.fillText(money(amount, currency), 50, 240);

  ctx.fillStyle = '#b0b0ba';
  ctx.font = '500 20px system-ui, sans-serif';
  ctx.fillText('udhaar baaki hai', 50, 280);

  if (note) {
    ctx.fillStyle = '#8a8a94';
    ctx.font = '400 16px system-ui, sans-serif';
    ctx.fillText(note.length > 60 ? `${note.slice(0, 57)}…` : note, 50, 316);
  }

  ctx.fillStyle = '#5c5c66';
  ctx.font = '400 13px system-ui, sans-serif';
  ctx.fillText('campuscoinpk.vercel.app', 50, h - 24);
}

export default function UdhaarReminderCard({ person, amount, currency, note }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) draw(ref.current, { person, amount, currency, note });
  }, [person, amount, currency, note]);

  const downloadCard = () => {
    const canvas = ref.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `udhaar-${String(person).replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <canvas ref={ref} width={700} height={400} style={{ width: '100%', maxWidth: 420, borderRadius: 16 }} />
      <button type="button" className="btn btn-sm" onClick={downloadCard}>
        <span>Download card</span>
      </button>
    </div>
  );
}
