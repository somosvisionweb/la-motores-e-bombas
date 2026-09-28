import { NextResponse } from 'next/server';
import { PermissionError } from '../auth/errors';
import { requireActionPermission, requirePagePermission } from '../auth/session';
import type { PermissionKey, SessionUser } from '../auth/types';
import { REPORT_META, isReportType, type ReportType } from '../services/reports';

/** Permissões necessárias para ver / exportar um tipo de relatório. */
export function reportPermissions(type: ReportType, mode: 'view' | 'export'): PermissionKey[] {
  const base: PermissionKey[] = ['reports.view', REPORT_META[type].permission];
  return mode === 'export' ? [...new Set<PermissionKey>([...base, 'reports.export'])] : [...new Set(base)];
}

/** Uso em páginas (redireciona quando não autorizado). */
export async function requireReportPage(type: string, mode: 'view' | 'export'): Promise<{ user: SessionUser; type: ReportType } | null> {
  if (!isReportType(type)) return null;
  const user = await requirePagePermission(...reportPermissions(type, mode));
  return { user, type };
}

/** Uso em rotas de API (401/403/404 em JSON). */
export async function guardReportApi(type: string, mode: 'view' | 'export'): Promise<{ user: SessionUser; type: ReportType } | { response: Response }> {
  if (!isReportType(type)) return { response: NextResponse.json({ error: 'Relatório inexistente' }, { status: 404 }) };
  try {
    return { user: await requireActionPermission(...reportPermissions(type, mode)), type };
  } catch (error) {
    if (error instanceof PermissionError) return { response: NextResponse.json({ error: error.message }, { status: /sessão expirou/i.test(error.message) ? 401 : 403 }) };
    throw error;
  }
}
