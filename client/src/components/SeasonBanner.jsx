import { currentIslamicSeason } from '../lib/islamicDates.js';

const COPY = {
  ramadan: {
    title: 'Ramadan Mubarak',
    body: 'Sehri, iftar and the Zakat you give this month are all just transactions - log them as you would any other, and they still show up in your usual categories.',
  },
  'eid-fitr': {
    title: 'Eid Mubarak',
    body: 'Getting Eid money? Type "Eid money 2000" and it lands in your Gift category automatically.',
  },
  'eid-adha': {
    title: 'Eid Mubarak',
    body: 'Getting Eid money? Type "Eid money 2000" and it lands in your Gift category automatically.',
  },
};

/** The seasonal banner (brief: "Eid salami and Ramadan mode") - silent the
 *  rest of the year, since there is nothing to say outside these windows. */
export default function SeasonBanner() {
  const season = currentIslamicSeason();
  if (!season) return null;
  const copy = COPY[season.kind];

  return (
    <div className="d9-notice is-season">
      <span aria-hidden="true" className="d9-season-emoji">
        {season.kind === 'ramadan' ? '\u{1F319}' : '\u{1F38A}'}
      </span>
      <strong>{copy.title}</strong>
      <span>{copy.body}</span>
    </div>
  );
}
