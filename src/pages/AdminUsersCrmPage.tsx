import { useEffect } from 'react';
import { useNavigate } from '@/lib/router-compat';

const AdminUsersCrmPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/admin/usuarios', { replace: true });
  }, [navigate]);
  return null;
};

export default AdminUsersCrmPage;
