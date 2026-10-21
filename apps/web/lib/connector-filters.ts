/** Connector status means credential state, not marketplace synchronization. */
export type ConnectorFilter = 'MOCK' | 'ERROR' | 'VERIFIED' | 'UNVERIFIED';

export function parseConnectorFilter(raw: string | null | undefined): ConnectorFilter | undefined {
  if (raw==='MOCK'||raw==='ERROR'||raw==='VERIFIED'||raw==='UNVERIFIED') return raw;
  return undefined;
}

export function connectorPageUrl(page:number, query='', filter?:ConnectorFilter):string {
  const params=new URLSearchParams();
  if(filter)params.set('status',filter);
  if(query)params.set('q',query);
  if(page>1)params.set('page',String(page));
  const search=params.toString();
  return '/commerce/stores'+(search?'?'+search:'');
}

export function connectorCredentialState(input: {
  mode:'MOCK'|'STAGE'|'PRODUCTION'; enabled:boolean;
  lastValidatedAt:Date|null; lastErrorCode:string|null;
}): 'SIMULATED'|'ERROR'|'INACTIVE'|'VERIFIED'|'UNVERIFIED' {
  if(input.mode==='MOCK')return 'SIMULATED';
  if(input.lastErrorCode)return 'ERROR';
  if(!input.enabled)return 'INACTIVE';
  if(input.lastValidatedAt)return 'VERIFIED';
  return 'UNVERIFIED';
}
