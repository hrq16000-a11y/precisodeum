import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface UserPermissions {
  create_users: boolean;
  edit_users: boolean;
  delete_users: boolean;
  view_users: boolean;
  manage_settings: boolean;
  view_reports: boolean;
  manage_billing: boolean;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  create_users: false,
  edit_users: false,
  delete_users: false,
  view_users: false,
  manage_settings: false,
  view_reports: false,
  manage_billing: false,
};

interface UsePermissionsReturn {
  permissions: UserPermissions;
  levelName: string;
  levelColor: string;
  accountTypeName: string;
  accountTypeColor: string;
  loading: boolean;
  hasPermission: (key: keyof UserPermissions) => boolean;
}

export const usePermissions = (): UsePermissionsReturn => {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [levelName, setLevelName] = useState('');
  const [levelColor, setLevelColor] = useState('');
  const [accountTypeName, setAccountTypeName] = useState('');
  const [accountTypeColor, setAccountTypeColor] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setPermissions(DEFAULT_PERMISSIONS);
      setLevelName('');
      setLevelColor('');
      setAccountTypeName('');
      setAccountTypeColor('');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const promises: Promise<any>[] = [];

      if (profile.level_id) {
        promises.push(
          supabase.from('user_levels').select('name, color, permissions').eq('id', profile.level_id).single()
        );
      } else {
        promises.push(Promise.resolve({ data: null }));
      }

      if (profile.account_type_id) {
        promises.push(
          supabase.from('account_types').select('name, color').eq('id', profile.account_type_id).single()
        );
      } else {
        promises.push(Promise.resolve({ data: null }));
      }

      const [levelRes, accTypeRes] = await Promise.all(promises);

      if (levelRes.data) {
        setLevelName(levelRes.data.name || '');
        setLevelColor(levelRes.data.color || '');
        const perms = (levelRes.data.permissions as UserPermissions) || DEFAULT_PERMISSIONS;
        setPermissions(perms);
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
        setLevelName('');
        setLevelColor('');
      }

      if (accTypeRes.data) {
        setAccountTypeName(accTypeRes.data.name || '');
        setAccountTypeColor(accTypeRes.data.color || '');
      } else {
        setAccountTypeName('');
        setAccountTypeColor('');
      }

      setLoading(false);
    };

    fetchData();
  }, [profile?.level_id, profile?.account_type_id]);

  const hasPermission = (key: keyof UserPermissions) => permissions[key] === true;

  return { permissions, levelName, levelColor, accountTypeName, accountTypeColor, loading, hasPermission };
};

// Map admin paths to required permissions
export const ADMIN_ROUTE_PERMISSIONS: Record<string, keyof UserPermissions> = {
  '/admin/usuarios': 'view_users',
  '/admin/niveis': 'manage_settings',
  '/admin/tipos-conta': 'manage_settings',
  '/admin/crm-usuarios': 'view_users',
  '/admin/configuracoes': 'manage_settings',
  '/admin/metatags': 'manage_settings',
  '/admin/menus': 'manage_settings',
  '/admin/modulos': 'manage_settings',
  '/admin/backup': 'manage_settings',
  '/admin/planos-regras': 'manage_billing',
  '/admin/estatisticas': 'view_reports',
  '/admin/auditoria': 'view_reports',
};
