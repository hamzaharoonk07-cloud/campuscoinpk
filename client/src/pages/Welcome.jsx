import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Icon, { Wordmark } from '../components/Icon.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import '../styles/welcome.css';

/* The opening screen (Careem-style): the intro film plays behind, the brand and
   the ways in sit over it. Shown to anyone who opens the app signed out. Returning
   signed-in users never see it - Protected sends them straight to the dashboard. */
export default function Welcome() {
  const navigate = useNavigate();
  return (
    <main className="wel">
      {/* The film loops muted behind everything; a scrim keeps the copy readable.
          Muted + playsInline so mobile browsers allow autoplay. */}
      <video className="wel-video" autoPlay muted loop playsInline poster="/icon-512.png">
        <source src="/intro.mp4" type="video/mp4" />
      </video>
      <div className="wel-scrim" />

      <div className="wel-inner">
        <div className="wel-brand">
          <Wordmark size={34} />
          <p className="wel-tag">Say it. Saved. Done.</p>
        </div>

        <div className="wel-actions">
          <button type="button" className="wel-btn wel-btn-primary" onClick={() => navigate('/phone')}>
            <Icon name="user" size={18} />
            Continue with phone number
          </button>

          {/* Google draws its own button; bare = no "or" divider above it. */}
          <div className="wel-google">
            <GoogleSignInButton bare />
          </div>

          <button type="button" className="wel-btn wel-btn-ghost" onClick={() => navigate('/register')}>
            Sign up with email
          </button>

          <p className="wel-login">
            Already have an account?{' '}
            <Link to="/login">Log in</Link>
          </p>

          <p className="wel-fine">
            By continuing you agree to our <Link to="/privacy">Privacy Policy</Link>. No bank link, no card.
          </p>
        </div>
      </div>
    </main>
  );
}
