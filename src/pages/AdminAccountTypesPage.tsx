import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { CreditCard, Shield, Package, Layers } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AccountTypesTab from '@/components/admin/AccountTypesTab';
import LevelsTab from '@/components/admin/LevelsTab';
import TierRulesTab from '@/components/admin/TierRulesTab';
import PlanResourcesTab from '@/components/admin/PlanResourcesTab';

const AdminAccountTypesPage = () => {
  const { isAdmin, loading } = useAdmin();

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" /> Planos, Níveis & Recursos
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie tipos de conta, níveis de acesso, regras de tier e recursos incluídos</p>
      </div>

      <Tabs defaultValue="types" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="types" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <CreditCard className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Tipos de</span> Conta
          </TabsTrigger>
          <TabsTrigger value="levels" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Shield className="h-3.5 w-3.5" /> Níveis
          </TabsTrigger>
          <TabsTrigger value="tiers" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Layers className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Regras</span> Tier
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Package className="h-3.5 w-3.5" /> Recursos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="types"><AccountTypesTab /></TabsContent>
        <TabsContent value="levels"><LevelsTab /></TabsContent>
        <TabsContent value="tiers"><TierRulesTab /></TabsContent>
        <TabsContent value="resources"><PlanResourcesTab /></TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminAccountTypesPage;
