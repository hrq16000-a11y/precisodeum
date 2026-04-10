import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useChatEligibility } from '@/hooks/useChatEligibility';
import ChatConversationList from '@/components/chat/ChatConversationList';
import ChatMessageView from '@/components/chat/ChatMessageView';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Lock, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const DashboardChatPage = () => {
  const { isEnabled, eligible, reason, isLoading, settings } = useChatEligibility();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
      </DashboardLayout>
    );
  }

  if (!isEnabled) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">O chat está desativado no momento.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (!eligible) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Chat
          </h1>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-8 text-center">
              <Lock className="mx-auto h-10 w-10 text-amber-500 mb-3" />
              <p className="font-medium text-foreground mb-2">Recurso Bloqueado</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {reason || settings?.blocked_message}
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Mobile: show either list or conversation
  if (isMobile && selectedConversation) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-180px)] flex flex-col">
          <ChatMessageView
            conversationId={selectedConversation}
            onBack={() => setSelectedConversation(null)}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" /> Chat
        </h1>

        {settings?.welcome_message && (
          <p className="text-sm text-muted-foreground">{settings.welcome_message}</p>
        )}

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Conversation list */}
          <Card className="overflow-hidden">
            <ChatConversationList
              selectedId={selectedConversation || undefined}
              onSelect={setSelectedConversation}
            />
          </Card>

          {/* Message view */}
          <Card className="overflow-hidden min-h-[400px]">
            {selectedConversation ? (
              <ChatMessageView conversationId={selectedConversation} />
            ) : (
              <CardContent className="flex flex-col items-center justify-center h-full py-16">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardChatPage;
