/**
 * Fase 1.7.9 — RPC payload contracts (READ-ONLY, pure).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import type {
  RpcPayloadField,
  RpcPayloadSchema,
} from './rpcContractTypes';
import { getCatalogEntryByFlow } from './rpcCatalog';

const FORBIDDEN_FIELDS = [
  'raw_payload',
  'raw',
  'payload_dump',
  'sql',
  'unsafe_json',
];

const FLOW_PAYLOAD_FIELDS: Record<FlowId, RpcPayloadField[]> = {
  dashboard_profile_save: [
    { name: 'profile_id', kind: 'identifier', required: true, canonicalOwner: 'profile' },
    { name: 'full_name', kind: 'scalar', required: false, canonicalOwner: 'profile' },
    { name: 'whatsapp', kind: 'scalar', required: false, canonicalOwner: 'mixed' },
    { name: 'avatar_url', kind: 'scalar', required: false, canonicalOwner: 'profile' },
  ],
  persist_first_service: [
    { name: 'provider_id', kind: 'identifier', required: true, canonicalOwner: 'provider' },
    { name: 'category_id', kind: 'identifier', required: true, canonicalOwner: 'provider' },
    { name: 'service_name', kind: 'scalar', required: true, canonicalOwner: 'provider' },
    { name: 'finalize', kind: 'enum', required: true, canonicalOwner: 'provider' },
  ],
  bet_finish_pro: [
    { name: 'profile_id', kind: 'identifier', required: true, canonicalOwner: 'profile' },
    { name: 'kind', kind: 'enum', required: true, canonicalOwner: 'profile' },
    { name: 'provider_seed', kind: 'json_bounded', required: true, canonicalOwner: 'provider' },
  ],
  bet_finish_client: [
    { name: 'profile_id', kind: 'identifier', required: true, canonicalOwner: 'profile' },
    { name: 'kind', kind: 'enum', required: true, canonicalOwner: 'profile' },
  ],
  profile_type_switch: [
    { name: 'profile_id', kind: 'identifier', required: true, canonicalOwner: 'profile' },
    { name: 'new_type', kind: 'enum', required: true, canonicalOwner: 'profile' },
  ],
  avatar_sync: [
    { name: 'profile_id', kind: 'identifier', required: true, canonicalOwner: 'profile' },
    { name: 'avatar_url', kind: 'scalar', required: true, canonicalOwner: 'profile' },
  ],
  onboarding_progress_sync: [
    { name: 'provider_id', kind: 'identifier', required: true, canonicalOwner: 'provider' },
    { name: 'progress', kind: 'json_bounded', required: true, canonicalOwner: 'provider' },
  ],
  admin_profile_update: [
    { name: 'profile_id', kind: 'identifier', required: true, canonicalOwner: 'admin' },
    { name: 'patch', kind: 'json_bounded', required: true, canonicalOwner: 'admin' },
  ],
  admin_provider_update: [
    { name: 'provider_id', kind: 'identifier', required: true, canonicalOwner: 'admin' },
    { name: 'patch', kind: 'json_bounded', required: true, canonicalOwner: 'admin' },
  ],
};

export function detectUnsafePayloadFields(fields: RpcPayloadField[]): string[] {
  const unsafe: string[] = [];
  for (const f of fields) {
    if (FORBIDDEN_FIELDS.includes(f.name)) unsafe.push(f.name);
    if (f.kind === 'raw_payload') unsafe.push(f.name);
    if (f.kind === 'json_unbounded') unsafe.push(f.name);
    if ((f.kind === 'ownership' || f.canonicalOwner === undefined) && f.required) {
      // missing canonical owner on required field
      if (!f.canonicalOwner) unsafe.push(`${f.name}:missing_canonical_owner`);
    }
  }
  return unsafe;
}

export function buildPayloadContract(flow: FlowId): RpcPayloadSchema | null {
  const entry = getCatalogEntryByFlow(flow);
  if (!entry) return null;
  const fields = FLOW_PAYLOAD_FIELDS[flow] ?? [];
  const unsafe = detectUnsafePayloadFields(fields);
  return {
    flow,
    name: `${entry.rpc}_payload`,
    fields,
    forbiddenFields: FORBIDDEN_FIELDS,
    unsafeFieldsDetected: unsafe,
    canonicalOwner: entry.ownership,
  };
}

export function validatePayloadContractShape(schema: RpcPayloadSchema): boolean {
  if (!schema.fields.length) return false;
  for (const f of schema.fields) {
    if (!f.name) return false;
    if (!f.kind) return false;
  }
  return schema.unsafeFieldsDetected.length === 0;
}

export function explainPayloadCompatibility(schema: RpcPayloadSchema): string {
  return `[PAYLOAD] ${schema.name} owner=${schema.canonicalOwner} fields=${schema.fields.length} unsafe=${schema.unsafeFieldsDetected.length}`;
}

export function buildAllPayloadContracts(): RpcPayloadSchema[] {
  const out: RpcPayloadSchema[] = [];
  for (const r of OPERATION_REGISTRY) {
    const s = buildPayloadContract(r.flow);
    if (s) out.push(s);
  }
  return out;
}
