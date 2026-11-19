/** Display a database ISO date without timezone shifts on local midnight. */
export function formatDatePt(value:string|null|undefined):string {
  if(!value)return '—';
  const match=/^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:$|T)/.exec(value);
  if(!match)return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
