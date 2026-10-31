import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import './Register.css';

export default function Register() {
  return (
    <div className="register-page">
      <div className="register-card fade-in-up card">
        <Logo />
        <h1>Account requests</h1>
        <p className="text-secondary">
          RentEase accounts are created by your property administrator or landlord. Reach out to
          them to get access, then come back and sign in below.
        </p>
        <Link to="/login" className="btn btn-primary btn-block">
          Back to login
        </Link>
      </div>
    </div>
  );
}
