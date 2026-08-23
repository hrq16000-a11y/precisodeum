import { useEffect } from 'react';
import { useNavigate } from '@/lib/router-compat';

const DashboardPlanPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);
  return null;
};

export default DashboardPlanPage;
