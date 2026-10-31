import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import { EmptyState } from '../components/common/States';

export default function NotFoundPage() {
  return (
    <div className="fade-in-up">
      <PageHeader title="Page not found" />
      <div className="card">
        <EmptyState
          icon={MapPinOff}
          title="We couldn't find that page"
          description="The link may be out of date, or you may not have access to it."
          action={<Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>}
        />
      </div>
    </div>
  );
}
