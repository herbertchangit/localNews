export function normalizeLoginContact(value:string){
  const digits=value.replace(/\D/g,'');
  if(digits.startsWith('60')&&digits.length>9)return`0${digits.slice(2)}`;
  return digits;
}

export function isContactMatch(input:string,stored:string|null|undefined){
  if(!stored)return false;
  const normalized=normalizeLoginContact(input);
  return normalized.length>=7&&normalized===normalizeLoginContact(stored);
}

export function loginEmailForContact(contact:string){
  const normalized=normalizeLoginContact(contact);
  return normalized.length>=7?`contact-${normalized}@local.invalid`:'';
}
