import { supabase } from '@/integrations/supabase/client';
import { logAuditAction } from '@/hooks/useAuditLog';

interface UpsertMediaParams {
  storagePath: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  entityType: string;
  entityRef: string;
  userRef: string;
  sizeOriginal?: number;
}

/**
 * Idempotent media upsert: if storage_path already exists, update instead of insert.
 * Ensures user_ref is always profiles.user_ref (never "unlinked" for user uploads).
 * Non-blocking: errors are silently logged.
 */
export const upsertMedia = async (params: UpsertMediaParams): Promise<void> => {
  try {
    if (!params.userRef) {
      console.warn('[mediaUtils] Skipping upsert — no user_ref provided');
      return;
    }

    // Check if record already exists by storage_path
    const { data: existing } = await supabase
      .from('media')
      .select('id')
      .eq('storage_path', params.storagePath)
      .maybeSingle();

    if (existing) {
      // Update existing record (idempotent)
      await supabase.from('media').update({
        public_url: params.publicUrl,
        is_active: true,
        original_name: params.originalName,
        mime_type: params.mimeType,
        size_original: params.sizeOriginal || 0,
      }).eq('id', existing.id);
    } else {
      // Insert new record
      await supabase.from('media').insert({
        storage_path: params.storagePath,
        public_url: params.publicUrl,
        original_name: params.originalName,
        mime_type: params.mimeType,
        entity_type: params.entityType,
        entity_ref: params.entityRef,
        user_ref: params.userRef,
        size_original: params.sizeOriginal || 0,
        is_active: true,
      });
    }

    // Non-blocking audit
    logAuditAction({
      action: 'media_uploaded',
      resource_type: params.entityType,
      resource_id: params.entityRef,
      details: { storage_path: params.storagePath },
    }).catch(() => {});
  } catch (e) {
    console.error('[mediaUtils] upsert failed:', e);
  }
};

/**
 * Deactivate a media record by storage_path and log audit.
 */
export const deactivateMedia = async (storagePath: string, entityType?: string): Promise<void> => {
  try {
    await supabase.from('media').update({ is_active: false } as any).eq('storage_path', storagePath);

    logAuditAction({
      action: 'media_deleted',
      resource_type: entityType || 'media',
      details: { storage_path: storagePath },
    }).catch(() => {});
  } catch (e) {
    console.error('[mediaUtils] deactivate failed:', e);
  }
};

/**
 * Resolve user_ref and optionally provider_id for a given userId.
 */
export const resolveIdentity = async (userId: string): Promise<{ userRef: string | null; providerId: string | null }> => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_ref')
      .eq('id', userId)
      .maybeSingle();

    const { data: provider } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      userRef: profile?.user_ref || null,
      providerId: provider?.id || null,
    };
  } catch {
    return { userRef: null, providerId: null };
  }
};
