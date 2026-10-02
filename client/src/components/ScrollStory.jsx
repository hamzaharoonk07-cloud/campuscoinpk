import Icon from './Icon.jsx';

/* ---------------------------------------------------------------------------
   The scroll story: three acts that play as the page is scrolled, built from
   the app's own interface rather than a recording of it.

     I   One transaction, all the way through - typed, categorised, filed,
         and then its effect on the chart, the budget and the assistant.
     II  A month assembling itself - 30 days fill, collapse into six months,
         and resolve into the spending split.
     III Ask and it answers - the question, the rows it reads, the arithmetic,
         and the sentence that comes out.

   Every beat is a plain DOM element animated by a scroll-driven timeline
   (styles/story.css). Where those timelines are unsupported, or the reader
   has asked for reduced motion, each act simply shows its finished state -
   the same rule the rest of the site follows.
--------------------------------------------------------------------------- */

// Act II: the 30 squares of September, by how much was spent that day.
const DAYS = [
  0, 2, 1, 0, 3, 2, 1, 0, 1, 3, 2, 0, 1, 2, 3, 1, 0, 2, 1, 3,
  2, 1, 0, 3, 2, 1, 2, 0, 1, 3,
];

// Act II: the six months, as a percentage of the tallest.
const MONTHS = [
  ['Apr', 67], ['May', 87], ['Jun', 76], ['Jul', 100], ['Aug', 79], ['Sep', 82],
];

// Act III: the food rows the assistant adds up.
const FOOD_ROWS = [
  ['Lunch, Student Hall', '450'],
  ['Canteen coffee', '120'],
  ['Foodpanda dinner', '890'],
];

function Act({ n, title, kicker, children }) {
  return (
    <div className="story-act">
      <div className="story-track">
        <div className="story-stage">
          <div className="story-side">
            <span className="story-num">{String(n).padStart(2, '0')}</span>
            <h3>{title}</h3>
            <p>{kicker}</p>
          </div>
          <div className="story-panel">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function ScrollStory() {
  return (
    <section className="lp-story" aria-label="How Campus Coin works, step by step">
      {/* --- I ---------------------------------------------------------- */}
      <Act
        n={1}
        title="One line in, and it is filed."
        kicker="Type what you bought. The category, the chart, the budget and the assistant all follow from that one line."
      >
        <div className="story-compose b-compose">
          <Icon name="plus" size={16} />
          <span className="story-typed">Lunch, Student Hall</span>
          <span className="story-amount b-amount">450</span>
        </div>

        <div className="story-chip b-chip">
          <span className="story-chip-dot" />
          Food
          <em>matched &ldquo;lunch&rdquo;</em>
        </div>

        <div className="story-row b-drop">
          <span className="story-row-icon"><Icon name="utensils" size={15} /></span>
          <span className="story-row-name">Lunch, Student Hall<em>Food &middot; Today</em></span>
          <span className="story-row-amt">&minus;450</span>
        </div>

        <div className="story-rows b-shift">
          <div className="story-row is-quiet">
            <span className="story-row-icon"><Icon name="book" size={15} /></span>
            <span className="story-row-name">Photocopies<em>Academics &middot; Yesterday</em></span>
            <span className="story-row-amt">&minus;120</span>
          </div>
          <div className="story-row is-quiet">
            <span className="story-row-icon"><Icon name="bus" size={15} /></span>
            <span className="story-row-name">Bus to campus<em>Transport &middot; Yesterday</em></span>
            <span className="story-row-amt">&minus;80</span>
          </div>
        </div>

        <div className="story-budget b-budget">
          <span className="story-budget-top">
            Food budget
            <em className="b-over">Over</em>
          </span>
          <span className="story-budget-bar"><i /></span>
          <span className="story-budget-fig">Rs 10,941 <small>of Rs 9,000</small></span>
        </div>

        <div className="story-coin b-coin">
          <span className="story-coin-face" aria-hidden="true" />
          Rs 10,941 this month &mdash; 7% above your usual.
        </div>
      </Act>

      {/* --- II --------------------------------------------------------- */}
      <Act
        n={2}
        title="Thirty days become one picture."
        kicker="A month of small entries collapses into six months side by side, and then into where the money actually went."
      >
        <div className="story-cal b-cal" aria-hidden="true">
          {DAYS.map((weight, i) => (
            <i key={i} className={`lvl-${weight}`} style={{ '--i': i }} />
          ))}
        </div>

        <div className="story-months b-months" aria-hidden="true">
          {MONTHS.map(([m, h], i) => (
            <span key={m} style={{ '--h': `${h}%`, '--i': i }} className={m === 'Sep' ? 'is-now' : undefined}>
              <i />
              <b>{m}</b>
            </span>
          ))}
        </div>

        <div className="story-split b-split">
          <svg viewBox="0 0 42 42" aria-hidden="true">
            <circle cx="21" cy="21" r="15.9" className="t" />
            <circle cx="21" cy="21" r="15.9" className="a1" style={{ '--d': '30 70', '--o': 25 }} />
            <circle cx="21" cy="21" r="15.9" className="a2" style={{ '--d': '28 72', '--o': -5 }} />
            <circle cx="21" cy="21" r="15.9" className="a3" style={{ '--d': '16 84', '--o': -33 }} />
            <circle cx="21" cy="21" r="15.9" className="a4" style={{ '--d': '11 89', '--o': -49 }} />
          </svg>
          <span className="story-total">
            <em>Money out, September</em>
            <b className="b-count">Rs 39,565</b>
          </span>
        </div>
      </Act>

      {/* --- III -------------------------------------------------------- */}
      <Act
        n={3}
        title="It shows its working."
        kicker="Ask in plain words. The answer is added up from your own rows, not guessed at — which is why it cannot contradict your reports."
      >
        <div className="story-ask b-ask">
          <span className="story-typed is-ask">How much on food?</span>
        </div>

        <div className="story-reads b-reads">
          {FOOD_ROWS.map(([name, amt], i) => (
            <div className="story-row" key={name} style={{ '--i': i }}>
              <span className="story-row-icon"><Icon name="utensils" size={15} /></span>
              <span className="story-row-name">{name}</span>
              <span className="story-row-amt">&minus;{amt}</span>
            </div>
          ))}
          <div className="story-row is-more">
            <span className="story-row-icon"><Icon name="more" size={15} /></span>
            <span className="story-row-name">and 14 more in Food</span>
            <span className="story-row-amt">&minus;9,481</span>
          </div>
        </div>

        <div className="story-sum b-sum">
          <span>Food, September</span>
          <b>Rs 10,941</b>
        </div>

        <div className="story-coin is-answer b-answer">
          <span className="story-coin-face" aria-hidden="true" />
          Rs 10,941 this month &mdash; 7% above your usual. Most of it is weekend delivery.
        </div>

        <div className="story-avg b-avg">
          <span>Your three-month average</span>
          <b>Rs 10,225</b>
        </div>
      </Act>
    </section>
  );
}
